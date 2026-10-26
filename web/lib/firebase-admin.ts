import {applicationDefault,cert,getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
export function adminServices(){
  const projectId=process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if(!projectId) throw new Error('Firebase server configuration is missing.');
  if(process.env.NODE_ENV==='production'&&(process.env.FIRESTORE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST)) throw new Error('Emulators are not permitted in production.');
  const app=getApps()[0]??initializeApp({projectId,credential:process.env.FIREBASE_SERVICE_ACCOUNT_JSON?cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)):applicationDefault()});
  return {db:getFirestore(app),auth:getAuth(app)};
}
