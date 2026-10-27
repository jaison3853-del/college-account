import {createHash} from 'node:crypto';
import {NextRequest} from 'next/server';
import {authorized,apiError,HttpError} from '@/lib/auth';
import {correctedTotals} from '@/lib/correction';
import {commandSchema} from '@/lib/schema';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export async function GET(req:NextRequest){
 try{
  const {db,role}=await authorized(req);
  const [students,fees,payments]=await Promise.all(['students','fees','payments'].map(c=>db.collection(c).get()));
  return Response.json({students:students.docs.filter(d=>!d.data().deletedAt).map(d=>({...d.data(),id:d.id})),fees:fees.docs.filter(d=>students.docs.some(s=>s.id===d.data().studentId&&!s.data().deletedAt)).map(d=>({...d.data(),id:d.id})),payments:payments.docs.filter(d=>students.docs.some(s=>s.id===d.data().studentId&&!s.data().deletedAt)).map(d=>({...d.data(),id:d.id})),role},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return apiError(e);}
}
export async function POST(req:NextRequest){
 try{
  const {db,uid,role}=await authorized(req,true);
  const c=commandSchema.parse(await req.json());const now=new Date().toISOString();
  if(c.action==='deleteStudent'){
   if(role!=='admin')throw new HttpError(403,'Only administrators can delete students.');
   await db.runTransaction(async tx=>{
    const ref=db.collection('students').doc(c.studentId);const student=await tx.get(ref);
    if(!student.exists)throw new HttpError(404,'Student not found.');
    tx.update(ref,{deletedAt:now,deletedBy:uid});
   });return Response.json({ok:true});
  }
  if(c.action==='editPayment'){
   await db.runTransaction(async tx=>{
    const ref=db.collection('payments').doc(c.paymentId);const p=await tx.get(ref);
    if(!p.exists)throw new HttpError(404,'Payment not found.');
    const old=p.data()!;
    if((old.version??0)!==c.version)throw new HttpError(409,'Payment changed. Refresh before editing again.');
    if(c.feeId!==old.feeId)throw new HttpError(400,'Semester cannot be changed in this editor.');
    if(!old.historical&&(!c.date||c.method==='historical'))throw new HttpError(400,'A recorded payment requires its date and payment method.');
    const feeRef=db.collection('fees').doc(old.feeId);const studentRef=db.collection('students').doc(old.studentId);
    const [f,student]=await tx.getAll(feeRef,studentRef);
    if(!f.exists||!student.exists||student.data()!.deletedAt)throw new HttpError(404,'Active student fee not found.');
    let totals;
    try{totals=correctedTotals({collegePaise:f.data()!.collegePaise,ourPaise:f.data()!.ourPaise},{account:old.account,amountPaise:old.amountPaise},c);}catch{throw new HttpError(409,'Account totals require reconciliation.');}
    tx.update(feeRef,totals);
    const changes={account:c.account,amountPaise:c.amountPaise,date:c.date,method:c.method,reference:c.reference};
    tx.create(db.collection('paymentAudit').doc(),{paymentId:p.id,before:old,after:changes,reason:c.reason,by:uid,at:now});
    tx.update(ref,{...changes,version:(old.version??0)+1,edits:[...(old.edits??[]),{reason:c.reason,at:now,by:uid}]});
   });return Response.json({ok:true});
  }
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
    if(!s.exists||s.data()!.deletedAt) throw new HttpError(404,'Student not found.');
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
   const data=f.data()!;const student=await tx.get(db.collection('students').doc(data.studentId));if(!student.exists||student.data()!.deletedAt)throw new HttpError(404,'Active student not found.');const field=c.account==='college'?'collegePaise':'ourPaise';const updated=data[field]+c.amountPaise;
   if(!Number.isSafeInteger(updated)) throw new HttpError(400,'Collection total exceeds supported limits.');
   tx.update(fee,{[field]:updated});
   tx.create(payment,{studentId:data.studentId,feeId:c.feeId,account:c.account,amountPaise:c.amountPaise,date:c.date,method:c.method,reference:c.reference,historical:false,createdBy:uid,createdAt:now});
  });
  return Response.json({id:payment.id});
 }catch(e){return apiError(e);}
}
