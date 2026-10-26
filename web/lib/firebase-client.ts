'use client';
import {initializeApp,getApps} from 'firebase/app';
import {getAuth,connectAuthEmulator} from 'firebase/auth';
export const configured=Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY&&process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID&&process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN&&process.env.NEXT_PUBLIC_FIREBASE_APP_ID);
export function authClient(){
  if(!configured) throw new Error('Firebase configuration is missing.');
  const first=getApps().length===0;
  const app=getApps()[0]??initializeApp({apiKey:process.env.NEXT_PUBLIC_FIREBASE_API_KEY,authDomain:process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,projectId:process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,appId:process.env.NEXT_PUBLIC_FIREBASE_APP_ID});
  const auth=getAuth(app);
  if(first&&process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS==='1') connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
  return auth;
}
