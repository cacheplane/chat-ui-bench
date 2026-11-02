import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {validateMatrixProgress,validateMatrixReadinessSample} from './matrix-admission-v4.mjs';
import {historyPrefixCharacters} from './matrix-policy-v3.mjs';
const api=await import('./matrix-readiness-scalars-v5.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return{};throw error;});
const profiles=['threadplane','copilotkit','assistant-ui','vercel-ai-sdk'];
function context(profile='vercel-ai-sdk',h=100,r=6400){return {schema:2,profile,threadId:'thread',runId:'run',canonicalResponseId:'canonical',history:Array.from({length:h},(_,i)=>({id:'h'+i,role:i%2?'user':'assistant',text:String(i).padEnd(512,'x')})),workload:{seed:1,historyCount:h,responseBytes:r,deltaCount:200,deltaIntervalMs:50,journey:'history-reading'},digests:{sourceSha256:'0'.repeat(64),historySha256:'1'.repeat(64),responseSha256:'2'.repeat(64)}};}
const metadata=c=>({profile:c.profile,historyCount:c.history.length,responseBytes:c.workload.responseBytes,historicalIds:c.history.map(row=>row.id)});
function pair(c,n=512){return {progress:{schema:1,messageCount:c.history.length+1,responseId:'actual',responseCharacters:n,running:true,error:null,operation:{kind:c.profile==='assistant-ui'?'public-runtime-state-transition':'original-run-promise',status:'pending'}},response:{id:'actual',role:'assistant',text:'R'.repeat(n)}};}
const dom={schema:'matrix-dom-selected-v3',errors:[],items:[],clip:{left:0,top:0,right:100,bottom:100}};
const errorOf=fn=>{try{fn();return null;}catch(error){return error.message;}};
test('one self-contained factory executes identical Node and authored VM bytes',()=>{
 assert.equal(typeof api.createMatrixScalarClassifierV5,'function');
 const source=api.createMatrixScalarClassifierV5.toString();
 for(const profile of profiles)for(const h of [100,1000,10000])for(const r of [6400,262144]){
  const c=context(profile,h,r),m=metadata(c),classify=api.createMatrixScalarClassifierV5(m);
  const scope=vm.createContext({TextEncoder,serialized:JSON.stringify(m)}),browser=vm.runInContext(`(${source})(JSON.parse(serialized))`,scope);
  for(const n of [0,1,historyPrefixCharacters(r)-1,historyPrefixCharacters(r),r]){
   const p=pair(c,n);scope.serializedPair=JSON.stringify(p);
   assert.equal(classify(p.progress,p.response),n<historyPrefixCharacters(r)?'wait-prefix':'prefix-eligible');
   scope.classify=browser;assert.equal(vm.runInContext('(()=>{const p=JSON.parse(serializedPair);return classify(p.progress,p.response)})()',scope),classify(p.progress,p.response));
  }
 }
});
test('authored compound invalidities preserve exact V4 progress/response precedence at every prefix',()=>{
 assert.equal(typeof api.createMatrixScalarClassifierV5,'function');
 const mutations=[
  x=>delete x.progress.schema,x=>x.progress.extra=1,x=>Object.defineProperty(x.progress,'running',{get(){throw Error('getter invoked');},enumerable:true}),x=>Object.setPrototypeOf(x.progress,{bad:true}),
  x=>{x.progress.error='SDK';x.progress.operation.kind='bad';},x=>{x.progress.schema=2;x.response.role='user';},x=>x.progress.operation.extra=1,x=>x.progress.operation.kind='bad',x=>x.progress.operation.status='bad',
  x=>x.progress.messageCount=Number.MAX_SAFE_INTEGER+1,x=>x.progress.messageCount-=2,x=>x.progress.responseId='h0',x=>x.progress.responseCharacters=-1,(x,c)=>x.progress.responseCharacters=c.workload.responseBytes+1,
  x=>{x.progress.operation.status='rejected';x.response.role='user';},x=>x.progress.running=false,
  x=>x.response.extra=1,x=>delete x.response.id,x=>Object.setPrototypeOf(x.response,{id:'actual'}),x=>Object.defineProperty(x.response,'text',{get(){throw Error('getter invoked');},enumerable:true}),x=>x.response.role='user',x=>x.response.id='other',x=>x.response.text+='!',x=>x.response.text=null,
  x=>{x.progress.messageCount-=1;x.progress.responseId=null;x.progress.responseCharacters=null;},
 ];
 for(const profile of profiles)for(const h of [100,1000,10000])for(const r of [6400,262144]){
  const c=context(profile,h,r),classify=api.createMatrixScalarClassifierV5(metadata(c));
  const scope=vm.createContext({TextEncoder,serialized:JSON.stringify(metadata(c))});
  scope.classify=vm.runInContext(`(${api.createMatrixScalarClassifierV5.toString()})(JSON.parse(serialized))`,scope);
  for(const n of [0,1,historyPrefixCharacters(r)])for(const mutate of mutations){
   const x=pair(c,n);mutate(x,c);
   const expected=errorOf(()=>validateMatrixReadinessSample(c,{schema:'matrix-current-sample-v3',...x,dom}));
   assert.ok(expected,'mutation must be invalid');assert.equal(errorOf(()=>classify(x.progress,x.response)),expected);
   // Transfer descriptors/prototypes without invoking getters or JSON-cloning
   // malformed inputs: recreate this authored mutation in the VM's own realm.
   scope.caseSource=`(${mutate.toString()})`;scope.rawPair=JSON.stringify(pair(c,n));scope.rawContext=JSON.stringify({workload:c.workload});
   assert.equal(vm.runInContext(`(()=>{const x=JSON.parse(rawPair),c=JSON.parse(rawContext);eval(caseSource)(x,c);try{classify(x.progress,x.response);return null;}catch(error){return error.message;}})()`,scope),expected);
  }
 }
});
test('historical identity construction occurs only once per factory and never on the hot classifier path',()=>{
 const m=metadata(context()),scope=vm.createContext({TextEncoder,serialized:JSON.stringify(m)});
 vm.runInContext('var setConstructions=0,setAdds=0;var OriginalSet=Set;Set=class extends OriginalSet{constructor(...args){super(...args);setConstructions++;}add(value){setAdds++;return super.add(value);}};',scope);
 scope.classify=vm.runInContext(`(${api.createMatrixScalarClassifierV5.toString()})(JSON.parse(serialized))`,scope);
 scope.rawPair=JSON.stringify(pair(context()));vm.runInContext('var p=JSON.parse(rawPair);for(let i=0;i<80;i++)classify(p.progress,p.response);',scope);
 assert.equal(scope.setConstructions,1);assert.equal(scope.setAdds,100);
});
test('only valid active short/null states wait; idle/fulfilled/error remain terminal',()=>{
 const c=context(),classify=api.createMatrixScalarClassifierV5(metadata(c));
 for(const idPresent of [false,true]){const x=pair(c);x.response=null;if(!idPresent)Object.assign(x.progress,{messageCount:100,responseId:null,responseCharacters:null});assert.equal(classify(x.progress,x.response),'wait-prefix');}
 for(const status of ['idle','fulfilled']){const x=pair(c);x.progress.running=false;x.progress.operation.status=status;if(status==='idle'){x.response=null;Object.assign(x.progress,{messageCount:100,responseId:null,responseCharacters:null});}validateMatrixProgress(c,x.progress);assert.throws(()=>classify(x.progress,x.response),/matrix-active-history-phase/);}
 const x=pair(c);x.response=null;x.progress.messageCount=100;assert.equal(errorOf(()=>classify(x.progress,x.response)),'matrix-progress-no-response');
});
test('metadata refuses accessors, inherited/extra fields, holes, duplicates, and oversized IDs before serialization',()=>{
 const c=context();
 for(const mutate of [x=>x.extra=1,x=>delete x.profile,x=>x.profile='unknown',x=>x.historyCount=99,x=>x.responseBytes=6401,x=>delete x.historicalIds[0],x=>x.historicalIds[0]='',x=>x.historicalIds[0]='a'.repeat(129),x=>x.historicalIds[1]=x.historicalIds[0],x=>Object.setPrototypeOf(x,{}),x=>Object.defineProperty(x.historicalIds,'0',{get(){throw Error('getter invoked');},enumerable:true})]){const m=metadata(c);mutate(m);assert.throws(()=>api.createMatrixScalarClassifierV5(m),error=>error.message!=='getter invoked');}
 // Worst escaped bounded identifiers fit the preregistered 8MiB transport cap.
 const m={profile:'threadplane',historyCount:10000,responseBytes:262144,historicalIds:Array.from({length:10000},(_,i)=>String(i).padStart(5,'0')+'\u0000'.repeat(123))};
 assert.ok(new TextEncoder().encode(JSON.stringify(m)).byteLength<8388608);assert.equal(typeof api.createMatrixScalarClassifierV5(m),'function');
});
