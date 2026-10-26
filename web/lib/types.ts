export type Role = 'admin' | 'accountant' | 'viewer';
export type Account = 'college' | 'our';
export type Student = {id:string; admissionNumber:string; name:string; course:string; specialization:string; year:string; status:'active'|'discontinued'|'no-addon'; phone:string};
export type Fee = {id:string; studentId:string; semester:number; amountPaise:number; concessionPaise:number; collegePaise:number; ourPaise:number};
export type Payment = {id:string; studentId:string; feeId:string; account:Account; amountPaise:number; date:string|null; method:string; reference:string; historical:boolean; createdBy:string; createdAt:string};
export type Data = {students:Student[]; fees:Fee[]; payments:Payment[]; role:Role};
export type ImportRow = {key:string; name:string; course:string; specialization:string; status:Student['status']; source:string; warnings:string[]; fees:{semester:number;amountPaise:number;collegePaise:number;ourPaise:number;balancePaise:number}[]};
