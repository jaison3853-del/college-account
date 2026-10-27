import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import type {Attendance} from './attendance';
export async function createAttendancePdf(s:Attendance){
  const doc=await PDFDocument.create();const font=await doc.embedFont(StandardFonts.Helvetica);const bold=await doc.embedFont(StandardFonts.HelveticaBold);
  let page=doc.addPage([595,842]),y=790;
  function line(text:string,strong=false){if(y<55){page=doc.addPage([595,842]);y=790;}page.drawText(text,{x:45,y,size:11,font:strong?bold:font,color:rgb(.1,.25,.2)});y-=23;}
  function wrapped(text:string,strong=false){let row='';for(const word of text.split(/\s+/)){const next=row?row+' '+word:word;if(font.widthOfTextAtSize(next,11)>500&&row){line(row,strong);row=word;}else row=next;}if(row)line(row,strong);}
  line('MCC - CLASS ATTENDANCE',true);wrapped(`${s.course}${s.addon?' / '+s.addon:''} | ${s.year}`);line(`Class date: ${s.date} | Duration: ${s.minutes/60} hours`);if(s.topic)wrapped('Topic: '+s.topic);line(`Students present: ${s.present.length}`,true);line('');
  s.present.forEach((p,i)=>wrapped(`${i+1}. ${p.name} (${p.admissionNumber})`));if(!s.present.length)line('No students marked present.');line('');wrapped('Only attendance of students marked present is included. Unmarked students are not assigned an absent status.');
  return doc.save();
}
