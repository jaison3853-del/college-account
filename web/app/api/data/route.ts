import {createHash} from 'node:crypto';
import {NextRequest} from 'next/server';
import {authorized,apiError,HttpError} from '@/lib/auth';
import {commandSchema} from '@/lib/schema';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export async function GET(req:NextRequest){
 try{
  const {db,role}=await authorized(req);
  const [students,fees,payments]=await Promise.all(['students','fees','payments'].map(c=>db.collection(c).get()));
  return Response.json({students:students.docs.map(d=>({...d.data(),id:d.id})),fees:fees.docs.map(d=>({...d.data(),id:d.id})),payments:payments.docs.map(d=>({...d.data(),id:d.id})),role},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return apiError(e);}
}
export async function POST(req:NextRequest){
 try{
  const {db,uid}=await authorized(req,true);
  const c=commandSchema.parse(await req.json());const now=new Date().toISOString();
  if(c.action==='student'){
   const {action,...fields}=c;void action;
   const ref=db.collection('students').doc();const unique=db.collection('admissionNumbers').doc(hash(c.admissionNumber.toLowerCase()));
   await db.runTransaction(async tx=>{
    if((await tx.get(unique)).exists) throw new HttpError(409,'Admission number already exists.');
    tx.create(unique,{studentId:ref.id});tx.create(ref,{...fields,createdBy:uid,createdAt:now});
   });return Response.json({id:ref.id});
  }
  if(c.action==='fee'){
   const student=db.collection('students').doc(c.studentId);const ref=db.collection('fees').doc(hash(c.studentId+':'+c.semester));
   await db.runTransaction(async tx=>{
    const [s,f]=await tx.getAll(student,ref);
    if(!s.exists) throw new HttpError(404,'Student not found.');
    if(f.exists) throw new HttpError(409,'This semester already has a fee.');
    tx.create(ref,{studentId:c.studentId,semester:c.semester,amountPaise:c.amountPaise,concessionPaise:c.concessionPaise,collegePaise:0,ourPaise:0,createdBy:uid,createdAt:now});
   });return Response.json({id:ref.id});
  }
  const payment=db.collection('payments').doc(hash(uid+':'+c.token));const fee=db.collection('fees').doc(c.feeId);
  await db.runTransaction(async tx=>{
   const [p,f]=await tx.getAll(payment,fee);
   if(p.exists){
    const old=p.data()!;
    if(old.feeId!==c.feeId||old.account!==c.account||old.amountPaise!==c.amountPaise||old.date!==c.date||old.method!==c.method||old.reference!==c.reference) throw new HttpError(409,'This payment reference was already used with different details.');
    return;
   }
   if(!f.exists) throw new HttpError(404,'Semester fee not found.');
   const data=f.data()!;const field=c.account==='college'?'collegePaise':'ourPaise';const updated=data[field]+c.amountPaise;
   if(!Number.isSafeInteger(updated)) throw new HttpError(400,'Collection total exceeds supported limits.');
   tx.update(fee,{[field]:updated});
   tx.create(payment,{studentId:data.studentId,feeId:c.feeId,account:c.account,amountPaise:c.amountPaise,date:c.date,method:c.method,reference:c.reference,historical:false,createdBy:uid,createdAt:now});
  });
  return Response.json({id:payment.id});
 }catch(e){return apiError(e);}
}
