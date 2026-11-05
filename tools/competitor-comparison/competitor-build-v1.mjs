import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {COMPETITOR_STOCK_PROFILES_V1,competitorStockProfileV1} from './competitor-stock-pins-v1.mjs';

const ROOT=fileURLToPath(new URL('../../',import.meta.url)).replace(/\/$/,'');
const MODULE=fileURLToPath(import.meta.url);
const LIMITS=Object.freeze({fileBytes:16777216,assetBytes:67108864,assetFiles:4096,recordBytes:1048576,outputBytes:262144,buildMs:180000,cleanupMs:5000});
const BUILD_ENVIRONMENT=Object.freeze({NODE_ENV:'production',CI:'true',DO_NOT_TRACK:'1',COPILOTKIT_TELEMETRY_DISABLED:'true'});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const need=(value,label)=>{if(!value)throw Error('competitor-build-'+label);};
const relative=name=>typeof name==='string'&&name.length>0&&!path.isAbsolute(name)&&!name.includes('\0')&&name.split('/').every(part=>part!==''&&part!=='.'&&part!=='..');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const recordPath=profile=>path.join(ROOT,'competitors',profile,'.build-evidence.json');

async function readOwned(name){
 need(relative(name),'relative-path');const parts=name.split('/');let last;
 for(let i=1;i<=parts.length;i++){const stat=await fs.lstat(path.join(ROOT,...parts.slice(0,i)));need(!stat.isSymbolicLink()&&(i===parts.length?stat.isFile():stat.isDirectory()),'owned-path');last=stat;}
 need(last.nlink===1&&last.size<=LIMITS.fileBytes,'file-bound');const bytes=await fs.readFile(path.join(ROOT,name)),after=await fs.lstat(path.join(ROOT,name));need(bytes.length===last.size&&after.dev===last.dev&&after.ino===last.ino&&after.size===last.size&&after.mtimeMs===last.mtimeMs,'file-drift');
 return{path:name,bytes:bytes.length,sha256:sha(bytes),data:bytes};
}
const publicRef=({data,...ref})=>ref;
async function profileSources(pin){
 const prefix=`competitors/${pin.profile}`,listing=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z','--',prefix,'competitors/shared/context.mjs','competitors/shared/protocol.ts'],{cwd:ROOT,encoding:'utf8',timeout:10000,maxBuffer:262144}),names=[...new Set(listing.split('\0').filter(Boolean))].sort();
 need(same(names,Object.keys(pin.sources).sort()),'source-roster');const rows=[];
 for(const name of names){const ref=await readOwned(name);need(ref.sha256===pin.sources[name],'source-identity');rows.push(publicRef(ref));}return rows;
}
async function npmTool(){
 const cli=path.resolve(path.dirname(process.execPath),'../lib/node_modules/npm/bin/npm-cli.js'),metadata=path.resolve(path.dirname(cli),'../package.json');
 const[cliBytes,metadataBytes]=await Promise.all([fs.readFile(cli),fs.readFile(metadata)]),pkg=JSON.parse(metadataBytes);need(pkg.name==='npm'&&pkg.version==='11.19.0'&&process.version==='v24.20.0','toolchain');
 return{node:process.version,nodeExecutable:await fs.realpath(process.execPath),npmVersion:pkg.version,npmCLI:{path:await fs.realpath(cli),bytes:cliBytes.length,sha256:sha(cliBytes)},npmMetadataSha256:sha(metadataBytes)};
}
async function installedPackages(pin){
 const base=`competitors/${pin.profile}`,physicalBase=await fs.realpath(path.join(ROOT,base)),ownModules=physicalBase+'/node_modules/',require=createRequire(path.join(physicalBase,'package.json'));
 const lock=JSON.parse((await readOwned(base+'/package-lock.json')).data),hidden=JSON.parse((await readOwned(base+'/node_modules/.package-lock.json')).data);need(lock.lockfileVersion===3&&hidden.lockfileVersion===3,'lock-version');const rows=[];
 for(const expected of pin.packages){
  const locked=lock.packages[expected.resolutionPath],actual=hidden.packages[expected.resolutionPath];need(locked?.version===expected.version&&locked.resolved===expected.resolved&&locked.integrity===expected.integrity&&!locked.link&&actual?.version===expected.version&&actual.integrity===expected.integrity&&actual.resolved===expected.resolved&&!actual.link,'registry-pin');
  const location=base+'/'+expected.resolutionPath,physical=await fs.realpath(path.join(ROOT,location));need(physical===path.join(physicalBase,expected.resolutionPath)&&physical.startsWith(ownModules),'physical-package');
  const metadata=await readOwned(location+'/package.json'),pkg=JSON.parse(metadata.data);need(pkg.name===expected.name&&pkg.version===expected.version,'installed-metadata');const entries=[];
  for(const specifier of expected.entries){const entry=await fs.realpath(require.resolve(specifier));need(entry.startsWith(physical+'/')&&entry.startsWith(ownModules),'physical-entry');const ref=await readOwned(path.relative(ROOT,entry));entries.push({specifier,...publicRef(ref),resolution:'actual Node require.resolve subpath; Vite isolation separately checks bundled frontend modules'});}
  const witnessFiles=[];for(const expectedFile of expected.witnessFiles??[]){need(relative(expectedFile.path),'witness-path');const ref=await readOwned(location+'/'+expectedFile.path);need(ref.sha256===expectedFile.sha256,'witness-file');witnessFiles.push(publicRef(ref));}
  rows.push({name:expected.name,version:expected.version,registryURL:expected.resolved,integrity:expected.integrity,resolutionPath:location,metadata:publicRef(metadata),entries,witnessFiles});
 }
 const tools=[];for(const command of ['vite','tsc']){const target=await fs.realpath(path.join(physicalBase,'node_modules/.bin',command));need(target.startsWith(ownModules),'physical-tool');tools.push({command,...publicRef(await readOwned(path.relative(ROOT,target)))});}
 return{packages:rows,tools,hiddenLock:publicRef(await readOwned(base+'/node_modules/.package-lock.json'))};
}
async function assertNoProfileEnvironment(profile){
 for(const name of ['.env','.env.local','.env.production','.env.production.local']){const file=path.join(ROOT,'competitors',profile,name);try{await fs.lstat(file);}catch(error){if(error.code==='ENOENT')continue;throw error;}throw Error('competitor-build-environment-file');}
}
async function inputFacts(profile){
 await assertNoProfileEnvironment(profile);
 const pin=competitorStockProfileV1(profile),sources=await profileSources(pin),installed=await installedPackages(pin),toolchain=await npmTool();
 const implementation=[];for(const file of [MODULE,fileURLToPath(new URL('./competitor-stock-pins-v1.mjs',import.meta.url))])implementation.push(publicRef(await readOwned(path.relative(ROOT,file))));
 return{profile,profileRoot:await fs.realpath(path.join(ROOT,'competitors',profile)),sources,...installed,toolchain,implementation,sourceMaps:pin.sourceMaps,explicitTarget:pin.explicitTarget,renderer:pin.renderer,dependencyTrust:'fresh ordinary npm ci verifies registry integrity; metadata/entry bookends do not cryptographically inventory every installed vendor archive byte'};
}
async function assetFacts(profile){
 const base=`competitors/${profile}/dist`,rows=[];let total=0;
 async function walk(name){for(const entry of(await fs.readdir(path.join(ROOT,name),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const key=name+'/'+entry.name;need(!entry.isSymbolicLink(),'asset-symlink');if(entry.isDirectory()){await walk(key);continue;}const read=await readOwned(key);need(rows.length<LIMITS.assetFiles&&(total+=read.bytes)<=LIMITS.assetBytes,'asset-bound');rows.push({...publicRef(read),assetPath:path.relative(base,key)});}}
 await walk(base);need(rows.some(row=>row.assetPath==='index.html')&&rows.some(row=>row.assetPath.endsWith('.js'))&&!rows.some(row=>row.assetPath.endsWith('.map')),'production-assets');return rows;
}
/** Vite8.3.4's generateBundle CSS snapshot still includes its exact trailing
 * hash-update marker. A later pinned hook removes that marker. Keep this stage
 * relationship explicit; the separately inventoried final bytes stay authority. */
export function validateVercelAssetStageV1(name,declared,actual,bytes){
 need(relative(name)&&Buffer.isBuffer(bytes)&&actual?.bytes===bytes.length&&actual.sha256===sha(bytes)&&Number.isSafeInteger(declared?.bytes)&&declared.bytes>=0&&/^[a-f0-9]{64}$/.test(declared.sha256),'vercel-stage-asset');
 if(declared.bytes===actual.bytes&&declared.sha256===actual.sha256)return{name,relationship:'exact-final-bytes',declared:{bytes:declared.bytes,sha256:declared.sha256},final:{bytes:actual.bytes,sha256:actual.sha256}};
 const marker=Buffer.from('/*$vite$:1*/');need(name.endsWith('.css')&&declared.bytes===bytes.length+marker.length&&declared.sha256===sha(Buffer.concat([bytes,marker])),'vercel-generated-asset');return{name,relationship:'vite-css-trailing-hash-marker-removed',markerBytes:marker.length,declared:{bytes:declared.bytes,sha256:declared.sha256},final:{bytes:actual.bytes,sha256:actual.sha256}};
}
async function existingManifest(profile,inputs,assets){
 const base=`competitors/${profile}`,assetByName=new Map(assets.map(row=>[row.assetPath,row])),sourceByName=new Map(inputs.sources.map(row=>[row.path,row]));
 if(profile==='assistant-ui')return{kind:'no-existing-generated-receipt',scope:'unchanged npm build runs verified source-pinned isolation/typecheck/Vite hooks; wrapper observes the actual successful build'};
 const name=profile==='copilotkit'?'profile-isolation.json':'profile-build.json',ref=await readOwned(base+'/dist/'+name),value=JSON.parse(ref.data);
 need(value.lockSha256===sourceByName.get(base+'/package-lock.json').sha256,'generated-lock');
 if(profile==='copilotkit'){need(value.profile==='copilotkit-react-1.83-default-functional-v1'&&value.packageSha256===sourceByName.get(base+'/package.json').sha256&&value.foreignPhysicalModules===0&&Number.isSafeInteger(value.physicalModuleCount)&&value.physicalModuleCount>0&&value.physicalModuleCount<=100000&&value.sharedSource==='../shared/context.mjs','copilot-generated-manifest');}
 else{
  need(value.schema===1&&value.profile==='vercel-ai-sdk'&&value.FPS===null&&value.scoringEligibility===false&&Array.isArray(value.modules)&&value.modules.length>0&&value.modules.length<=100000&&value.modules.every(name=>relative(name)&&name.startsWith('node_modules/')),'vercel-generated-manifest');
  for(const name of ['@ai-sdk/react','ai','react','react-dom'])need(value.packages?.[name]===inputs.packages.find(row=>row.name===name)?.version,'vercel-generated-packages');
  const vite=inputs.packages.find(row=>row.name==='vite'),witness=vite?.witnessFiles?.find(row=>row.path.endsWith('/vite/dist/node/chunks/node.js'));need(vite?.version==='8.3.4'&&witness?.sha256==='dab5039168ce4526f98058d84e31bf79eeed8eba558a9a27db570df893326364','vercel-stage-implementation');
  need(value.assets&&typeof value.assets==='object'&&!Array.isArray(value.assets)&&Object.keys(value.assets).length>0,'vercel-generated-assets');const assetJoins=[];for(const[name,row]of Object.entries(value.assets)){const actual=assetByName.get(name);need(relative(name)&&actual,'vercel-generated-asset');assetJoins.push(validateVercelAssetStageV1(name,row,actual,(await readOwned(base+'/dist/'+name)).data));}
  return{kind:'registered-frontend-modules-and-generateBundle-stage-assets',stage:'generateBundle snapshot; final assets independently inventoried',...publicRef(ref),assetJoins,stageImplementation:witness};
 }
 return{kind:profile==='copilotkit'?'registered-physical-frontend-modules':'registered-frontend-modules-and-selected-assets',...publicRef(ref)};
}
/** Pure record/current consistency check. Only the default reader below obtains
 * actual current bytes; a caller-created DTO cannot grant build authority. */
export function validateCompetitorBuildRecordV1(profile,record,current){
 const pin=competitorStockProfileV1(profile);need(record?.schema==='competitor-genuine-build-v1'&&record.profile===profile&&record.purpose==='private-semantic-trace-build-binding'&&record.performance===false&&record.scoringEligibility===false&&record.FPS===null,'record-identity');
 need(same(record.inputs,current.inputs)&&same(record.assets,current.assets)&&same(record.existingManifest,current.existingManifest),'record-current-drift');const build=record.build;
 need(build&&same(build.command,pin.buildCommand)&&build.attention==='fulfilled'&&build.unsafeOutstanding===false&&build.exit?.code===0&&build.exit.signal===null&&build.close?.code===0&&build.close.signal===null,'build-original');
 const clock=build.clock;need(clock?.basis==='node-performance'&&['dispatchedMs','deadlineMs','exitMs','closeMs','attentionSettledMs'].every(key=>Number.isFinite(clock[key])&&clock[key]>=0)&&clock.deadlineMs===clock.dispatchedMs+LIMITS.buildMs&&clock.exitMs>=clock.dispatchedMs&&clock.closeMs>=clock.exitMs&&clock.attentionSettledMs>=clock.closeMs&&clock.exitMs<clock.deadlineMs&&clock.closeMs<clock.deadlineMs&&clock.attentionSettledMs<clock.deadlineMs,'build-on-time-original');
 need(same(build.environment,BUILD_ENVIRONMENT)&&same(build.actualCommand,[record.inputs.toolchain.nodeExecutable,record.inputs.toolchain.npmCLI.path,'run','build','--workspaces=false']),'build-production-command');
 for(const name of ['stdout','stderr']){const row=build.streams?.[name];need(row&&row.end===true&&row.closed===true&&row.overflow===false&&Number.isSafeInteger(row.bytes)&&row.bytes>=0&&row.bytes<=LIMITS.outputBytes&&/^[a-f0-9]{64}$/.test(row.sha256),'build-streams');}
 need(record.inputs.profile===profile&&record.inputs.toolchain.node==='v24.20.0'&&record.inputs.toolchain.npmVersion==='11.19.0','record-toolchain');return record;
}
async function executeBuild(profile,toolchain){
 const pin=competitorStockProfileV1(profile),cwd=path.join(ROOT,'competitors',profile),dispatchedMs=performance.now(),receipt={command:pin.buildCommand,actualCommand:[process.execPath,toolchain.npmCLI.path,'run','build','--workspaces=false'],environment:BUILD_ENVIRONMENT,clock:{basis:'node-performance',dispatchedMs,deadlineMs:dispatchedMs+LIMITS.buildMs,exitMs:null,closeMs:null,attentionSettledMs:null},attention:'pending',unsafeOutstanding:false,exit:null,close:null,streams:{stdout:{bytes:0,end:false,closed:false,overflow:false,sha256:null},stderr:{bytes:0,end:false,closed:false,overflow:false,sha256:null}}};
 const env={PATH:path.dirname(process.execPath)+':/usr/bin:/bin',HOME:process.env.HOME,...BUILD_ENVIRONMENT,...(process.env.TMPDIR?{TMPDIR:process.env.TMPDIR}:{})};
 const child=spawn(process.execPath,[toolchain.npmCLI.path,'run','build','--workspaces=false'],{cwd,env,detached:process.platform!=='win32',stdio:['ignore','pipe','pipe']});let spawnError=null;
 const kill=()=>{if(receipt.close!==null)return;try{if(process.platform==='win32')child.kill('SIGKILL');else process.kill(-child.pid,'SIGKILL');}catch(error){if(error.code!=='ESRCH')spawnError??=String(error.message);}};
 const hashes={stdout:createHash('sha256'),stderr:createHash('sha256')};
 const originalClose=new Promise(resolve=>{child.once('close',(code,signal)=>{receipt.clock.closeMs=performance.now();receipt.close={code,signal};resolve();});});
 child.on('error',error=>{spawnError??=String(error.message);});child.once('exit',(code,signal)=>{receipt.clock.exitMs=performance.now();receipt.exit={code,signal};});
 for(const name of ['stdout','stderr']){const stream=child[name],row=receipt.streams[name];stream.on('data',bytes=>{row.bytes+=bytes.length;hashes[name].update(bytes);if(row.bytes>LIMITS.outputBytes){row.overflow=true;kill();return;}(name==='stdout'?process.stdout:process.stderr).write(bytes);});stream.once('end',()=>{row.end=true;});stream.once('close',()=>{row.closed=true;});stream.on('error',error=>{spawnError??=String(error.message);kill();});}
 let timer;try{await Promise.race([originalClose,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('competitor-build-command-deadline')),Math.max(1,receipt.clock.deadlineMs-performance.now()));})]);receipt.clock.attentionSettledMs=performance.now();if(receipt.clock.attentionSettledMs>=receipt.clock.deadlineMs||receipt.clock.closeMs===null||receipt.clock.closeMs>=receipt.clock.deadlineMs||receipt.clock.exitMs===null||receipt.clock.exitMs>=receipt.clock.deadlineMs)throw Error('competitor-build-command-late-original');receipt.attention='fulfilled';}
 catch(error){receipt.clock.attentionSettledMs??=performance.now();receipt.attention='rejected';kill();let cleanup;try{await Promise.race([originalClose,new Promise((_,reject)=>{cleanup=setTimeout(()=>reject(Error('competitor-build-command-original-close-unsettled')),LIMITS.cleanupMs);})]);}catch{receipt.unsafeOutstanding=true;}finally{clearTimeout(cleanup);}throw Object.assign(error,{buildReceipt:receipt,unsafeOutstanding:receipt.unsafeOutstanding});}
 finally{clearTimeout(timer);for(const name of ['stdout','stderr'])receipt.streams[name].sha256=hashes[name].digest('hex');}
 if(!(spawnError===null&&receipt.exit?.code===0&&receipt.exit.signal===null&&receipt.close?.code===0&&receipt.close.signal===null&&Object.values(receipt.streams).every(row=>row.end&&row.closed&&!row.overflow)))throw Object.assign(Error('competitor-build-command-failed'),{buildReceipt:receipt,unsafeOutstanding:false});return receipt;
}
/** Genuine ordinary build command. No caller root, command or verifier port. */
export async function buildCompetitorV1(profile){
 competitorStockProfileV1(profile);const target=recordPath(profile);try{const stat=await fs.lstat(target);need(stat.isFile()&&!stat.isSymbolicLink(),'old-record');await fs.unlink(target);}catch(error){if(error.code!=='ENOENT')throw error;}
 const before=await inputFacts(profile),build=await executeBuild(profile,before.toolchain),after=await inputFacts(profile);need(same(before,after),'build-input-drift');const assets=await assetFacts(profile),manifest=await existingManifest(profile,after,assets),record={schema:'competitor-genuine-build-v1',profile,purpose:'private-semantic-trace-build-binding',inputs:before,build,assets,existingManifest:manifest,performance:false,scoringEligibility:false,FPS:null};
 validateCompetitorBuildRecordV1(profile,record,{inputs:after,assets,existingManifest:manifest});const bytes=Buffer.from(JSON.stringify(record,null,2)+'\n');need(bytes.length<=LIMITS.recordBytes,'record-bound');await fs.writeFile(target,bytes,{flag:'wx',mode:0o600});const actual=await competitorBuildEvidenceV1(profile);need(same(actual,record),'published-record-drift');return actual;
}
/** Authority comes from live owned files and the successful wrapper record,
 * never a build DTO supplied by a capture caller. */
export async function competitorBuildEvidenceV1(profile){
 competitorStockProfileV1(profile);const ref=await readOwned(`competitors/${profile}/.build-evidence.json`);need(ref.bytes<=LIMITS.recordBytes,'record-bound');const record=JSON.parse(ref.data),inputs=await inputFacts(profile),assets=await assetFacts(profile),manifest=await existingManifest(profile,inputs,assets);return validateCompetitorBuildRecordV1(profile,record,{inputs,assets,existingManifest:manifest});
}
export async function waitCompetitorBuildOriginalV1(original,wait,ms,label){let pending=true;void original.then(()=>{pending=false;},()=>{pending=false;});try{return await wait(original,ms,label);}catch(error){if(pending){const failure=error instanceof Error?error:Error('competitor-build-attention',{cause:error});failure.unsafeOutstanding=true;throw failure;}throw error;}}
if(process.argv[1]&&path.resolve(process.argv[1])===MODULE){
 const args=process.argv.slice(2);try{need(args.length===3&&['--build','--verify'].includes(args[0])&&args[1]==='--profile'&&COMPETITOR_STOCK_PROFILES_V1.includes(args[2]),'arguments');const record=await(args[0]==='--build'?buildCompetitorV1(args[2]):competitorBuildEvidenceV1(args[2]));console.log(JSON.stringify({schema:record.schema,profile:record.profile,status:'verified',recordSha256:sha(JSON.stringify(record)),assetFiles:record.assets.length,packages:record.inputs.packages.length,FPS:null,performance:false,scoringEligibility:false}));}catch(error){console.error(JSON.stringify({schema:'competitor-genuine-build-failure-v1',failure:String(error?.message??error).slice(0,2048),unsafeOutstanding:error?.unsafeOutstanding===true,buildReceipt:error?.buildReceipt??null,FPS:null,performance:false,scoringEligibility:false}));process.exitCode=1;}
}
