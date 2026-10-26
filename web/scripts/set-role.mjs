import {initializeApp,cert,applicationDefault} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
const [email,role]=process.argv.slice(2);
if(!email||!['admin','accountant','viewer'].includes(role))throw new Error('Usage: npm run set-role -- email@example.com admin|accountant|viewer');
initializeApp({projectId:process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,credential:process.env.FIREBASE_SERVICE_ACCOUNT_JSON?cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)):applicationDefault()});
const auth=getAuth();const user=await auth.getUserByEmail(email);
await auth.setCustomUserClaims(user.uid,{...user.customClaims,role});
console.log('Role assigned. Sign out and sign in again to refresh access.');
