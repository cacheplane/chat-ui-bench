// Hosted-only original command owner. Syntax-check locally; never invoke locally.
import {spawn} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {readIntegratedAdmission} from '../tests/support/hosted-copilot-context.ts';
import {assertOriginalCommand} from '../tests/support/hosted-copilot-contract.ts';
import {capturedStreamComplete,assertFullAudit,assertExpectedAudit,assertExpectedVendor,classifyVendorDiagnostics} from '../tests/support/hosted-copilot-production-policy.ts';
const order=['profile','install','audit','audit-high','contract','consumer','controls','helpers','vendor','build','inspect'];
const commands={profile:['--version'],install:['ci','--ignore-scripts','--no-audit','--no-fund'],audit:['audit','--json'],'audit-high':['audit','--audit-level=high','--json'],contract:['run','build','--workspace','@chat-ui-bench/contract'],consumer:['run','typecheck','--workspace','@chat-ui-bench/copilotkit'],controls:['run','typecheck:controls','--workspace','@chat-ui-bench/copilotkit'],helpers:['exec','--','tsc','-p','tests/tsconfig.copilot-production.json','--noEmit'],vendor:['run','typecheck:vendor','--workspace','@chat-ui-bench/copilotkit'],build:['run','build:hosted','--workspace','@chat-ui-bench/copilotkit']};
const step=process.argv[2];
if(process.argv.length!==3||!order.includes(step)) throw new Error('Fixed original hosted step required');
const admission=readIntegratedAdmission(),directory=admission.artifactDirectory;
for(const prior of order.slice(0,order.indexOf(step))) {
 const raw=await readFile(join(directory,`step-${prior}-result.json`),'utf8');if(Buffer.byteLength(raw)>256*1024) throw new Error('Prior step receipt bound');
 const receipt=JSON.parse(raw);if(receipt.policyAccepted!==true||receipt.sourceSha!==admission.source.commitSha) throw new Error('Original prior hosted outcome absent');
}
await writeFile(join(directory,`step-${step}-started.json`),JSON.stringify({step,sourceSha:admission.source.commitSha,qualification:false,originalClosed:false,startUtc:new Date().toISOString()})+'\n',{flag:'wx'});
if(step==='inspect') {
 try {
  const mappingRaw=await readFile(join(directory,'build-mappings.json'));if(mappingRaw.length>4*1024*1024) throw new Error('Original mapping evidence bound');
  const {inspectStaticAssets}=await import('../tests/support/hosted-copilot-static-assets.ts');
  const result=await inspectStaticAssets({outputRoot:admission.outputDirectory,hookFiles:JSON.parse(mappingRaw.toString('utf8'))});
  const text=JSON.stringify(result);if(Buffer.byteLength(text)>8*1024*1024) throw new Error('Static evidence result byte bound');
  await writeFile(join(directory,'static-assets.json'),text+'\n',{flag:'wx'});
  readIntegratedAdmission();
  await writeFile(join(directory,'step-inspect-result.json'),JSON.stringify({step,sourceSha:admission.source.commitSha,policyAccepted:true,originalClosed:true,qualification:false,scope:'supported static parser result only; root/peer artifact qualification pending',closedUtc:new Date().toISOString()})+'\n',{flag:'wx'});
 } catch(error) {
  await writeFile(join(directory,'step-inspect-result.json'),JSON.stringify({step,sourceSha:admission.source.commitSha,policyAccepted:false,qualification:false,reason:error instanceof Error?error.message.slice(0,512):'Static parser failure',closedUtc:new Date().toISOString()})+'\n',{flag:'wx'});throw error;
 }
} else {
 if(step==='build') {await mkdir(admission.outputDirectory);const value=await lstat(admission.outputDirectory);if(!value.isDirectory()||value.isSymbolicLink()) throw new Error('Fresh original output directory required');}
 const env={...process.env};delete env['GH_TOKEN'];delete env['GITHUB_TOKEN'];
 const started=performance.now(),deadline=['install','build'].includes(step)?300_000:60_000;
 const child=spawn('npm',commands[step],{cwd:admission.repositoryRoot,env,stdio:['ignore','pipe','pipe']});
 let spawned=false,spawnError=null,timedOut=false;child.once('spawn',()=>{spawned=true;});child.once('error',error=>{spawnError=error.name;});
 // One owned termination request is not closure. Wait for original close below.
 const timer=setTimeout(()=>{timedOut=true;child.kill('SIGTERM');},deadline);
 function capture(stream,name) {
  const sink=createWriteStream(join(directory,`step-${step}.${name}`),{flags:'wx'});let seen=0,retained=0,ended=false,error=false,finished=false,writerClosed=false;
  const closure=new Promise(resolve=>{sink.once('finish',()=>{finished=true;});sink.once('close',()=>{writerClosed=true;resolve();});});
  sink.on('error',()=>{error=true;stream.resume();});
  stream.on('data',chunk=>{seen+=chunk.length;if(error)return;retained+=chunk.length;if(!sink.write(chunk)){stream.pause();sink.once('drain',()=>stream.resume());}});
  stream.once('end',()=>{ended=true;sink.end();});stream.once('error',()=>{error=true;sink.end();});
  stream.once('close',()=>{if(!ended){error=true;sink.end();}});
  return {closure,facts:()=>({seen,retained,readableEOF:ended,writerFinish:finished,writerClose:writerClosed,writerError:error,overflow:seen>4*1024*1024})};
 }
 const stdout=capture(child.stdout,'stdout'),stderr=capture(child.stderr,'stderr');
 const closed=await new Promise(resolve=>child.once('close',(exitCode,signal)=>resolve({exitCode,signal,observedAtStepPerformanceMs:performance.now(),closedUtc:new Date().toISOString()})));clearTimeout(timer);
 await Promise.all([stdout.closure,stderr.closure]);
 async function retainedFacts(capture,name) {const facts=capture.facts();let retained=0,retainedBytesKnown=false;try {const stat=await lstat(join(directory,`step-${step}.${name}`));if(stat.isFile()&&!stat.isSymbolicLink()) {retained=stat.size;retainedBytesKnown=true;}}catch { /* Actual retained bytes are unavailable, never invented. */ }const actual={...facts,retained,retainedBytesKnown};return {...actual,complete:capturedStreamComplete(actual)};}
 const out=await retainedFacts(stdout,'stdout'),err=await retainedFacts(stderr,'stderr');
 if(performance.now()-started>deadline) timedOut=true;
 const original={...closed,stdoutBytes:out.seen,stderrBytes:err.seen,stdoutRetainedBytes:out.retained,stderrRetainedBytes:err.retained,closed:true,streamsComplete:out.complete&&err.complete};
 const result={step,sourceSha:admission.source.commitSha,argv:['npm',...commands[step]],original,spawned,spawnError,timedOut,originalCloseObserved:true,originalFileCloseObserved:out.writerClose&&err.writerClose,streamFacts:{stdout:out,stderr:err},descendantClosure:'unqualified',streamOverflow:out.overflow||err.overflow,durationMs:performance.now()-started,policyAccepted:false,qualification:false};
 try {
  if(!spawned||spawnError||timedOut||result.streamOverflow) throw new Error('Original command failed/late/overflow; no retry or closure substitution');
  const facts=assertOriginalCommand(original),outText=await readFile(join(directory,`step-${step}.stdout`),'utf8'),errText=await readFile(join(directory,`step-${step}.stderr`),'utf8');
  result.originalSuccess=facts.success;
  if(step==='profile') {if(!facts.success||outText.trim()!=='11.19.0') throw new Error('Original native npm profile differs');}
  else if(step==='audit') {
   const audit=JSON.parse(outText),counts=audit.metadata?.vulnerabilities;
   assertFullAudit(original,counts);
   result.originalSuccess=false;result.continuationScope='known original full audit failure only';
  } else if(step==='audit-high') {
   const previous=JSON.parse(await readFile(join(directory,'step-audit-result.json'),'utf8')),audit=JSON.parse(outText);
   assertExpectedAudit(previous.original,original,audit.metadata?.vulnerabilities);result.originalSuccess=facts.success;
  } else if(step==='vendor') {
   const diagnostics=classifyVendorDiagnostics(outText+'\n'+errText);assertExpectedVendor(original,diagnostics.owned,diagnostics.categories);
   result.diagnostics=diagnostics;result.originalSuccess=false;result.continuationScope='known original vendor declaration failure; consumer source accuracy boundary retained';
  } else if(!facts.success) throw new Error('Original required command non-success');
  if(step==='install') {
   const accepted=JSON.parse(await readFile(join(admission.repositoryRoot,'package-lock.json'),'utf8'));
   const hidden=JSON.parse(await readFile(join(admission.repositoryRoot,'node_modules/.package-lock.json'),'utf8'));let checked=0;
   for(const [path,value] of Object.entries(hidden.packages??{})) {
    const expected=accepted.packages?.[path];if(!expected||value.version!==expected.version||value.integrity!==expected.integrity||value.link!==expected.link) throw new Error('Actual installed identity/integrity differs from accepted lock');checked++;
   }
   const tools={parse5:'7.3.0',rolldown:'1.2.13',lightningcss:'1.33.0',vite:'8.3.4',typescript:'7.0.2'};
   const actual=[];
   for(const [name,version] of Object.entries(tools)) {
    const relative=`node_modules/${name}`,bytes=await readFile(join(admission.repositoryRoot,relative,'package.json'));
    const value=JSON.parse(bytes.toString('utf8'));if(value.name!==name||value.version!==version||hidden.packages?.[relative]?.version!==version||hidden.packages?.[relative]?.integrity!==accepted.packages?.[relative]?.integrity) throw new Error('Actual installed direct build/parser identity differs');
    actual.push({name,version,path:relative,integrity:accepted.packages[relative].integrity});
   }
   await writeFile(join(directory,'installed-profile.json'),JSON.stringify({sourceSha:admission.source.commitSha,checkedInstalledRecords:checked,tools:actual,scope:'actual locked identity/integrity metadata; executable compatibility remains unqualified'})+'\n',{flag:'wx'});
  }
  readIntegratedAdmission();result.policyAccepted=true;
 } catch(error) {result.reason=error instanceof Error?error.message.slice(0,512):'Original policy failed';}
 await writeFile(join(directory,`step-${step}-result.json`),JSON.stringify(result)+'\n',{flag:'wx'});
 console.log(JSON.stringify(result));if(!result.policyAccepted) process.exitCode=1;
}
