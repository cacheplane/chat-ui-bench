import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import cp from 'node:child_process';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';
import {writeClosed,verifyOriginals,verifyOwnedFile} from './prepare.mjs';
import * as supervisor from './run.mjs';

const require=createRequire(import.meta.url),{parseAst}=require('rolldown/parseAst');
const release='source-reviewed-native-chat-stock-033-v2';
const product={schemaVersion:1,id:'threadplane-stock-0.3.3',basePackage:'@threadplane/chat@0.3.3'};
const withRelease=async(value,action)=>{const previous=process.env.NATIVE_REAL_CHAT_ONCE_RELEASE;process.env.NATIVE_REAL_CHAT_ONCE_RELEASE=value;try{return await action();}finally{if(previous===undefined)delete process.env.NATIVE_REAL_CHAT_ONCE_RELEASE;else process.env.NATIVE_REAL_CHAT_ONCE_RELEASE=previous;}};

test('stock033 v2 acquisition has a separate maintained library and CLI entry',async()=>{
 assert.equal(typeof supervisor.runStock033OriginalV2,'function');
 const source=await fs.readFile(new URL('./run.mjs',import.meta.url),'utf8');
 assert(source.includes('--prepared-stock-033-v2'));
});

test('source-extracted CLI selects only the requested acquisition family',async()=>{
 const source=await fs.readFile(new URL('./run.mjs',import.meta.url),'utf8'),tree=parseAst(source),entry=tree.body.at(-1);assert.equal(entry.type,'IfStatement');
 const body=source.slice(entry.consequent.start,entry.consequent.end);
 for(const [flag,expected]of [['--prepared','original'],['--prepared-idle-host-css-v1','idle'],['--prepared-stock-033-v1','stock-v1'],['--prepared-stock-033-v2','stock-v2']]){
  let calls=0,finish;const completed=new Promise(resolve=>finish=resolve),template={authored:'template'},reference={authored:'reference'},root='/authored-root',refPath='/authored-reference';
  const readFixed=async(filename,cap)=>{assert.equal(cap,4096);assert([root+'/template.json',refPath].includes(filename));return Buffer.from(JSON.stringify(filename===refPath?reference:template));};
  const select=family=>async(actualRoot,actualTemplate,actualReference)=>{calls++;assert.equal(family,expected);assert.equal(actualRoot,root);assert.deepEqual(actualTemplate,template);assert.deepEqual(actualReference,reference);return {authored:true,family};};
  const process={argv:['node','/authored-run',flag,root,'--reference',refPath],stdout:{write(text){finish(JSON.parse(text));}},stderr:{write(text){finish({error:text});}}};
  Function('process','readFixed','runOriginal','runIdleHostOriginal','runStock033Original','runStock033OriginalV2','unavailable',body)(process,readFixed,select('original'),select('idle'),select('stock-v1'),select('stock-v2'),()=>Error('authored refusal'));
  assert.deepEqual(await completed,{authored:true,family:expected});assert.equal(calls,1);
 }
});

test('production v2 refuses releases, foreign or authored references, and unsafe roots before fork',async()=>{
 assert.equal(typeof supervisor.runStock033OriginalV2,'function');
 const fork=cp.fork;let forks=0,traps=0;cp.fork=()=>{forks++;throw Error('unexpected fork');};
 const hostile=new Proxy({},{get(){traps++;throw Error('proxy');},ownKeys(){traps++;throw Error('proxy');}});
 try{
  for(const value of ['', 'source-reviewed-native-chat-v1','source-reviewed-native-chat-stock-033-v1','source-reviewed-native-chat-idle-host-css-v1'])await withRelease(value,()=>assert.rejects(supervisor.runStock033OriginalV2('/unused',hostile,hostile),/native-chat-supervisor-unavailable/));
  await withRelease(release,async()=>{
   for(const root of ['relative','/tmp/../unused','/'+ 'x'.repeat(257),null])await assert.rejects(supervisor.runStock033OriginalV2(root,hostile,hostile));
   for(const policy of ['source-owned-preparation-reference-v1','source-owned-preparation-reference-stock-033-v1','source-owned-preparation-reference-idle-host-css-v1','authored-preparation-reference-stock-033-v2','source-owned-preparation-reference-stock-033-v2'])await assert.rejects(supervisor.runStock033OriginalV2('/unused',{}, {policy}));
   await assert.rejects(supervisor.runStock033OriginalV2('/unused',hostile,hostile));
  });
  assert.equal(forks,0);assert.equal(traps,0);
 }finally{cp.fork=fork;}
});

// This controls the exact current alias/supervisor function bodies, not native
// provenance. Only the verifier is an authored stand-in; real owned file joins
// and the exact maintained runCore execute against tiny physical source files.
async function authored(action,{nonzero=false,removeSource=false,verificationFailure=false}={}){
 const root=await fs.realpath(await fs.mkdtemp(tmpdir()+'/stock033-v2-acquisition-'));
 try{
  await fs.mkdir(root+'/inputs');const sourceFact=await writeClosed(root+'/source',Buffer.from('authored source'),64),archiveFact=await writeClosed(root+'/inputs/source',Buffer.from('authored source'),64);
  const manifest={mode:'authored-supervisor-control-only',records:[{key:'source',source:root+'/source',...sourceFact,archivedIdentity:archiveFact.identity}],owned:[],platform:[],roster:{contract:'authored-control-only'}};
  const manifestFact=await writeClosed(root+'/app-manifest.json',Buffer.from(JSON.stringify(manifest)+'\n'),4096);
  const template={mode:'real-chat-history100-stock-033-v2',root,nonce:'a'.repeat(32),runtime:{authoredControl:true},assets:[],fixture:{authoredControl:true},history:{authoredControl:true},manifest:manifestFact,product};
  const reference={policy:'source-owned-preparation-reference-stock-033-v2',product,manifest:manifestFact,template:await writeClosed(root+'/template.json',Buffer.from(JSON.stringify(template)+'\n'),4096)};
  const text=await fs.readFile(new URL('./run.mjs',import.meta.url),'utf8'),tree=parseAst(text),names=['processIdentity','absent','runCore','runStock033OriginalV2'];
  const bodies=names.map(name=>{const node=tree.body.flatMap(n=>n.type==='ExportNamedDeclaration'?[n.declaration]:[n]).find(n=>n?.type==='FunctionDeclaration'&&n.id?.name===name);assert(node,'exact maintained function '+name);return text.slice(node.start,node.end);}).join('\n');
  let forks=0,verifications=0,request=null,requestFact=null,environment=null,projectionError=null;
  const authoredCp={execFileSync(_command,args){const pid=Number(args[2]);return `${pid} ${pid===123?process.pid:123} ${pid} Mon Oct 1 00:00:00 2026\n`;},fork(_module,args,options){
   forks++;environment=options.env;requestFact=JSON.parse(args[1]);
   const child=new EventEmitter;Object.assign(child,{pid:123,exitCode:null,stdout:new EventEmitter,stderr:new EventEmitter,kill(){return true;},send(_message,callback){callback?.();}});
   queueMicrotask(async()=>{try{const bytes=await fs.readFile(args[0]);request=JSON.parse(bytes);assert.equal(requestFact.bytes,bytes.length);if(removeSource)await fs.unlink(root+'/source');}catch(error){projectionError=error;}
    child.emit('message',{type:'browser-born',nonce:request?.nonce,pid:456});for(const stream of [child.stdout,child.stderr]){stream.emit('end');stream.emit('close');}child.emit('exit',nonzero?1:0,null);child.emit('close',nonzero?1:0,null);
   });return child;
  }};
  const authoredProcess={pid:process.pid,execPath:process.execPath,env:{...process.env,NATIVE_REAL_CHAT_ONCE_RELEASE:release},hrtime:process.hrtime,kill(_pid,signal){if(signal==='SIGKILL')return true;const error=Error('authored absent');error.code='ESRCH';throw error;}};
  const verify=async(actualRoot,actualTemplate,actualReference)=>{verifications++;assert.equal(actualRoot,root);assert.equal(actualTemplate,template);assert.equal(actualReference,reference);if(verificationFailure)throw Error('authored verifier refusal');return template;};
  const factory=Function('cp','fs','path','process','randomBytes','writeClosed','verifyOriginals','verifyOwnedFile','verifyStock033PreparationV2','HERE','unavailable',bodies+'\nreturn runStock033OriginalV2;');
  const run=factory(authoredCp,fs,path,authoredProcess,randomBytes,writeClosed,verifyOriginals,verifyOwnedFile,verify,'/authored-worker-source',()=>Error('native-chat-supervisor-unavailable'));
  await action({root,template,reference,run:()=>run(root,template,reference),facts:()=>({forks,verifications,request,requestFact,environment,projectionError})});
 }finally{await fs.rm(root,{recursive:true,force:true});}
}

test('source-extracted v2 alias verifies original handoff and preserves exact V6 request and v2 persisted family',()=>authored(async({root,template,reference,run,facts})=>{
 const result=await run(),f=facts();assert.equal(f.verifications,1);assert.equal(f.forks,1);assert.equal(f.projectionError,null);
 assert.deepEqual(Object.keys(f.request),['mode','root','nonce','runtime','assets','fixture','history','manifest','originNs']);assert.equal(f.request.mode,'real-chat-history100-v1');
 for(const key of ['runtime','assets','fixture','history','manifest'])assert.deepEqual(f.request[key],template[key]);
 assert.equal(f.request.root,root);assert.notEqual(f.request.nonce,template.nonce);assert.match(f.request.nonce,/^[a-f0-9]{32}$/);assert.equal(f.environment.NATIVE_REAL_CHAT_SOURCE_RELEASE,'source-reviewed-native-chat-v1');
 assert.equal(result.kind,'native-stock-033-result-v2');assert.equal(result.label,'Threadplane 0.3.3 (stock published packages)');assert.deepEqual(result.product,product);
 assert.deepEqual(result.preparation,{policy:reference.policy,template:reference.template,manifest:reference.manifest});assert.equal(result.nonce,f.request.nonce);assert.deepEqual(result.request,f.requestFact);
 assert.equal(result.status,'original-process-closed');assert.equal(result.sourceBookends.stable,true);assert.equal(result.exit.code,0);assert.equal(result.close.code,0);assert.equal(result.stdout.end,true);assert.equal(result.stdout.close,true);assert.equal(result.stderr.end,true);assert.equal(result.stderr.close,true);
 assert.equal(result.captureDeadlineMs,17000);assert.equal(result.cleanupAndFinalizationDeadlineMs,19000);assert.equal(result.authority.nativeSupported,false);assert.equal(result.authority.FPS,null);
 const saved=JSON.parse(await fs.readFile(root+'/outer.json'));assert.equal(saved.kind,result.kind);assert.equal(saved.preparation.policy,reference.policy);assert.equal(saved.status,'candidate-process-closed');assert.equal(saved.terminalReceiptWrite,'pending');assert.equal(result.terminalReceiptWrite,'fulfilled');
}));
test('source-extracted v2 verifier rejection prevents request and child dispatch',()=>authored(async({root,run,facts})=>{
 await assert.rejects(run());assert.equal(facts().forks,0);assert.equal(facts().verifications,1);await assert.rejects(fs.stat(root+'/request.json'),{code:'ENOENT'});
},{verificationFailure:true}));
for(const [fault,options]of [['nonzero original exit',{nonzero:true}],['changed original source',{removeSource:true}]])test('source-extracted v2 '+fault+' retains unavailable v2 family after browser IPC',()=>authored(async({root,run,facts})=>{
 await assert.rejects(run());assert.equal(facts().forks,1);const saved=JSON.parse(await fs.readFile(root+'/outer.json'));assert.equal(saved.kind,'native-stock-033-result-v2');assert.equal(saved.status,'unavailable');assert.equal(saved.authority.nativeSupported,false);assert.equal(saved.authority.FPS,null);if(options.removeSource)assert.equal(saved.sourceBookends.stable,false);
},options));
