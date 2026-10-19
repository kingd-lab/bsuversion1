import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSource} from './source.js';
const config={url:'https://script.google.com/macros/s/example/exec',username:'reader',password:'secret'};
test('rejects mutations before making any network request',async()=>{
 let calls=0; const read=createSource(config,async()=>{calls++;});
 await assert.rejects(read('submitExpense')); assert.equal(calls,0);
});
test('rejects Admin credentials before reading records',async()=>{
 let calls=0; const read=createSource(config,async()=>{calls++;return {ok:true,json:async()=>({success:true,role:'Admin',token:'t'})};});
 await assert.rejects(read('getExpenses'));assert.equal(calls,1);
});
test('uses POST body and reuses a Boss session for allowed reads',async()=>{
 const bodies=[]; const read=createSource(config,async(url,options)=>{
 assert.equal(options.method,'POST');assert.equal(new URL(url).search,'');
 const body=JSON.parse(options.body);bodies.push(body);
 return {ok:true,json:async()=>body.action==='login'?{success:true,role:'Boss',token:'t'}:{expenses:[]}};
 });
 await read('getExpenses');await read('getSites');assert.equal(bodies.length,3);assert.equal(bodies[1].token,'t');
});
test('source errors do not leak upstream messages or credentials',async()=>{
 const read=createSource(config,async()=>({ok:true,json:async()=>({error:'private secret'})}));
 await assert.rejects(read('getExpenses'),{message:'Source request rejected'});
});
