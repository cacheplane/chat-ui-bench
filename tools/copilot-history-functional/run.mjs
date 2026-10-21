import fs from 'node:fs';
import {resolve,join,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {performance} from 'node:perf_hooks';
import {randomUUID} from 'node:crypto';
import {here,sourceRoot,sha,boundedRead,preflight} from './instrument.mjs';
import {retainBuild,recheckBuildInputs,validateEmittedImports,requiredStaticOutputs,unpackNodeInputs} from './build.mjs';
import {captureCase,inventory,writeClosed} from '../copilot-module-binding/run.mjs';
import {runFunctionalCase} from './driver.mjs';
const toolFiles=['adapter.mjs','instrument.mjs','build.mjs','run.mjs','driver.mjs','returns.mjs','policy.mjs','server-transform.mjs','server-entry.ts','source-pins.json','profile.json','conformance.node.mjs','portability.node.mjs','lifecycle.node.mjs','commit-sites.node.mjs','README.md'];
export function parseArgs(args){let mode='preflight',declared=false,out,runId,profile;for(let i=0;i<args.length;i++){const a=args[i];if(['--browser','--preflight','--test'].includes(a)){if(declared)throw Error('arguments');declared=true;mode=a.slice(2);}else if(a==='--out'){if(out)throw Error('arguments');out=args[++i];if(typeof out!=='string'||!isAbsolute(out)||resolve(out)!==out)throw Error('output-path');}else if(a==='--run-id'){if(runId)throw Error('arguments');runId=args[++i];if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(runId??''))throw Error('run-id');}else if(a==='--profile'){if(profile||args[++i]!=='warm-h100-v1')throw Error('arguments');profile='warm-h100-v1';}else throw Error('arguments');}if(mode==='preflight'&&(out||runId))throw Error('arguments');return profile?{mode,out,runId,profile}:{mode,out,runId};}
export function prepare(actual={node:process.versions.node,v8:process.versions.v8,platform:process.platform,arch:process.arch,execPath:process.execPath},profile){
 if(profile!==undefined&&profile!=='warm-h100-v1')throw Error('profile');
 if(!/^24\./.test(actual.node)||!['linux','darwin'].includes(actual.platform))throw Error('runtime');
 const sources=preflight();const fingerprints=[...toolFiles,...(profile?['warm-runtime.mjs','warm-runtime.node.mjs','warm-baseline.mjs','warm-baseline.node.mjs','warm-selector.mjs','warm-selector.node.mjs','warm-controller.mjs','warm-controller.node.mjs','warm-profile.json']:[]),...['run.mjs','build.mjs','instrument.mjs','profile.json','source-pins.json'].map(n=>'../copilot-module-binding/'+n)].map(path=>{const raw=boundedRead(resolve(here,path),262144);return {path,bytes:raw.length,sha256:sha(raw)};});
 const controls=sources.filter(p=>/^node_modules\/(playwright|playwright-core|esbuild)\//.test(p.path));if(controls.length>16||controls.reduce((n,p)=>n+p.bytes,0)>16777216)throw Error('runtime-control-limit');
 const browserRevisions=JSON.parse(boundedRead(resolve(sourceRoot,'node_modules/playwright-core/browsers.json'),65536)).browsers.filter(b=>b.name==='chromium'||b.name==='chromium-headless-shell');
 return {runtime:actual,runtimeControls:controls,browserRevisions,sources,fingerprints,profileSha256:sha(boundedRead(resolve(here,profile?'warm-profile.json':'profile.json'),65536)),...(profile?{selectedProfile:profile}:{}),vendorExecuted:false};
}

export function replayBuild(out,profile){
 const raw=boundedRead(resolve(out,'build.json'),8388608),build=JSON.parse(raw);
 if((build.browser.selectedProfile??undefined)!==profile)throw Error('build-profile');recheckBuildInputs(build.browser);
 for(const input of unpackNodeInputs(build.server.inputs)){const b=boundedRead(resolve(sourceRoot,input.path),8388608);if(b.length!==input.bytes||sha(b)!==input.sha256)throw Error('server-source-drift');}
 const outputs=build.browser.emitted.map(f=>({...f,contents:boundedRead(resolve(out,f.name),8388608)}));
 for(const f of outputs)if(f.contents.length!==f.bytes||sha(f.contents)!==f.sha256)throw Error('emitted-drift');
 validateEmittedImports({receipt:build.browser,outputs});
 const node=boundedRead(resolve(out,'server.cjs'),8388608);if(node.length!==build.server.bytes||sha(node)!==build.server.sha256)throw Error('server-emitted-drift');
 return {build,sha256:sha(raw)};
}
async function runCase(context){
 const remaining=Number(BigInt(context.expiresNs)-process.hrtime.bigint())/1e6,startTick=process.hrtime.bigint(),before=prepare(undefined,context.profile);
 if(remaining<=20000||JSON.stringify(before)!==JSON.stringify(context.before)||sha(boundedRead(resolve(context.out,'request.json'),65536))!==context.requestSha256)throw Error('case-source-or-intent');
 await retainBuild(context.out,{existing:true,profile:context.profile});replayBuild(context.out,context.profile);
 const result=await runFunctionalCase({out:context.out,nonce:context.nonce,runId:context.runId,sourceBefore:before,sourceCheck:()=>prepare(undefined,context.profile),profileName:context.profile,startTick,budget:Math.min(160000,Math.floor(remaining))});
 process.stdout.write(JSON.stringify({kind:'copilot-history-functional-case-v1',runId:context.runId,status:result.status,reason:result.reason})+'\n');process.exitCode=result.status==='C-staging-pending-outer'?0:1;
}
export async function main(args){
 const options=parseArgs(args);if(options.mode==='preflight')return {status:'prepared',...prepare(undefined,options.profile),vendorExecuted:false,outputWritten:false};if(options.mode==='test')return runFunctional(options);
 const start=performance.now(),deadline=start+160000,expiresNs=(process.hrtime.bigint()+160000000000n).toString(),before=prepare(undefined,options.profile),runId=options.runId??randomUUID();
 const out=options.out??join(fs.mkdtempSync(join(tmpdir(),'copilot-history-functional-')),'run');fs.mkdirSync(out,{mode:0o700});
 const nonce=randomUUID(),request={kind:'copilot-history-functional-request-v1',runId,mode:'explicit-browser-one-attempt',sourceBefore:before,...(options.profile?{profile:options.profile}:{}),qualification:false,performance:false};
 const requestRef=writeClosed(resolve(out,'request.json'),Buffer.from(JSON.stringify(request)+'\n'),65536);
 const env=Object.fromEntries(['HOME','TMPDIR','PATH'].filter(k=>process.env[k]!==undefined).map(k=>[k,process.env[k]]));env.LC_ALL='C';env.COPILOTKIT_TELEMETRY_DISABLED='1';env.DO_NOT_TRACK='1';env.MODULE_BINDING_NONCE=nonce;env.__context={out,runId,expiresNs,before,...(options.profile?{profile:options.profile}:{}),requestSha256:requestRef.sha256};
 const observed=await captureCase([process.execPath,fileURLToPath(import.meta.url),'--browser','--case'],{out,deadline,env,nonce}),{stdout,...original}=observed;
 let reason=observed.failure,inner=null,phase=null;
 try{
  const summary=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(stdout));if(summary.kind!=='copilot-history-functional-case-v1'||summary.runId!==runId||summary.status!=='C-staging-pending-outer')throw Error('case-unavailable');
  inner=JSON.parse(boundedRead(resolve(out,'closure.json'),262144));phase=JSON.parse(boundedRead(resolve(out,'phase.json'),262144));
  if(inner.status!=='C-staging-pending-outer'||phase.status!=='C-staging-pending-outer'||inner.reason||phase.reason||!inner.sourcePinsMatch||!inner.withinDeadline||inner.process.forcedContainment!==false||!Object.values(inner.cleanup).every(v=>v===true)||!phase.closure.positive||!phase.closure.invalidated)throw Error('inner-unavailable');
  for(const fact of inner.inventory){const b=boundedRead(fact.path,8388608);if(fact.path!==resolve(out,fact.path.split('/').at(-1))||b.length!==fact.bytes||sha(b)!==fact.sha256)throw Error('inner-inventory');}
  if(!observed.controllerGroupGone||!observed.browserGroupGone||!observed.profileGone)throw Error('outer-physical-closure');
  replayBuild(out,options.profile);
  // The inner static ledger independently proves its exact required graph and source bytes.
  if(phase.counts.staticClosure.staticClosureMatch!==true||phase.counts.staticClosure.postReadbackMatch!==true)throw Error('static-closure');
  if(JSON.stringify(prepare(undefined,options.profile))!==JSON.stringify(before))throw Error('source-drift');
 }catch(e){reason??=String(e.message).slice(0,512);}
 const prefix=inventory(out);if(prefix.files+1>640||prefix.bytes+65536>33554432)throw Error('outer-output-reservation');if(performance.now()>=deadline)reason??='deadline';
 const receipt={kind:'copilot-history-functional-receipt-v1',runId,status:reason?'unavailable':'observed',reason,original,sourceBefore:before,sourceAfter:prepare(undefined,options.profile),completedPrefix:{files:prefix.files,bytes:prefix.bytes,sha256:prefix.sha256},innerStatus:inner?.status??'unavailable',ownFuturePersistence:'join final terminal and original command exit',qualification:false,nativeGO:false,performance:false,scoring:false,ranking:false,fps:'unavailable'};
 writeClosed(resolve(out,'receipt.json'),Buffer.from(JSON.stringify(receipt)+'\n'),65536);const final=inventory(out);if(performance.now()>=deadline||JSON.stringify(prepare(undefined,options.profile))!==JSON.stringify(before))reason??='finalization-boundary-or-source';
 return {kind:'copilot-history-functional-terminal-v1',runId,status:reason?'unavailable':'observed',reason,output:out,inventory:final,withinOriginalBoundary:performance.now()<deadline,qualification:false,nativeGO:false,performance:false,scoring:false,ranking:false,fps:'unavailable'};
}
async function runFunctional(options){const start=performance.now(),deadline=start+120000,before=prepare(undefined,options.profile),runId=options.runId??randomUUID(),out=options.out??join(fs.mkdtempSync(join(tmpdir(),'copilot-history-functional-tests-')),'run');fs.mkdirSync(out,{mode:0o700});writeClosed(resolve(out,'intent.json'),Buffer.from(JSON.stringify({kind:'copilot-history-functional-functional-intent-v1',runId,source:before,browser:false})+'\n'),65536);const env=Object.fromEntries(['HOME','TMPDIR','PATH'].filter(k=>process.env[k]!==undefined).map(k=>[k,process.env[k]]));const {stdout,...original}=await captureCase([process.execPath,'--test','--test-concurrency=1','--test-timeout=30000',resolve(here,'conformance.node.mjs'),resolve(here,'portability.node.mjs'),resolve(here,'lifecycle.node.mjs'),resolve(here,'commit-sites.node.mjs'),...(options.profile?['warm-runtime.node.mjs','warm-selector.node.mjs','warm-baseline.node.mjs','warm-controller.node.mjs'].map(n=>resolve(here,n)):[])],{out,deadline,env});let reason=original.failure;if(JSON.stringify(prepare(undefined,options.profile))!==JSON.stringify(before))reason??='source-drift';if(performance.now()>=deadline)reason??='deadline';const prefix=inventory(out,95,8388608-65536);writeClosed(resolve(out,'receipt.json'),Buffer.from(JSON.stringify({kind:'copilot-history-functional-functional-prefix-v1',runId,status:reason?'unavailable':'closed',reason,original,completedPrefix:prefix,ownFuturePersistence:'not self-attested; join terminal and actual command exit',browser:false,qualification:false,performance:false})+'\n'),65536);const final=inventory(out,96,8388608);if(performance.now()>=deadline||JSON.stringify(prepare(undefined,options.profile))!==JSON.stringify(before))reason??='finalization-boundary-or-source';return {kind:'copilot-history-functional-functional-terminal-v1',status:reason?'unavailable':'closed',reason,runId,output:out,inventory:final,elapsedMs:performance.now()-start,browser:false,qualification:false,nativeGO:false,performance:false,scoring:false,ranking:false,fps:'unavailable'};}

if(process.argv[1]&&fs.realpathSync(resolve(process.argv[1]))===fileURLToPath(import.meta.url)){
 if(process.argv.slice(2).join(' ')==='--browser --case'){
  if(!process.send||!process.env.MODULE_BINDING_NONCE)throw Error('private-case-channel');
  process.once('message',context=>{if(context?.type!=='start'||context.nonce!==process.env.MODULE_BINDING_NONCE)throw Error('private-case-channel');runCase(context).catch(e=>{process.stderr.write('functional-case-refused: '+e.message+'\n');process.exitCode=1;}).finally(()=>{if(process.connected)process.disconnect();});});
 }else main(process.argv.slice(2)).then(result=>{process.stdout.write('COPILOT_HISTORY_FUNCTIONAL_TERMINAL '+JSON.stringify(result)+'\n');process.exitCode=['observed','prepared','closed'].includes(result.status)?0:1;},e=>{process.stderr.write('copilot-history-functional-refused: '+e.message+'\n');process.exitCode=1;});
}
