import {z} from 'zod';
const paise=z.number().int().min(0).max(100_000_000_00);
const text=(n:number)=>z.string().trim().min(1).max(n);
export const studentSchema=z.object({action:z.literal('student'),admissionNumber:text(60),name:text(180),course:text(100),specialization:z.string().trim().max(140).default(''),year:z.string().regex(/^\d{4}-\d{2}$/).default('2025-26'),status:z.enum(['active','discontinued','no-addon']).default('active'),phone:z.string().trim().max(25).default('')});
export const feeSchema=z.object({action:z.literal('fee'),studentId:text(100),semester:z.number().int().min(1).max(8),amountPaise:paise,concessionPaise:paise.default(0)}).refine(x=>x.concessionPaise<=x.amountPaise);
export const paymentSchema=z.object({action:z.literal('payment'),feeId:text(100),account:z.enum(['college','our']),amountPaise:paise.refine(x=>x>0),date:z.iso.date(),method:z.enum(['cash','bank','upi']),reference:z.string().trim().max(140).default(''),token:z.uuid()});
export const editPaymentSchema=paymentSchema.omit({action:true,token:true}).extend({action:z.literal('editPayment'),paymentId:text(100),version:z.number().int().min(0),date:z.iso.date().nullable(),method:z.enum(['cash','bank','upi','historical']),reason:text(300)});
export const deleteStudentSchema=z.object({action:z.literal('deleteStudent'),studentId:text(100)});
export const commandSchema=z.discriminatedUnion('action',[studentSchema,feeSchema,paymentSchema,editPaymentSchema,deleteStudentSchema]);
