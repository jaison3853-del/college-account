import type {NextRequest} from 'next/server';
import {adminServices,FirebaseConfigurationError} from './firebase-admin';
import type {Role} from './types';
export class HttpError extends Error {constructor(public status:number,message:string){super(message);}}
export async function authorized(req:NextRequest,write=false){
  if(req.method!=='GET'){
    const origin=req.headers.get('origin');
    if(origin&&origin!==req.nextUrl.origin) throw new HttpError(403,'Request origin is not allowed.');
  }
  const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if(!token) throw new HttpError(401,'Sign in to continue.');
  const {db,auth}=adminServices();
  let decoded;
  try{decoded=await auth.verifyIdToken(token,true);}catch{throw new HttpError(401,'Your session expired. Sign in again.');}
  const role=decoded.role as Role;
  if(!['admin','accountant','viewer'].includes(role)) throw new HttpError(403,'An administrator must assign your account a role.');
  if(write&&role==='viewer') throw new HttpError(403,'This account has view-only access.');
  return {db,uid:decoded.uid,role};
}
export function apiError(error:unknown){
  if(error instanceof HttpError) return Response.json({error:error.message},{status:error.status});
  if(error instanceof Error&&error.name==='ZodError') return Response.json({error:'Check the required fields, dates and amounts.'},{status:400});
  if(error instanceof FirebaseConfigurationError)return Response.json({error:error.message},{status:503});
  const code=error&&typeof error==='object'&&'code' in error?String(error.code):'unknown';
  console.error('API operation failed:',error instanceof Error?error.name:'UnknownError','code:',code.replace(/[^a-zA-Z0-9_/-]/g,'').slice(0,80));
  if(code==='5')return Response.json({error:'Firestore database was not found. Verify that this Firebase project has a database named (default).'}, {status:503});
  if(code==='7')return Response.json({error:'Firestore denied server access. Check the service-account IAM permissions and that the Firestore API is enabled.'}, {status:503});
  if(code==='16')return Response.json({error:'Firestore could not authenticate the server. Check the service-account credentials in Vercel.'}, {status:503});
  if(code==='14'||code==='4')return Response.json({error:'Firestore is temporarily unreachable or the request timed out. Retry and check Vercel runtime logs.'}, {status:503});
  return Response.json({error:'The operation could not be completed. Check the server configuration and try again.'},{status:500});
}
