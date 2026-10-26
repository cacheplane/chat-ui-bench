import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const PREFIX='native-wheel-witness-v1:';
const SENTINELS=new Set(['performance.mark','performance.measure']);
const SHA=/^[a-f0-9]{64}$/;
const SOURCE_LIMIT=4194304;
const MODULE_PINS=Object.freeze({
  'packages/analyzer/src/browser-frame-whole-trace-reader.ts':'742989717efebf8e515f598a66c3c0fdf1f8d8885f2c05e5525836a6714f7c88',
  'packages/analyzer/dist/browser-frame-whole-trace-reader.js':'f56e6d0c2dd9593017f2178364896f2eec6b3044f058763d9977ae770e9ad77c',
  'packages/analyzer/src/browser-frame-ordered-state.ts':'264a70018bb978a2aec2058349ddde17135112b554db5cb7b5aff539623166d2',
  'packages/analyzer/dist/browser-frame-ordered-state.js':'c765284985a00ece8861a4031ba4ff4a7082a4a9ddba031148b708c29f6f73ae',
  'packages/analyzer/src/browser-frame-packet-fragments.ts':'bff8611ca4a6933461d00c4c108ac13afc0ae02356fc5b1bb6d4dc27de896909',
  'packages/analyzer/dist/browser-frame-packet-fragments.js':'42c5ec0819138b4a7c8476da5d0cff33f1d532930f2e82b665eb95a052beba6a',
  'packages/analyzer/src/browser-frame-protobuf-fragments.ts':'f88b3233be5bff4b0abfe1cb7b4ede46080eeec27c340b43b7fdde3b753c6337',
  'packages/analyzer/dist/browser-frame-protobuf-fragments.js':'55a4a493227cd98e57afaf95cf603774a0e85ff4d7c829304e55ed84fb3ef1df',
  'packages/analyzer/src/browser-frame-protobuf-wire.ts':'db48e75d1ddf63370b0302ec17447476d175440f86b08872ceee98e37dda8f3e',
  'packages/analyzer/dist/browser-frame-protobuf-wire.js':'eb8cf8cb054fbed35681f1d54621f81481fba898e6a6e6edd9d160f621dcd96d',
  'packages/analyzer/src/browser-frame-state-fragments.ts':'b1dce024aa8609430be3901e9f3e3503d53883d367e7ecf881ca4eca3816137d',
  'packages/analyzer/dist/browser-frame-state-fragments.js':'e7700861763677324d59680abf9a62b42565c848c40fb08a1a520bbd40b4b1e2',
  'packages/analyzer/src/browser-frame-trace-framer.ts':'a10bf3bc680c10a7ecc336196d61578617d8ee0ccbe569025e2b114564372aa4',
  'packages/analyzer/dist/browser-frame-trace-framer.js':'5033304bfa4ae8e139ffada2fc402c80164c376ee14ea0c7400be04428b8e57e',
  'packages/analyzer/src/browser-frame-track-descriptor-fragments.ts':'96ba204dce2c2172540dc143c417ba0609477015c65101c7999d5ea48de31ada',
  'packages/analyzer/dist/browser-frame-track-descriptor-fragments.js':'ef113bb9e10ceec675e466d5b5c94d66b026c4ee8329f2acc986b2b9cafc8fc7',
  'packages/analyzer/src/browser-frame-track-event-fragments.ts':'222da6353dd5f6d0b107227bf19ca63a764b131644823e85e6cff266e41e3c21',
  'packages/analyzer/dist/browser-frame-track-event-fragments.js':'a13a610d797b63d1ecc6823baa44ad37ff383db515131856a887c478ce91c987',
  'packages/analyzer/src/browser-frame-whole-trace.ts':'45580ce2ceb9ad12ce9dd5aa8531816ea7af3820396a2f1ab4d143b29642b13b',
  'packages/analyzer/dist/browser-frame-whole-trace.js':'5e1ea48ebda9464058d21b0c669e7ef436e917ebbaf88bcda326acab54695353',
});
const SOURCE_METADATA=['package.json','package-lock.json','tsconfig.base.json','packages/analyzer/package.json','packages/analyzer/tsconfig.json'];
const PACKET_WIRES=new Map([[3,0],[8,0],[10,0],[13,0],[42,0],[58,0],[87,0],...[5,6,11,12,33,35,36,45,51,59,60,69,72,89,124].map(n=>[n,2])]);
const DATA_FIELDS=new Set([5,6,11,33,35,36,45,51,60,69,72,89,124]);
const AUTHORITY=Object.freeze({diagnosticOnly:true,association:'not_evaluated',originalExecution:'not_evaluated',importerAdmission:'not_evaluated',importCorrespondence:'not_evaluated',fullTargetAuthentication:'unavailable',clock:'not_evaluated',population:'not_evaluated',nativeSupported:false,qualification:false,evaluationEligibility:false,scoringEligibility:false,rankingEligibility:false,fpsEligibility:false,FPS:null});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const identity=s=>[s.dev,s.ino,s.mode,s.nlink,s.size,s.mtimeNs,s.ctimeNs].map(n=>String(n));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const freeze=value=>{if(value!==null&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
class Refusal extends Error {constructor(reason,packetIndex=null){super(reason);this.reason=reason;this.packetIndex=packetIndex;}}
const need=(condition,reason,index=null)=>{if(!condition)throw new Refusal(reason,index);};

function reference(value){
  need(value!==null&&typeof value==='object'&&!types.isProxy(value)&&Object.getPrototypeOf(value)===Object.prototype,'invalid-reference');
  const d=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(d);
  need(keys.length===3&&keys.every(k=>['path','bytes','sha256'].includes(k))&&keys.every(k=>Object.hasOwn(d[k],'value')),'invalid-reference');
  const path=d.path.value,bytes=d.bytes.value,sha256=d.sha256.value;
  need(typeof path==='string'&&Buffer.byteLength(path)<=4096&&path.startsWith('/')&&resolve(path)===path&&!path.includes('\0')&&Number.isSafeInteger(bytes)&&bytes>=0&&bytes<=33554432&&typeof sha256==='string'&&SHA.test(sha256),'invalid-reference');
  return{path,bytes,sha256};
}

// Fixed source-role ceilings are separate from the unchanged trace/wire limits.
// Snapshots prove local file stability, not loaded-module-memory attestation.
function sourceFact(role){
  let fd;
  try{
    const before=fs.lstatSync(role.path,{bigint:true});
    need(before.isFile()&&before.nlink===1n&&before.size<=BigInt(role.cap)&&fs.realpathSync(role.path)===role.path,'dependency-unavailable');
    fd=fs.openSync(role.path,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
    const original=identity(before);need(same(original,identity(fs.fstatSync(fd,{bigint:true}))),'source-unavailable');
    const digest=createHash('sha256'),buffer=Buffer.alloc(65536);let bytes=0,reads=0;
    for(;;){need(++reads<=64,'source-unavailable');const n=fs.readSync(fd,buffer,0,Math.min(buffer.length,role.cap-bytes+1),null);if(n===0)break;need(Number.isInteger(n)&&n>0&&n<=Math.min(buffer.length,role.cap-bytes+1),'source-unavailable');bytes+=n;need(bytes<=role.cap,'source-unavailable');digest.update(buffer.subarray(0,n));}
    const sha256=digest.digest('hex');
    need(bytes===Number(before.size)&&same(original,identity(fs.fstatSync(fd,{bigint:true})))&&same(original,identity(fs.lstatSync(role.path,{bigint:true}))),'source-unavailable');
    need(role.sha256===undefined||sha256===role.sha256,'dependency-unavailable');
    return{role:role.name,path:role.path,bytes,sha256,identity:original};
  }catch(error){if(error instanceof Refusal)throw error;throw new Refusal('dependency-unavailable');}
  finally{if(fd!==undefined)try{fs.closeSync(fd);}catch{throw new Refusal('source-unavailable');}}
}
function sourceRoles(){
  const roles=[{name:'helper',path:fileURLToPath(import.meta.url),cap:65536}];
  for(const [name,sha256]of Object.entries(MODULE_PINS))roles.push({name,path:fileURLToPath(new URL('../../'+name,import.meta.url)),cap:262144,sha256});
  for(const name of SOURCE_METADATA)roles.push({name,path:fileURLToPath(new URL('../../'+name,import.meta.url)),cap:name==='package-lock.json'?2097152:65536});
  return roles;
}
function sourceBefore(roles){let bytes=0;return roles.map(role=>{const fact=sourceFact(role);bytes+=fact.bytes;need(bytes<=SOURCE_LIMIT,'source-unavailable');return fact;});}
function sourceAfter(roles,before){for(let i=0;i<roles.length;i++)need(same(sourceFact(roles[i]),before[i]),'source-drift');}

function usage(study){
  const limits={fields:131072,repeated:65536,persistentUTF8:262144};
  const used=Object.fromEntries(Object.keys(limits).map(k=>[k,study.budgets[k]]));
  for(const [k,n]of Object.entries(used))need(Number.isSafeInteger(n)&&n>=0&&n<=limits[k],'work-capacity');
  return{used,add(key,n=1){need(Number.isSafeInteger(n)&&n>=0&&n<=limits[key]-used[key],key==='persistentUTF8'?'persistent-capacity':'work-capacity');used[key]+=n;},persist(value){this.add('persistentUTF8',Buffer.byteLength(JSON.stringify(value)));}};
}
function decodeText(bytes,o,work,index){
  need(o.wireType===2,'raw-unavailable',index);work.add('repeated',o.end-o.valueStart);
  try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(o.valueStart,o.end));}catch{throw new Refusal('raw-unavailable',index);}
}
function validMarker(name){const m=/^native-wheel-witness-v1:([a-f0-9]{32}):0:([1-9][0-9]{0,8})$/.exec(name);return m!==null&&Number(m[2])===1+parseInt(m[1].slice(0,7),16);}

function scanPacket(bytes,frame,wire,work,census){
  const budget=wire.newWholeWireBudget(),index=frame.frameIndex,bodySHA256=hash(bytes),headers={},seen=new Set();let payloads=0,witness=null;
  const reader=(start,end)=>new wire.BodyReader(bytes,start,end,budget);
  const next=r=>{work.add('fields');return r.next('root');};
  function names(start,end){
    const intern=reader(start,end);
    while(!intern.complete){const table=next(intern),o=table.occurrence;if(o.fieldNumber!==2)continue;need(o.wireType===2,'raw-unavailable',index);work.add('repeated');const entry=reader(o.valueStart,o.end);let found=false;
      while(!entry.complete){const f=next(entry),at=f.occurrence;if(at.fieldNumber!==2)continue;need(!found,'raw-unavailable',index);found=true;const name=decodeText(bytes,at,work,index);if(name.startsWith(PREFIX)){census.prefixedDefinitions++;throw new Refusal('name-inventory-unavailable',index);}if(SENTINELS.has(name)){census.filteredDefinitions++;throw new Refusal('name-inventory-unavailable',index);}}
      need(found,'raw-unavailable',index);
    }
  }
  function event(o){
    const r=reader(o.valueStart,o.end),fields=[];let name=null,type=null;
    while(!r.complete){const f=next(r),at=f.occurrence;fields.push([at.fieldNumber,at.wireType]);
      if(at.fieldNumber===23){need(name===null,'raw-unavailable',index);name=decodeText(bytes,at,work,index);}
      if(at.fieldNumber===9){need(type===null&&at.wireType===0,'raw-unavailable',index);type=f.scalar.toString();}
    }
    census.trackEvents++;
    if(name!==null&&SENTINELS.has(name)){census.filteredLiterals++;throw new Refusal('name-inventory-unavailable',index);}
    if(name!==null&&name.startsWith(PREFIX)){
      census.literalPrefixEvents++;need(census.literalPrefixEvents===1,'name-inventory-unavailable',index);
      const counts=new Map();for(const [n,w]of fields){need([9,12,3,23,4].includes(n)&&w===(n===23||n===4?2:0),'witness-shape-unavailable',index);counts.set(n,(counts.get(n)??0)+1);}
      need(validMarker(name)&&type==='3'&&counts.size===5&&counts.get(9)===1&&counts.get(3)===1&&counts.get(23)===1&&counts.get(12)>=1&&counts.get(4)>=1,'witness-shape-unavailable',index);
      witness={name,type,packetIndex:index,bodySHA256,eventStart:o.start,eventValueStart:o.valueStart,eventEnd:o.end,frame:{...frame},headers};
    }
  }
  const root=reader(0,bytes.length);
  while(!root.complete){const f=next(root),o=f.occurrence,n=o.fieldNumber;
    need(PACKET_WIRES.has(n)&&o.wireType===PACKET_WIRES.get(n)&&!seen.has(n),'unsupported-packet-profile',index);seen.add(n);
    if(DATA_FIELDS.has(n))need(++payloads<=1,'unsupported-packet-profile',index);
    if(o.wireType===0)headers[n]=f.scalar.toString();
    if(n===11)event(o);
    else if(n===12)names(o.valueStart,o.end);
    else if(n===51||n===72)need(o.valueStart===o.end,'unsupported-packet-profile',index);
    else if(n===5){const bundle=reader(o.valueStart,o.end);while(!bundle.complete){const child=next(bundle).occurrence;need(child.fieldNumber===2&&child.wireType===2,'unsupported-packet-profile',index);work.add('repeated');}}
  }
  return witness;
}

function rawRead(ref,framer){
  let fd,reason=null;const result={EOF:false,closed:false,identityMatch:false,hashMatch:false,reads:0,bytes:0,sha256:null,before:null,after:null};
  try{
    const stat=fs.lstatSync(ref.path,{bigint:true});result.before=identity(stat);need(stat.isFile()&&stat.nlink===1n&&stat.size===BigInt(ref.bytes),'input-unavailable');
    fd=fs.openSync(ref.path,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);need(same(result.before,identity(fs.fstatSync(fd,{bigint:true}))),'input-unavailable');
    const buffer=new Uint8Array(65536),digest=createHash('sha256');
    for(;;){need(++result.reads<=4096,'input-unavailable');const n=fs.readSync(fd,buffer,0,Math.min(buffer.length,ref.bytes-result.bytes+1),null);if(n===0){result.EOF=true;break;}need(Number.isInteger(n)&&n>0&&n<=Math.min(buffer.length,ref.bytes-result.bytes+1),'input-unavailable');result.bytes+=n;need(result.bytes<=ref.bytes,'input-unavailable');const piece=buffer.subarray(0,n);digest.update(piece);framer.feed(piece);}
    result.sha256=digest.digest('hex');result.hashMatch=result.bytes===ref.bytes&&result.sha256===ref.sha256;
    result.after=identity(fs.fstatSync(fd,{bigint:true}));result.identityMatch=same(result.before,result.after)&&same(result.before,identity(fs.lstatSync(ref.path,{bigint:true})));
    need(result.EOF&&result.hashMatch&&result.identityMatch,'input-unavailable');framer.finish();
  }catch(error){reason=error instanceof Refusal?error:new Refusal('raw-unavailable');}
  finally{if(fd!==undefined)try{fs.closeSync(fd);result.closed=true;}catch{reason??=new Refusal('input-unavailable');}}
  return{result,error:reason};
}

function v11Admission(result){
  const s=result.study;
  need(result.status==='complete-whole-annotation-diagnostic'&&result.fullInputVerified===true&&result.reader.EOF&&result.reader.closed&&result.reader.hashMatch&&result.reader.identityMatch&&s?.status==='whole-annotation-study'&&s.semanticProcessing==='complete-supported-schema'&&s.markInventoryAdmission==='resolved-supported-roots'&&s.diagnostics.length===0&&s.counters.withheldRootInventories===0,'v11-unavailable');
  need(s.rawDropInventory?.status==='complete-supported-header-declarations'&&s.rawDropInventory.unexplainedDeclarations===0&&s.rawDropInventory.contradictoryDeclarations===0&&s.sequenceStart?.unexplained===0&&s.sequenceStart.contradictions===0,'v11-unavailable');
  need(s.evidenceInventory?.status==='complete-supported-compact-observations'&&s.evidenceInventory.version===2,'v11-unavailable');return s;
}
function correspondence(raw,study,work){
  need(raw!==null,'name-inventory-unavailable');
  const candidates=study.candidates.filter(c=>{work.add('repeated');return c.value===raw.name;});
  need(candidates.length===1,'candidate-unavailable');const c=candidates[0],h=raw.headers;
  need(c.representation==='event_name'&&c.kind==='literal_string'&&c.nameSource==='literal'&&c.annotationIndex===null&&c.definitionIndex===null&&c.trackSource==='defaults'&&c.trackUuid!==null&&c.trackUuid!=='0'&&c.machineStatus==='absent'&&c.machineId===null&&c.packetIndex===raw.packetIndex&&c.bodySHA256===raw.bodySHA256&&c.eventStart===raw.eventStart&&c.eventValueStart===raw.eventValueStart&&c.eventEnd===raw.eventEnd&&c.sequenceId===h[10]&&h[8]!==undefined&&c.rawTimestamp===h[8]&&c.clockId!==null,'candidate-unavailable');
  if(h[58]!==undefined&&h[58]!=='0')need(c.clockSource==='packet'&&c.clockId===h[58],'candidate-unavailable');else need(c.clockSource==='defaults','candidate-unavailable');
  const witness={...raw,candidate:{...c}};work.persist(witness);return witness;
}
function descriptors(study,witness,work){
  const inventory=study.evidenceInventory;
  function selected(uuid){let first=null;const occurrences=[];for(const o of inventory.occurrences){work.add('repeated');const f=inventory.facts[o[0]];if(f.kind!=='track_descriptor'||f.fields.uuid!==uuid)continue;
      need(o[3]===null&&o[7]===null,'descriptor-unavailable');if(first===null)first=f.fields;else need(same(first,f.fields),'descriptor-unavailable');
      const item={packetIndex:o[1],bodySHA256:o[2],machineId:o[3],sequence:o[4],packetFields:o[5],location:o[6]};work.persist(item);occurrences.push(item);
    }need(first!==null&&occurrences.some(o=>o.packetIndex<witness.packetIndex),'descriptor-unavailable');work.persist(first);return{fields:first,occurrences};}
  const thread=selected(witness.candidate.trackUuid),t=thread.fields;
  need(t.process===undefined&&t.thread?.pid!==undefined&&t.thread?.tid!==undefined&&BigInt(t.thread.pid)>0n&&BigInt(t.thread.tid)>0n&&t.parentUuid!==undefined&&t.parentUuid!=='0'&&t.parentUuid!==t.uuid,'descriptor-unavailable');
  const process=selected(t.parentUuid),p=process.fields;
  need(p.thread===undefined&&p.parentUuid===undefined&&p.process?.pid===t.thread.pid&&p.process?.startTimestampNs!==undefined,'descriptor-unavailable');return{thread,process};
}

/** Fixed source-shaped structural evidence only; no capture, SQL, original-execution or association admission. */
export async function inspectNativeWheelRawCensusV1(value){
  let ref=null,roles=[],before=null,reader=null,upstreamReader=null,work=null,answer=null,failure=null,finish=null;
  try{
    ref=reference(value);roles=sourceRoles();before=sourceBefore(roles);
    const [whole,state,wire,framing]=await Promise.all([
      import('../../packages/analyzer/dist/browser-frame-whole-trace-reader.js'),
      import('../../packages/analyzer/dist/browser-frame-ordered-state.js'),
      import('../../packages/analyzer/dist/browser-frame-protobuf-wire.js'),
      import('../../packages/analyzer/dist/browser-frame-trace-framer.js'),
    ]);
    need(typeof state.finishWholeAnnotationOutput==='function','dependency-unavailable');finish=state.finishWholeAnnotationOutput;
    const result=whole.readWholeUserTimingTraceV11(ref,state.WHOLE_USER_TIMING_V11_POLICY);upstreamReader=result.reader;
    const study=v11Admission(result);work=usage(study);work.persist(before);
    const census={packets:0,trackEvents:0,literalPrefixEvents:0,prefixedDefinitions:0,filteredLiterals:0,filteredDefinitions:0};let active=null,at=0,found=null;
    const framer=new framing.TraceRootFramer(ref.bytes,131072,262144,{
      start(frame){active=new Uint8Array(frame.bodyEnd-frame.bodyStart);at=0;},
      body(piece){active.set(piece,at);at+=piece.length;},
      end(frame){const row=scanPacket(active,frame,wire,work,census);census.packets++;if(row){need(found===null,'name-inventory-unavailable',frame.frameIndex);found=row;}active=null;},
    });
    const read=rawRead(ref,framer);reader=read.result;if(read.error)throw read.error;
    need(same(reader.before,upstreamReader.before)&&reader.bytes===upstreamReader.bytes&&reader.sha256===upstreamReader.sha256,'input-unavailable');
    need(census.literalPrefixEvents===1,'name-inventory-unavailable');const witness=correspondence(found,study,work),observations=descriptors(study,witness,work);
    // Previously charged components replace empty/null slots. This skeleton and
    // array delimiters conservatively pay for the rest of the complete report.
    work.add('persistentUTF8',observations.thread.occurrences.length+observations.process.occurrences.length);
    work.persist({kind:'native-wheel-raw-census-v1',status:'complete-native-wheel-raw-census-diagnostic',reason:null,failurePacketIndex:null,...AUTHORITY,
      trace:ref,census,witness:null,descriptors:{thread:{fields:null,occurrences:[]},process:{fields:null,occurrences:[]}},reader,upstreamReader,
      sourceBookends:{stable:true,files:[]},budgets:{fields:131072,repeated:65536,persistentUTF8:262144}});
    answer={trace:ref,census,witness,descriptors:observations};
  }catch(error){failure=error instanceof Refusal?error:new Refusal('raw-unavailable');}
  if(before!==null)try{sourceAfter(roles,before);}catch(error){failure=error instanceof Refusal?error:new Refusal('source-unavailable');}
  if(failure===null)try{need(same(identity(fs.lstatSync(ref.path,{bigint:true})),reader.after),'input-unavailable');}catch{failure=new Refusal('input-unavailable');}
  const result={kind:'native-wheel-raw-census-v1',status:failure===null?'complete-native-wheel-raw-census-diagnostic':'unavailable',reason:failure?.reason??null,failurePacketIndex:failure?.packetIndex??null,...AUTHORITY,
    trace:failure===null?answer.trace:null,census:failure===null?answer.census:null,witness:failure===null?answer.witness:null,descriptors:failure===null?answer.descriptors:null,
    reader,upstreamReader,sourceBookends:{stable:before!==null&&failure?.reason!=='source-drift'&&failure?.reason!=='source-unavailable'&&failure?.reason!=='dependency-unavailable',files:before??[]},budgets:work?.used??null};
  // Never load a validator after a dependency's source admission failed.
  if(finish===null)return freeze({...result,reader:null,upstreamReader:null,sourceBookends:{stable:false,files:[]},budgets:null});
  // Use the existing bounded whole-result validator; do not export a new schema or enlarge its caps.
  try{finish(result);return freeze(result);}
  catch{return freeze({kind:'native-wheel-raw-census-v1',status:'unavailable',reason:'result-capacity',failurePacketIndex:null,...AUTHORITY,trace:null,census:null,witness:null,descriptors:null,reader:null,upstreamReader:null,sourceBookends:{stable:false,files:[]},budgets:null});}
}
