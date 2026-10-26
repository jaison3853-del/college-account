import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'MCC · Fees management',description:'Student fees and separate College / Our account collections.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
