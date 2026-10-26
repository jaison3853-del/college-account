import type { Fee } from './types';
export function toPaise(input:string|number):number {
  const s=String(input).trim();
  if(!/^\d+(?:\.\d{1,2})?$/.test(s)) throw new Error('Enter an amount with at most two decimal places.');
  const [whole,part='']=s.split('.');
  const n=Number(whole)*100+Number(part.padEnd(2,'0'));
  if(!Number.isSafeInteger(n)||n>100_000_000_00) throw new Error('Amount is too large.');
  return n;
}
export function sourceMoney(input:unknown):number|null {
  if(input===null||input===undefined||String(input).trim()==='') return null;
  const s=String(input).trim().toLowerCase();
  if(['nil','nill'].includes(s)) return 0;
  return s.split('+').reduce((n,x)=>n+toPaise(x.trim()),0);
}
export const balance=(f:Fee)=>f.amountPaise-f.concessionPaise-f.collegePaise-f.ourPaise;
export const rupees=(n:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(n/100);
export function totals(fees:Fee[]) {
  return fees.reduce((t,f)=>({net:t.net+f.amountPaise-f.concessionPaise,college:t.college+f.collegePaise,our:t.our+f.ourPaise,outstanding:t.outstanding+Math.max(balance(f),0),credit:t.credit+Math.max(-balance(f),0)}),{net:0,college:0,our:0,outstanding:0,credit:0});
}
export function csvCell(value:unknown):string {
  let s=String(value??'');
  if(/^[=+\-@\t\r]/.test(s)) s="'"+s;
  return '"'+s.replaceAll('"','""')+'"';
}
