import {test} from 'node:test';
import assert from 'node:assert/strict';
import {correctedTotals} from '../lib/correction';
import {commandSchema} from '../lib/schema';
test('moving a corrected payment reverses old account and credits new account',()=>{
 assert.deepEqual(correctedTotals({collegePaise:50000,ourPaise:20000},{account:'college',amountPaise:30000},{account:'our',amountPaise:25000}),{collegePaise:20000,ourPaise:45000});
});
test('same-account correction preserves other payments',()=>{
 assert.deepEqual(correctedTotals({collegePaise:50000,ourPaise:20000},{account:'college',amountPaise:30000},{account:'college',amountPaise:10000}),{collegePaise:30000,ourPaise:20000});
});
test('inconsistent balances cannot be silently overwritten',()=>{
 assert.throws(()=>correctedTotals({collegePaise:1,ourPaise:0},{account:'college',amountPaise:2},{account:'our',amountPaise:2}));
});
test('corrections require reason and concurrency version; historical dates can stay unknown',()=>{
 const c={action:'editPayment',paymentId:'p',feeId:'f',account:'our',amountPaise:100,date:null,method:'historical',reference:'',version:0,reason:'Correct allocation'};
 assert.equal(commandSchema.safeParse(c).success,true);
 assert.equal(commandSchema.safeParse({...c,reason:''}).success,false);
 assert.equal(commandSchema.safeParse({...c,version:undefined}).success,false);
});
