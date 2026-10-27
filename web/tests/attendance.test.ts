import {test} from 'node:test';
import assert from 'node:assert/strict';
import {attendanceSchema} from '../lib/attendance';
const input={id:'bfb6b6df-b646-430b-bcb0-272ad4c76723',date:'2026-10-27',course:'BCA',year:'2025-26',minutes:90,presentIds:['student1','student2']};
test('attendance keeps class duration and present students without generating absences',()=>{const a=attendanceSchema.parse(input);assert.equal(a.minutes,90);assert.deepEqual(a.presentIds,['student1','student2']);});
test('a conducted class can have no attendees',()=>{assert.equal(attendanceSchema.safeParse({...input,presentIds:[]}).success,true);});
test('duplicate students, invalid dates and impossible durations are rejected',()=>{for(const change of [{presentIds:['a','a']},{date:'2026-02-30'},{minutes:0},{minutes:1441},{minutes:1.5}])assert.equal(attendanceSchema.safeParse({...input,...change}).success,false);});
import {createAttendancePdf} from '../lib/attendance-pdf';
import {PDFDocument} from 'pdf-lib';
test('download report produces a multipage PDF for a large present list',async()=>{
 const bytes=await createAttendancePdf({...input,addon:'AI',topic:'Programming',createdAt:'2026-10-27T10:00:00Z',createdBy:'test',present:Array.from({length:80},(_,i)=>({id:String(i),name:'Student '+i,admissionNumber:'MCC-'+i}))});
 const pdf=await PDFDocument.load(bytes);assert.ok(pdf.getPageCount()>=3);
});
