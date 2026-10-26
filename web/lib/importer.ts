import ExcelJS from 'exceljs';
import type {ImportRow,Student} from './types';
import {sourceMoney} from './money';
type Section=[number,number,string,Student['status'],number|null];
const layout:Record<string,Section[]>={
 'BCA':[[4,28,'AI','active',8],[32,43,'Cyber Security','active',8],[46,48,'Without add-on','no-addon',null],[52,54,'','discontinued',null]],
 'B.com':[[4,6,'Aviation','active',8],[9,12,'CMA','active',8],[15,17,'Logistics','active',8],[29,35,'Package','active',null],[47,55,'College fees','active',null]],
 'BBA':[[4,13,'Logistics','active',9],[18,26,'Aviation','active',9],[29,30,'Hospital and Health Care','active',9],[33,36,'Unspecified — verify','active',null]],
 'FASHION DESIGNING':[[3,14,'','active',null]],'BSW':[[3,9,'','active',null]],'MSW':[[3,10,'','active',null]],'MSC PSYCOLOGY':[[3,26,'','active',null]],'BSC PHYCOLOGY':[[3,14,'','active',null]]
};
function cellValue(v:ExcelJS.CellValue):unknown{
 if(v&&typeof v==='object'){
  if('richText' in v) return v.richText.map(t=>t.text).join('');
  if('text' in v) return v.text;
  throw new Error('Formula or unsupported cell. Verify this entry manually.');
 }
 return v;
}
export async function parseWorkbook(data:Buffer):Promise<ImportRow[]>{
 const w=new ExcelJS.Workbook();await w.xlsx.load(data as never);
 if(Object.keys(layout).some(s=>!w.getWorksheet(s))) throw new Error('Expected the original MCC workbook with all eight sheets.');
 const result:ImportRow[]=[];
 for(const [sheet,sections] of Object.entries(layout)){
  const s=w.getWorksheet(sheet)!;
  for(const [start,end,specialization,status,col2] of sections) for(let row=start;row<=end;row++){
   const rawName=cellValue(s.getCell(row,sheet==='BSC PHYCOLOGY'?1:2).value);
   if(!rawName) continue;
   const rec:ImportRow={key:`${sheet}:${row}`,name:String(rawName).trim(),course:sheet,specialization,status,source:`${sheet} row ${row}`,warnings:[],fees:[]};
   if(String(s.getCell(row,7).value).toLowerCase().includes('discontinued')) rec.status='discontinued';
   for(const [semester,col] of [[1,3],[2,col2]] as [number,number|null][]){
    if(!col||['BSW','MSW','MSC PSYCOLOGY','BSC PHYCOLOGY'].includes(sheet)||status==='discontinued') continue;
    try{
     const [amount,college,our,stated]=[0,1,2,3].map(offset=>sourceMoney(cellValue(s.getCell(row,col+offset).value)));
     if(amount===null){if(college!==null||our!==null)rec.warnings.push(`Sem ${semester}: collections have no assigned fee; not imported.`);continue;}
     const balancePaise=amount-(college??0)-(our??0);
     if(stated!==null&&stated!==balancePaise)rec.warnings.push(`Sem ${semester}: stated balance ₹${stated/100} differs from calculated ₹${balancePaise/100}.`);
     if(college===null||our===null)rec.warnings.push(`Sem ${semester}: blank account entry means no recorded payment; verify.`);
     if(balancePaise<0)rec.warnings.push(`Sem ${semester}: excess payment / credit ₹${-balancePaise/100}.`);
     rec.fees.push({semester,amountPaise:amount,collegePaise:college??0,ourPaise:our??0,balancePaise});
    }catch{rec.warnings.push(`Sem ${semester}: unsupported amount or formula; fee not imported.`);}
   }
   if(!rec.fees.length)rec.warnings.push('Student only. Fee information needs manual setup.');
   result.push(rec);
  }
 }
 return result;
}
