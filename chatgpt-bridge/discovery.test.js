import {test} from 'node:test';
import assert from 'node:assert/strict';
Object.assign(process.env,{PUBLIC_URL:'https://bridge.example',OAUTH_ISSUER:'https://issuer.example/',OAUTH_JWKS_URL:'https://issuer.example/jwks',ALLOWED_SUBJECT:'owner',BSU_API_URL:'https://script.google.com/macros/s/test/exec',BSU_USERNAME:'reader',BSU_PASSWORD:'test-only'});
const {default:app}=await import('./server.js');
test('MCP discovery advertises OAuth; anonymous and invalid-token calls never read records',async()=>{
 const listener=app.listen(0,'127.0.0.1');
 await new Promise(resolve=>listener.once('listening',resolve));
 const url=`http://127.0.0.1:${listener.address().port}/mcp`;
 async function rpc(method,params,token){
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
 assert.equal(response.status,200);return (await response.json()).result;
 }
 try {
 const init=await rpc('initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'test',version:'1'}});assert.ok(init.capabilities.tools);
 const list=await rpc('tools/list',{});assert.equal(list.tools.length,5);
 for(const tool of list.tools){assert.deepEqual(tool.securitySchemes,[{type:'oauth2',scopes:['bsu:read']}]);
 for(const token of [undefined,'invalid-token']){
 const result=await rpc('tools/call',{name:tool.name,arguments:{}},token);assert.equal(result.isError,true);assert.match(result._meta['mcp/www_authenticate'][0],/error_description/);assert.equal(result.structuredContent,undefined);
 }}
 } finally {await new Promise(resolve=>listener.close(resolve));}
});
