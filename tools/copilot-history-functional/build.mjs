import fs from 'node:fs';
import {resolve,dirname,basename,relative} from 'node:path';
import {createRequire,builtinModules} from 'node:module';
import {here,sourceRoot,adapterPath,registry,sha,boundedRead,preflight,transform,reverse} from './instrument.mjs';
const require=createRequire(sourceRoot+'/package.json');
export function normalizeOutputImports(imports,outputKeys){return imports.map(e=>{if(!e.external&&!outputKeys.has(e.path))throw Error('browser-emitted-import');return [e.external?e.path:basename(e.path),e.kind,!!e.external];});}
const inlineAssetSha='ae4458e5d9121500b15b1dd81573cf2bb901aa954f0c4b5416db63fb3f0f258c',inlineSource='node_modules/@copilotkit/react-core/dist/v2/index.css',inlineSourceSha='99c4c404d25fbde4f17cc542a3ca8fa6ae0e4d121b48d18e44bb79ecf0db3fde';
function inlineAssetEdge(output,target,kind,external){return ['app.css','sentinel.css'].includes(output)&&external===true&&kind==='url-token'&&typeof target==='string'&&Buffer.byteLength(target)===259&&sha(target)===inlineAssetSha;}
function inlineOccurrence(raw,target){const text=Buffer.from(raw).toString('utf8');return text.split(target).length===2&&text.split('url("'+target+'")').length===2;}
export function validateEmittedImports(build){
 const allowedNames=new Set(build.outputs.map(f=>f.name)),assets=[];
 for(const o of build.receipt.outputGraph)for(const [target,kind,external]of o.imports){
  if(!external){if(!allowedNames.has(target)||!/^[-A-Za-z0-9._]+$/.test(target))throw Error('browser-emitted-import');continue;}
  if(!inlineAssetEdge(o.name,target,kind,external)||assets.some(e=>e.output===o.name))throw Error('browser-emitted-import');
  const emitted=build.outputs.find(f=>f.name===o.name);if(!emitted||emitted.bytes!==emitted.contents.length||sha(emitted.contents)!==emitted.sha256||!inlineOccurrence(emitted.contents,target))throw Error('browser-emitted-import');
  assets.push({output:o.name,classification:'embedded-data-asset',kind,targetBytes:259,targetSha256:inlineAssetSha});
 }
 if(assets.length!==2||!assets.some(e=>e.output==='app.css')||!assets.some(e=>e.output==='sentinel.css'))throw Error('browser-emitted-import');
 const inputs=build.receipt.inputs.filter(i=>i.path===inlineSource),input=inputs[0];if(inputs.length!==1||input.bytes!==90186||input.sha256!==inlineSourceSha)throw Error('browser-emitted-import');
 const edges=input.imports.filter(e=>e[1]==='url-token'&&e[2]);if(edges.length!==1||!inlineAssetEdge('app.css',...edges[0]))throw Error('browser-emitted-import');
 const raw=boundedRead(resolve(sourceRoot,inlineSource),8388608);if(raw.length!==90186||sha(raw)!==inlineSourceSha||!inlineOccurrence(raw,edges[0][0]))throw Error('browser-emitted-import');
 return assets.sort((a,b)=>a.output.localeCompare(b.output));
}
export function requiredStaticOutputs(outputGraph,entry){const graph=new Map(outputGraph.map(o=>[o.name,o])),needed=new Set();function visit(name){if(needed.has(name))return;if(needed.size>=640)throw Error('browser-loaded-graph');needed.add(name);const item=graph.get(name);if(!item)throw Error('browser-loaded-graph');for(const [dependency,kind,external]of item.imports){if(external){if(inlineAssetEdge(name,dependency,kind,external))continue;throw Error('browser-loaded-graph');}if(kind!=='dynamic-import')visit(dependency);}}visit(entry);return needed;}
export function createBuildReservation(){
 let files=0,bytes=0,failed=false;
 return {get files(){return files;},get bytes(){return bytes;},reserve(size){if(failed||!Number.isSafeInteger(size)||size<0||size>8388608||files===640||bytes+size>33554432){failed=true;return false;}files++;bytes+=size;return true;}};
}
function privateEntries(pins){return {'private:binding-app':'import {installC} from "./tools/copilot-history-functional/adapter.mjs";import {launchPage} from "./apps/copilotkit/src/main.tsx";installC(launchPage);\n','private:binding-sentinel':'import {adapter} from "./tools/copilot-history-functional/adapter.mjs";import {createRoot} from "react-dom/client";import {Virtualizer} from "./'+pins[0].path+'";import {useVirtualizer} from "./'+pins[4].path+'";import {CopilotChat} from "@copilotkit/react-core/v2";export const imports=[typeof createRoot,typeof Virtualizer,typeof useVirtualizer,typeof CopilotChat];export const receipt=adapter.bindingReceipt();'};}
export function recheckBuildInputs(receipt,reader=boundedRead){
 const entries=privateEntries(registry);let total=0,physical=0,virtual=0;
 if(receipt.inputs.length>16384)throw Error('build-all-input-stability');
 for(const input of receipt.inputs){let raw;if(Object.hasOwn(entries,input.path)){raw=Buffer.from(entries[input.path]);virtual++;}else{const path=resolve(sourceRoot,input.path);if(!path.startsWith(sourceRoot+'/')&&path!==adapterPath)throw Error('build-all-input-stability');raw=reader(path,8388608);physical++;}total+=raw.length;if(total>67108864||raw.length!==input.bytes||sha(raw)!==input.sha256)throw Error('build-all-input-stability');}
 if(virtual!==2)throw Error('build-all-input-stability');return {physical,virtual,bytes:total,manifestSha256:sha(JSON.stringify(receipt.inputs))};
}
export async function offlineBuild(){
 preflight(sourceRoot);
 const esbuild=require('esbuild'),pins=registry;
 const selected=new Map([['core',0],['copilot',3],['wrapper',4],['react',24]].map(([kind,i])=>[resolve(sourceRoot,pins[i].path),kind]));
 const receipts=[],sourceFacts=new Map(),browserInputAdmission=createInputAdmission();let inputBytes=0;
 const privateSources=privateEntries(pins),entry=privateSources['private:binding-app'],sentinel=privateSources['private:binding-sentinel'];
 let result;
 try{result=await esbuild.build({
  absWorkingDir:sourceRoot,
  entryPoints:{app:'binding-app',sentinel:'binding-sentinel'},
  bundle:true,write:false,outdir:resolve(sourceRoot,'.module-binding-memory'),format:'esm',platform:'browser',splitting:true,minify:true,metafile:true,logLevel:'silent',jsx:'automatic',loader:{'.woff2':'file','.woff':'file','.ttf':'file'},define:{'process.env.NODE_ENV':'"production"'},
  outExtension:{'.js':'.mjs'},
  plugins:[{name:'source-owned-module-binding',setup(build){
  build.onResolve({filter:/^binding-(app|sentinel)$/},args=>({path:args.path,namespace:'private'}));
  build.onLoad({filter:/.*/,namespace:'private'},args=>{const contents=args.path==='binding-app'?entry:sentinel;browserInputAdmission.reserve('private:'+args.path,Buffer.byteLength(contents));sourceFacts.set(resolve(sourceRoot,'private:'+args.path),{bytes:Buffer.byteLength(contents),sha256:sha(contents)});return {contents,loader:'js',resolveDir:sourceRoot};});
  build.onLoad({filter:/.*/,namespace:'file'},args=>{
   if(!args.path.startsWith(sourceRoot+'/')&&args.path!==adapterPath)throw Error('build-source-path');
   if(sourceFacts.size>=16384)throw Error('build-input-limit');
   const stat=fs.lstatSync(args.path,{bigint:true});if(!stat.isFile()||stat.nlink!==1n||stat.size>8388608n)throw Error('build-source-path');browserInputAdmission.reserve(args.path,Number(stat.size));
   const raw=boundedRead(args.path,Number(stat.size));inputBytes+=raw.length;if(inputBytes>67108864)throw Error('build-input-limit');
   sourceFacts.set(args.path,{bytes:raw.length,sha256:sha(raw)});
   const extension=args.path.slice(args.path.lastIndexOf('.')+1),loaders={js:'js',mjs:'js',cjs:'js',ts:'ts',tsx:'tsx',jsx:'jsx',css:'css',json:'json',woff:'file',woff2:'file',ttf:'file'};
   const loader=loaders[extension];if(!loader)throw Error('build-source-loader');
   const kind=selected.get(args.path);if(!kind)return {contents:raw,loader,resolveDir:dirname(args.path)};
   const receipt=transform(kind);reverse(receipt);if(sha(raw)!==receipt.sourceSha256)throw Error('build-source-race');
   receipts.push({kind,path:relative(sourceRoot,args.path),sourceSha256:receipt.sourceSha256,transformedSha256:receipt.sha256,insertions:receipt.edits.length});return {contents:receipt.code,loader:'js',resolveDir:dirname(args.path)};
  });}}],
 });}finally{esbuild.stop();}
 receipts.sort((a,b)=>a.kind.localeCompare(b.kind));
 const inputs=Object.entries(result.metafile.inputs);const normalized=inputs.map(([path,info])=>({path:resolve(sourceRoot,path),...info})).sort((a,b)=>a.path.localeCompare(b.path));
 const singletonInputs=normalized.filter(i=>i.path===adapterPath).length;
 const productionReact=normalized.some(i=>i.path===resolve(sourceRoot,pins[24].path))&&!normalized.some(i=>i.path.includes('react-dom-client.development'));
 const names=receipts.map(r=>r.kind).sort();
 const allBound=names.join(',')==='copilot,core,react,wrapper'&&singletonInputs===1&&productionReact;
 const outputs=result.outputFiles.map(f=>({name:basename(f.path),contents:f.contents,bytes:f.contents.length,sha256:sha(f.contents)})).sort((a,b)=>a.name.localeCompare(b.name));
 const buildBudget=createBuildReservation();
 if(outputs.some(f=>!buildBudget.reserve(f.bytes))){
  throw Error('build-output-limit');
 }
 // Inputs and original resolution edges are retained; the transformed paths are
 // required to resolve to this same adapter input in the emitted graph.
 const adapterEdges=normalized.flatMap(i=>i.imports.filter(e=>resolve(sourceRoot,e.path)===adapterPath).map(e=>({from:relative(sourceRoot,i.path),kind:e.kind,to:relative(sourceRoot,adapterPath)})));
 const edgeBound=receipts.every(r=>adapterEdges.some(e=>e.from===r.path));
 const inputIDs=new Map(normalized.map((i,n)=>[i.path,n]));
 const graph=normalized.map(i=>{
  const source=sourceFacts.get(i.path);
  if(!source)throw Error('build-source-gap');
  return {path:relative(sourceRoot,i.path),...source,parsedBytes:i.bytes,format:i.format??null,imports:i.imports.map(e=>[e.external?e.path:inputIDs.get(resolve(sourceRoot,e.path)),e.kind,!!e.external])};
 });
 const outputKeys=new Set(Object.keys(result.metafile.outputs));
 const outputGraph=Object.entries(result.metafile.outputs).map(([path,info])=>({name:basename(path),bytes:info.bytes,entry:info.entryPoint?inputIDs.get(resolve(sourceRoot,info.entryPoint)):null,imports:normalizeOutputImports(info.imports,outputKeys),inputs:Object.entries(info.inputs).map(([path,fact])=>[inputIDs.get(resolve(sourceRoot,path)),fact.bytesInOutput]).sort((a,b)=>a[0]-b[0])})).sort((a,b)=>a.name.localeCompare(b.name));
 const embeddedAssets=validateEmittedImports({receipt:{inputs:graph,outputGraph},outputs});
 const adapterID=inputIDs.get(adapterPath),singletonEmittedChunks=outputGraph.filter(o=>o.inputs.some(([index,bytes])=>index===adapterID&&bytes>0)).length;
 const emittedBound=receipts.every(r=>outputGraph.some(o=>o.inputs.some(([index,bytes])=>index===inputIDs.get(resolve(sourceRoot,r.path))&&bytes>0)))&&singletonEmittedChunks===1;
 const stability=recheckBuildInputs({inputs:graph});
 preflight(sourceRoot);
 const receipt={kind:'copilot-history-functional-build-v1',status:'unavailable',reason:allBound&&edgeBound&&emittedBound?'unmeasured':'source-gap',graphStatus:allBound&&edgeBound&&emittedBound?'observed':'unavailable',executedSingleton:'unavailable',allInputStability:{...stability,loadBytes:inputBytes,sourceCopies:false},singletonInputs,singletonEmittedChunks,productionReact,transforms:names,adapterEdges,sourceTransforms:receipts,sourceRoot:'.',sourcePinsSha256:sha(boundedRead(resolve(here,'source-pins.json'),16384)),compiler:{name:'esbuild',version:esbuild.version},inputs:graph,outputGraph,embeddedAssets,emitted:outputs.map(({contents,...r})=>r),budget:{profile:'copilot-history-functional-build-v1',fileCap:640,aggregateCap:33554432,individualCap:8388608},qualification:false,performance:false};
 receipt.sourceStaticWitness=selectedSourceStaticWitness(receipt);
 if(!buildBudget.reserve(Buffer.byteLength(JSON.stringify(receipt,null,2)+'\n')))throw Error('build-output-limit');
 return {receipt,outputs};
}
export function selectedSourceStaticWitness(receipt){
 const selected={copilot:registry[3],core:registry[0],react:registry[24],wrapper:registry[4]},needed=requiredStaticOutputs(receipt.outputGraph,'sentinel.mjs');
 if(receipt.sourceRoot!=='.'||receipt.sourceTransforms.length!==4||receipt.sourceTransforms.map(t=>t.kind).sort().join(',')!=='copilot,core,react,wrapper')throw Error('browser-selected-source-static');
 const rows=receipt.sourceTransforms.map(t=>{const pin=selected[t.kind],index=receipt.inputs.findIndex(i=>i.path===t.path),input=receipt.inputs[index];if(t.path!==pin.path||t.sourceSha256!==pin.sha256||!input||input.bytes!==pin.bytes||input.sha256!==pin.sha256)throw Error('browser-selected-source-static:'+t.kind);const outputs=receipt.outputGraph.filter(o=>needed.has(o.name)&&o.inputs.some(([i,n])=>i===index&&n>0)).map(o=>o.name).sort();if(!outputs.length)throw Error('browser-selected-source-static:'+t.kind);return {kind:t.kind,path:t.path,sourceSha256:pin.sha256,outputs};});
 const entry=receipt.inputs.find(i=>i.path==='private:binding-sentinel');if(!entry?.imports.some(([i,kind,external])=>!external&&kind==='import-statement'&&receipt.inputs[i]?.path==='node_modules/@copilotkit/react-core/dist/v2/index.mjs'))throw Error('browser-selected-source-static:copilot-resolution');return rows.sort((a,b)=>a.kind.localeCompare(b.kind));
}

import {writeExclusive,SLOTS}from './policy.mjs';import{transformCServer,reverseCServer}from './server-transform.mjs';
export function packNodeInputs(inputs){const strings=[],ids=new Map(),id=s=>{if(!ids.has(s)){ids.set(s,strings.length);strings.push(s);}return ids.get(s);};const rows=inputs.map(x=>[id(x.path),x.bytes,x.sha256,x.imports.map(e=>Object.entries(e).map(([k,v])=>[id(k),typeof v==='string'?['s',id(v)]:['v',v]]))]);return {strings,rows};}
export function unpackNodeInputs(p){if(!p||Object.keys(p).sort().join(',')!=='rows,strings'||!Array.isArray(p.strings)||!Array.isArray(p.rows)||p.rows.length>16384||p.strings.length>131072||new Set(p.strings).size!==p.strings.length||p.strings.some(s=>typeof s!=='string'||s.length>4096))throw Error('C-node-graph');const used=new Set(),seen=new Set(),str=i=>{if(!Number.isInteger(i)||i<0||i>=p.strings.length)throw Error('C-node-graph');used.add(i);return p.strings[i];};const out=p.rows.map(r=>{if(!Array.isArray(r)||r.length!==4||!Number.isSafeInteger(r[1])||r[1]<0||r[1]>8388608||!/^[a-f0-9]{64}$/.test(r[2])||!Array.isArray(r[3]))throw Error('C-node-graph');const path=str(r[0]);if(seen.has(path))throw Error('C-node-graph');seen.add(path);return {path,bytes:r[1],sha256:r[2],imports:r[3].map(e=>{const x={};if(e.length>8)throw Error('C-node-graph');for(const [k,v]of e){const key=str(k);if(Object.hasOwn(x,key)||!['path','kind','external','original','with'].includes(key)||!Array.isArray(v)||v.length!==2)throw Error('C-node-graph');x[key]=v[0]==='s'?str(v[1]):v[0]==='v'?v[1]:(()=>{throw Error('C-node-graph');})();}return x;})};});if(used.size!==p.strings.length)throw Error('C-node-graph');return out;}
export function createInputAdmission({files=16384,bytes=67108864}={}){
 if(!Number.isInteger(files)||files<1||files>16384||!Number.isInteger(bytes)||bytes<1||bytes>67108864)throw Error('compiler-input-limit');
 const seen=new Map();let readBytes=0,loads=0;
 return {reserve(path,size){if(typeof path!=='string'||!Number.isSafeInteger(size)||size<0||size>8388608||loads>=16384||readBytes+size>bytes||(!seen.has(path)&&seen.size>=files)||seen.has(path)&&seen.get(path)!==size)throw Error('compiler-input-limit');readBytes+=size;loads++;seen.set(path,size);},snapshot(){return {files:seen.size,loads,bytes:readBytes};}};
}
export async function buildC(){const browser=await offlineBuild(),esbuild=require('esbuild'),provided=new Map(),inputAdmission=createInputAdmission();let serverTransform=null;let result;try{result=await esbuild.build({absWorkingDir:sourceRoot,entryPoints:[resolve(here,'server-entry.ts')],bundle:true,platform:'node',format:'cjs',write:false,metafile:true,minify:true,outfile:resolve(here,'server.cjs'),logLevel:'silent',plugins:[{name:'C-node-physical-inputs',setup(build){build.onLoad({filter:/.*/,namespace:'file'},args=>{const a=fs.lstatSync(args.path,{bigint:true});if(!a.isFile()||a.nlink!==1n||a.size>8388608n||(!args.path.startsWith(sourceRoot+'/')&&!args.path.startsWith(here+'/')))throw Error('C-server-input');inputAdmission.reserve(args.path,Number(a.size));const raw=boundedRead(args.path,Number(a.size));provided.set(args.path,{bytes:raw.length,sha256:sha(raw)});let supplied=raw;if(args.path===sourceRoot+'/apps/copilotkit/runtime/runtime.ts'){serverTransform=transformCServer(raw.toString('utf8'));reverseCServer(serverTransform);supplied=Buffer.from(serverTransform.code);}const ext=args.path.split('.').at(-1),loader={js:'js',mjs:'js',cjs:'js',ts:'ts',tsx:'tsx',json:'json'}[ext];if(!loader)throw Error('C-node-loader');return{contents:supplied,loader,resolveDir:dirname(args.path)};});}}]});}finally{esbuild.stop();}
 const inputs=[];let bytes=0;for(const [name,meta]of Object.entries(result.metafile.inputs)){const path=resolve(sourceRoot,name),a=fs.lstatSync(path,{bigint:true});if(!a.isFile()||a.nlink!==1n||a.size>8388608n)throw Error('C-server-input');const raw=boundedRead(path,Number(a.size));bytes+=raw.length;if(bytes>67108864||inputs.length>=16384)throw Error('C-server-input');const original=provided.get(path);if(!original||original.bytes!==raw.length||original.sha256!==sha(raw))throw Error('C-server-input-replay');inputs.push({path:relative(sourceRoot,path),bytes:raw.length,sha256:sha(raw),imports:meta.imports});}
 const external=inputs.flatMap(x=>x.imports.filter(e=>e.external).map(e=>({from:x.path,path:e.path,kind:e.kind})));if(external.some(e=>!builtinModules.includes(e.path)&&!builtinModules.includes(e.path.replace(/^node:/,''))))throw Error('C-server-external');
 const output=result.outputFiles[0],server={contents:output.contents,bytes:output.contents.length,sha256:sha(output.contents),inputs,external,compiler:esbuild.version,format:'cjs',transform:serverTransform?{...serverTransform,code:undefined}:null,inputAdmission:inputAdmission.snapshot(),dynamicResolution:'Requires independent source/runtime policy review; compiler literal external edges alone are not a complete runtime closure.'};
 const packed=packNodeInputs(server.inputs);if(JSON.stringify(unpackNodeInputs(packed))!==JSON.stringify(server.inputs))throw Error('C-node-graph-replay');const receipt={kind:'C-combined-build-v1',browser:browser.receipt,server:{...server,inputs:packed,contents:undefined},qualification:false,performance:false};const graph=Buffer.from(JSON.stringify(receipt));
 const reserve=createBuildReservation();for(const f of browser.outputs)if(!reserve.reserve(f.bytes))throw Error('C-union');for(const size of [server.bytes,graph.length,...SLOTS.map(x=>x[1]),1048576,1048576,1048576,1048576,65536,65536,16384,262144,262144])if(!reserve.reserve(size))throw Error('C-union');
 return{browser,server,receipt,graph,reservation:{files:reserve.files,bytes:reserve.bytes},status:'offline-compiled-no-runtime-proof'};
}
export async function retainBuild(out,{existing=false}={}){const build=await buildC();if(existing){const st=fs.lstatSync(out);if(!st.isDirectory()||st.isSymbolicLink())throw Error('functional-output');}else fs.mkdirSync(out,{mode:0o700});for(const f of build.browser.outputs)writeExclusive(resolve(out,f.name),f.contents);writeExclusive(resolve(out,'server.cjs'),build.server.contents);writeExclusive(resolve(out,'build.json'),build.graph);return{reservation:build.reservation,serverInputs:build.server.inputs.length,serverInputBytes:build.server.inputs.reduce((n,x)=>n+x.bytes,0),browserOutputs:build.browser.outputs.length,browserOutputBytes:build.browser.outputs.reduce((n,x)=>n+x.bytes,0),graphBytes:build.graph.length,status:build.status};}
