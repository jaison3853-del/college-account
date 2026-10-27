import {z} from 'zod';
export const attendanceSchema=z.object({id:z.uuid(),date:z.iso.date(),course:z.string().trim().max(100).default(''),addon:z.string().trim().max(140).default(''),topic:z.string().trim().max(200).default(''),year:z.string().regex(/^\d{4}-\d{2}$/),minutes:z.number().int().min(1).max(1440),presentIds:z.array(z.string().min(1).max(100)).max(1000)}).refine(v=>Boolean(v.addon||v.course),{message:'Choose an add-on'}).refine(v=>new Set(v.presentIds).size===v.presentIds.length,{message:'Duplicate students'});
export type Attendance={id:string;date:string;course:string;addon:string;topic:string;year:string;minutes:number;present:{id:string;name:string;admissionNumber:string}[];createdAt:string;createdBy:string};

export function filterAttendance(sessions:Attendance[],f:{year:string;addon:string;from:string;to:string;search:string;sort:string}){
 const q=f.search.trim().toLowerCase();
 return sessions.filter(s=>(!f.year||s.year===f.year)&&(!f.addon||s.addon===f.addon)&&(!f.from||s.date>=f.from)&&(!f.to||s.date<=f.to)&&(!q||s.topic.toLowerCase().includes(q)||s.present.some(p=>(p.name+' '+p.admissionNumber).toLowerCase().includes(q)))).sort((a,b)=>f.sort==='oldest'?a.date.localeCompare(b.date):f.sort==='hours'?b.minutes-a.minutes:f.sort==='present'?b.present.length-a.present.length:b.date.localeCompare(a.date));
}
