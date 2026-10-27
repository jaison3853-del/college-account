import type {Account} from './types';
export function correctedTotals(totals:{collegePaise:number;ourPaise:number},old:{account:Account;amountPaise:number},next:{account:Account;amountPaise:number}){
 const result={...totals};
 result[old.account==='college'?'collegePaise':'ourPaise']-=old.amountPaise;
 result[next.account==='college'?'collegePaise':'ourPaise']+=next.amountPaise;
 if(Object.values(result).some(n=>!Number.isSafeInteger(n)||n<0))throw new Error('Account totals require reconciliation.');
 return result;
}
