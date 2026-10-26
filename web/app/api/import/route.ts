import {createHash} from 'node:crypto';
import {NextRequest} from 'next/server';
import {z} from 'zod';
import {authorized,apiError,HttpError} from '@/lib/auth';
import {parseWorkbook} from '@/lib/importer';
import type {ImportRow} from '@/lib/types';
export const runtime='nodejs';
export const maxDuration=60;
const hash=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');
export async function POST(req:NextRequest){
 try{
  const {db,uid}=await authorized(req,true);
  if(req.headers.get('content-type')?.includes('multipart/form-data')){
   if(Number(req.headers.get('content-length')??0)>3_500_000)throw new HttpError(413,'Workbook must be smaller than 3 MB.');
   const form=await req.formData();const file=form.get('file');
   if(!(file instanceof File)||file.size>3_000_000||!file.name.toLowerCase().endsWith('.xlsx'))throw new HttpError(400,'Upload an .xlsx workbook smaller than 3 MB.');
   const data=Buffer.from(await file.arrayBuffer());let rows:ImportRow[];
   try{rows=await parseWorkbook(data);}catch{throw new HttpError(400,'Could not read this workbook. Use the original MCC eight-sheet layout.');}
   const digest=hash(data);const id=hash(uid+':'+digest);const preview=db.collection('importPreviews').doc(id);
   const refs=rows.map(r=>db.collection('importedRows').doc(hash(digest+':'+r.key)));
   const existing=refs.length?await db.getAll(...refs):[];
   rows=rows.filter((_,i)=>!existing[i].exists);
   await preview.set({uid,digest,rows,expiresAt:Date.now()+60*60*1000});
   return Response.json({previewId:id,rows});
  }
  const {previewId,selected}=z.object({previewId:z.string().regex(/^[a-f0-9]{64}$/),selected:z.array(z.string().max(100)).min(1).max(20)}).parse(await req.json());
  const preview=await db.collection('importPreviews').doc(previewId).get();
  const p=preview.data();
  if(!p||p.uid!==uid||p.expiresAt<Date.now())throw new HttpError(400,'Import preview expired. Upload the workbook again.');
  const keys=new Set(selected);const rows=(p.rows as ImportRow[]).filter(r=>keys.has(r.key));
  if(rows.length!==keys.size)throw new HttpError(400,'Invalid row selection.');
  let imported=0,skipped=0;
  for(const row of rows){
   const key=hash(p.digest+':'+row.key);const marker=db.collection('importedRows').doc(key);const student=db.collection('students').doc(key);
   const admissionNumber='MCC-'+p.digest.slice(0,8)+'-'+row.key.replace(/[^a-zA-Z0-9]/g,'-');
   const unique=db.collection('admissionNumbers').doc(hash(admissionNumber.toLowerCase()));
   const inserted=await db.runTransaction(async tx=>{
    const [m,u]=await tx.getAll(marker,unique);
    if(m.exists)return false;
    if(u.exists)throw new HttpError(409,'Generated admission number already exists. Check the student register.');
    const now=new Date().toISOString();
    tx.create(marker,{studentId:student.id,digest:p.digest,source:row.source,createdBy:uid,createdAt:now});
    tx.create(unique,{studentId:student.id});
    tx.create(student,{admissionNumber,name:row.name,course:row.course,specialization:row.specialization,year:'2025-26',status:row.status,phone:'',createdBy:uid,createdAt:now});
    for(const f of row.fees){
     const fee=db.collection('fees').doc(hash(student.id+':'+f.semester));
     tx.create(fee,{studentId:student.id,semester:f.semester,amountPaise:f.amountPaise,concessionPaise:0,collegePaise:f.collegePaise,ourPaise:f.ourPaise,createdBy:uid,createdAt:now});
     for(const account of ['college','our'] as const){
      const amountPaise=account==='college'?f.collegePaise:f.ourPaise;
      if(amountPaise>0)tx.create(db.collection('payments').doc(hash(key+':'+f.semester+':'+account)),{studentId:student.id,feeId:fee.id,account,amountPaise,date:null,method:'historical',reference:row.source,historical:true,createdBy:uid,createdAt:now});
     }
    }
    return true;
   });if(inserted)imported++;else skipped++;
  }
  return Response.json({imported,skipped});
 }catch(e){return apiError(e);}
}
