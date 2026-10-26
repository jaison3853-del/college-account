// This script requires Firebase emulators. It never connects to a live project.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import ExcelJS from 'exceljs';
if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST)throw new Error('Run with firebase emulators:exec, not against production.');
const projectId='demo-mcc-fees';
initializeApp({projectId});const auth=getAuth(),db=getFirestore();
const origin='http://127.0.0.1:3001';
let logs='';const server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3001'],{env:{...process.env,NEXT_PUBLIC_FIREBASE_PROJECT_ID:projectId,NEXT_PUBLIC_FIREBASE_API_KEY:'fake-emulator-key',NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:projectId+'.firebaseapp.com',NEXT_PUBLIC_FIREBASE_APP_ID:'demo',NEXT_PUBLIC_USE_FIREBASE_EMULATORS:'1',FIREBASE_SERVICE_ACCOUNT_JSON:''},stdio:['ignore','pipe','pipe']});
server.stdout.on('data',c=>{logs+=c});server.stderr.on('data',c=>{logs+=c});
const until=async fn=>{for(let i=0;i<90;i++){try{if(await fn())return;}catch{}await new Promise(r=>setTimeout(r,500));}throw new Error('Server did not start. '+logs.slice(-2000));};
async function token(email,role){
 const u=await auth.createUser({email,password:'emulator-test-password-only'});await auth.setCustomUserClaims(u.uid,{role});
 const r=await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password:'emulator-test-password-only',returnSecureToken:true})});
 const d=await r.json();assert.ok(d.idToken,JSON.stringify(d));return d.idToken;
}
try{
 await until(async()=>{const r=await fetch(origin);return r.status===200;});
 const admin=await token('admin@example.test','admin'),viewer=await token('viewer@example.test','viewer');
 const request=async(path,body,t=admin)=>{const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${t}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};};
 assert.equal((await fetch(origin+'/api/data')).status,401);
 assert.equal((await request('/api/data',{action:'student',name:'Blocked'},viewer)).status,403);
 const student={action:'student',admissionNumber:'TEST-001',name:'Test Student',course:'BCA',year:'2025-26',specialization:'AI',status:'active',phone:''};
 const s=await request('/api/data',student);assert.equal(s.status,200,JSON.stringify(s));
 assert.equal((await request('/api/data',student)).status,409);
 const fee={action:'fee',studentId:s.data.id,semester:1,amountPaise:9800000,concessionPaise:0};
 const f=await request('/api/data',fee);assert.equal(f.status,200,JSON.stringify(f));assert.equal((await request('/api/data',fee)).status,409);
 const p={action:'payment',feeId:f.data.id,account:'college',amountPaise:3000000,date:'2026-01-17',method:'cash',reference:'Smoke',token:crypto.randomUUID()};
 const concurrent=await Promise.all(Array.from({length:5},()=>request('/api/data',p)));assert.ok(concurrent.every(r=>r.status===200),JSON.stringify(concurrent));
 assert.equal((await request('/api/data',{...p,amountPaise:1})).status,409);
 assert.equal((await request('/api/data',{...p,account:'personal',token:crypto.randomUUID()})).status,400);
 assert.equal((await request('/api/data',{...p,account:'our',amountPaise:4000000,token:crypto.randomUUID()})).status,200);
 const report=await request('/api/data',null,viewer);assert.equal(report.status,200);assert.equal(report.data.payments.length,2);assert.equal(report.data.fees[0].collegePaise,3000000);assert.equal(report.data.fees[0].ourPaise,4000000);
 const w=new ExcelJS.Workbook();for(const name of ['BCA','B.com','BBA','FASHION DESIGNING','BSW','MSW','MSC PSYCOLOGY','BSC PHYCOLOGY'])w.addWorksheet(name);
 const sheet=w.getWorksheet('BCA');for(const [cell,value] of Object.entries({B4:'Imported Sample',C4:110000,D4:'30000+30000',E4:40000,F4:10000,B72:'Pending duplicate'}))sheet.getCell(cell).value=value;
 const form=new FormData();form.append('file',new Blob([await w.xlsx.writeBuffer()]),'sample.xlsx');
 const previewResponse=await fetch(origin+'/api/import',{method:'POST',headers:{Authorization:`Bearer ${admin}`},body:form});const preview=await previewResponse.json();assert.equal(previewResponse.status,200,JSON.stringify(preview));assert.equal(preview.rows.length,1);
 const selection={previewId:preview.previewId,selected:['BCA:4']};
 assert.equal((await request('/api/import',selection)).data.imported,1);assert.equal((await request('/api/import',selection)).data.skipped,1);
 const imported=(await db.collection('payments').where('historical','==',true).get()).docs.map(d=>d.data());assert.equal(imported.length,2);assert.ok(imported.every(p=>p.date===null));
 const publicRead=await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents/students`);assert.equal(publicRead.status,403);
 console.log('PASS: real emulator API login, roles, admission uniqueness, fee uniqueness, concurrent payment idempotency, split balances, invalid payload rejection, reviewed import, import retry, historical dates and deny-all browser rules.');
}finally{server.kill('SIGTERM');await db.terminate();}
