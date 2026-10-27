import {NextRequest} from 'next/server';
import {authorized,apiError,HttpError} from '@/lib/auth';
import {attendanceSchema} from '@/lib/attendance';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){try{const {db}=await authorized(req);const docs=await db.collection('attendance').get();return Response.json({sessions:docs.docs.map(d=>({...d.data(),id:d.id}))},{headers:{'Cache-Control':'private, no-store'}});}catch(e){return apiError(e);}}
export async function POST(req:NextRequest){try{
 const {db,uid}=await authorized(req,true);const input=attendanceSchema.parse(await req.json());
 const {id,presentIds,...fields}=input;const ref=db.collection('attendance').doc(id);
 const fingerprint=JSON.stringify({...fields,presentIds:[...presentIds].sort()});
 await db.runTransaction(async tx=>{
  const old=await tx.get(ref);
  if(old.exists){if(old.data()!.createdBy!==uid||old.data()!.fingerprint!==fingerprint)throw new HttpError(409,'This class was already saved with different details.');return;}
  const docs=presentIds.length?await tx.getAll(...presentIds.map(id=>db.collection('students').doc(id))):[];
  const present=docs.map(d=>{
   const s=d.data();if(!s||s.deletedAt||s.status==='discontinued'||s.year!==input.year||s.course!==input.course||(input.addon&&(s.status==='no-addon'?'Without add-on':s.specialization?.trim()||'Not specified')!==input.addon))throw new HttpError(400,'Selected students must belong to the chosen active class. Refresh the student list.');
   return {id:d.id,name:s.name,admissionNumber:s.admissionNumber};
  });
  tx.create(ref,{...fields,present,createdBy:uid,createdAt:new Date().toISOString(),fingerprint});
 });return Response.json({id});
}catch(e){return apiError(e);}}
