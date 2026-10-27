import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('Firebase server SDK loads without experimental CommonJS-to-ESM support',()=>{
 const result=spawnSync(process.execPath,['--no-experimental-require-module','-e',"for(const p of ['firebase-admin/app','firebase-admin/auth','firebase-admin/firestore']) require(p)"],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
});
