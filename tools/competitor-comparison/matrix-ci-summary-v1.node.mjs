import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {matrixVerificationRoster,MATRIX_V3_LIMITS,MATRIX_V4_ACQUISITION} from './matrix-policy-v4.mjs';

const module=await import('./matrix-ci-summary-v1.mjs').catch(()=>({}));
const summary=value=>{assert.equal(typeof module.matrixCIFailureAnnotation,'function','bounded CI annotation function exists');return module.matrixCIFailureAnnotation(value);};
const id=matrixVerificationRoster()[0].id;
const generic='::error::matrix-case-failure details-not-published';
const invalid=(...args)=>({id,status:'invalid',failure:{message:args.length?args[0]:'matrix-active-history-phase'}});
const source=await readFile(new URL('./matrix-run-v4.mjs',import.meta.url),'utf8');

test('known roster failures expose only case ID, status and strict failure code',()=>{
 for(const slot of matrixVerificationRoster()){
  assert.equal(summary({...invalid(),id:slot.id}),`::error::matrix-case-failure id=${slot.id} status=invalid code=matrix-active-history-phase`);
  assert.equal(summary({id:slot.id,status:'unattempted',reason:'matrix-invocation-deadline'}),`::error::matrix-case-failure id=${slot.id} status=unattempted code=matrix-invocation-deadline`);
 }
});
test('successful positive and expected-negative cases produce no annotation',()=>{
 for(const status of ['matrix-pass','negative-pass'])assert.equal(summary({id,status}),null);
});
test('unsafe codes, huge strings and coercible objects never become annotation data',()=>{
 for(const message of ['matrix-code\n::error::private','matrix-code\n','matrix-code\rprivate','matrix-code%0Aprivate','matrix-'+'x'.repeat(101),'x'.repeat(100000),'matrix-雪','PRIVATE BODY',null,undefined,{toString(){throw Error('coercion');}}]){
  const output=summary(invalid(message));
  assert.equal(output,`::error::matrix-case-failure id=${id} status=invalid code=failure-code-not-published`);
  assert.ok(Buffer.byteLength(output)<=512);
 }
 assert.match(summary(invalid('matrix-'+'x'.repeat(100))),/code=matrix-x{100}$/);
});
test('malformed status and non-roster IDs close to a fixed generic annotation',()=>{
 for(const value of [null,undefined,1,{},[],{...invalid(),status:'PRIVATE'},{...invalid(),id:'matrix-private'},{...invalid(),id:id+'\n::error::private'},{...invalid(),id:'x'.repeat(100000)}])assert.equal(summary(value),generic);
});
test('own-data inspection never reads getters, inherited fields or private payloads',()=>{
 let reads=0;const get=()=>{reads++;throw Error('private getter');};
 for(const value of [
  Object.defineProperty(invalid(),'id',{get}),Object.defineProperty(invalid(),'status',{get}),
  Object.create(invalid()),
 ])assert.equal(summary(value),generic);
 for(const value of [Object.defineProperty(invalid(),'failure',{get}),invalid(Object.defineProperty({},'toString',{get})),{...invalid(),failure:Object.defineProperty({},'message',{get})}])assert.match(summary(value),/code=failure-code-not-published$/);
 const value=invalid();Object.defineProperties(value,{stack:{get},context:{get},trace:{get}});
 Object.defineProperties(value.failure,{stack:{get},expected:{get},actual:{get}});
 assert.match(summary(value),/code=matrix-active-history-phase$/);assert.equal(reads,0);
});
test('proxies including revoked proxies are rejected without invoking traps',()=>{
 let traps=0;const handler={get(){traps++;throw Error('trap');},getOwnPropertyDescriptor(){traps++;throw Error('trap');},getPrototypeOf(){traps++;throw Error('trap');}};
 const revoked=Proxy.revocable({},handler);revoked.revoke();
 for(const value of [new Proxy(invalid(),handler),revoked.proxy])assert.equal(summary(value),generic);
 assert.match(summary({...invalid(),failure:new Proxy({},handler)}),/code=failure-code-not-published$/);
 assert.equal(traps,0);
});
test('maintained onResult callback keeps original JSON and gates supplemental annotation to GitHub Actions',async()=>{
 const start=source.indexOf('onResult:async result=>{',source.indexOf('export async function runMatrixInvocation'));
 const end=source.indexOf('}});',start);
 assert.ok(start>0&&end>start);
 const body=source.slice(start+'onResult:async result=>{'.length,end);
 for(const github of [undefined,'false','TRUE','true']){
  const logs=[],result=invalid(),before=structuredClone(result);
  const callback=new Function('console','process','matrixCIFailureAnnotation',`return async result=>{${body}};`)({log:value=>logs.push(value)},{env:{GITHUB_ACTIONS:github}},module.matrixCIFailureAnnotation);
  await callback(result);
  assert.deepEqual(result,before);
  assert.equal(logs[0],JSON.stringify({id,status:'invalid',failure:result.failure,FPS:null}));
  assert.equal(logs.length,github==='true'?2:1);
  if(github==='true')assert.equal(logs[1],summary(result));
 }
});
test('annotation callback cannot turn an invalid roster execution into a complete invocation',async()=>{
 const start=source.indexOf('export async function runMatrixRoster('),end=source.indexOf('/** Capture first;',start);
 assert.ok(start>=0&&end>start);
 const runMatrixRoster=new Function('LIMITS','MATRIX_V4_ACQUISITION',`${source.slice(start,end).replace('export ','')} return runMatrixRoster;`)(MATRIX_V3_LIMITS,MATRIX_V4_ACQUISITION);
 const result=invalid(),execution=await runMatrixRoster({slots:[matrixVerificationRoster()[0]],invocationStarted:0,now:()=>0,execute:async()=>result,onResult:async value=>{summary(value);}});
 assert.equal(execution.complete,false);assert.equal(execution.results[0],result);assert.equal(result.status,'invalid');
});
