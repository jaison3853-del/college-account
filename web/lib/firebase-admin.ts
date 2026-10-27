import {applicationDefault,cert,getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
export class FirebaseConfigurationError extends Error {
 constructor(message:string){super(message);this.name='FirebaseConfigurationError';}
}
export function adminServices(){
  const projectId=process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if(!projectId) throw new Error('Firebase server configuration is missing.');
  if(process.env.NODE_ENV==='production'&&(process.env.FIRESTORE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST)) throw new Error('Emulators are not permitted in production.');
  let credential;
  const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if(raw){
    let account;
    try{account=JSON.parse(raw);}catch{throw new FirebaseConfigurationError('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON. Paste the complete downloaded service-account JSON in Vercel Production settings, then redeploy.');}
    if(!account || typeof account!=='object' || !account.project_id || !account.client_email || !account.private_key)throw new FirebaseConfigurationError('The service-account JSON is missing required fields. Use the complete downloaded file.');
    if(account.project_id!==projectId)throw new FirebaseConfigurationError('The service-account JSON belongs to a different Firebase project.');
    try{credential=cert(account);}catch{throw new FirebaseConfigurationError('The service-account private key could not be read. Restore the original downloaded JSON in Vercel settings.');}
  }else{
    if(process.env.VERCEL)throw new FirebaseConfigurationError('FIREBASE_SERVICE_ACCOUNT_JSON is missing from this Vercel deployment. Add it to Production environment variables and redeploy.');
    credential=applicationDefault();
  }
  const app=getApps()[0]??initializeApp({projectId,credential});
  return {db:getFirestore(app),auth:getAuth(app)};
}
