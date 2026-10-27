import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readApiResponse} from '../lib/http';
test('empty and HTML server failures identify HTTP status',async()=>{
 await assert.rejects(()=>readApiResponse(new Response('',{status:502})),/empty response \(HTTP 502\)/);
 await assert.rejects(()=>readApiResponse(new Response('<html>Error</html>',{status:504})),/invalid response \(HTTP 504\)/);
});
test('JSON API errors and successful responses are preserved',async()=>{
 await assert.rejects(()=>readApiResponse(Response.json({error:'Role required'},{status:403})),/Role required/);
 assert.deepEqual(await readApiResponse(Response.json({role:'admin'})),{role:'admin'});
});
