import {COMPARISON_CAPTURE_LIMITS,canonicalSerialize,type ComparisonPrimitiveToken,type ComparisonDeadline} from '@chat-ui-bench/contract';
import * as fs from 'node:fs/promises';
import {constants,type BigIntStats} from 'node:fs';
import {isAbsolute,normalize,relative,dirname,join,sep} from 'node:path';
import {createHash} from 'node:crypto';
import type {ComparisonOwnershipClock} from './comparison-ownership.js';
import {z} from 'zod';
import {admitHistoryTokens,historyWindowRecordSchema,createOriginalDisposalGuard} from './history-window-diagnostic.js';
const unavailable=z.strictObject({status:z.literal('unavailable'),reason:z.string().min(1).max(4096)});
const fact=z.union([unavailable,z.strictObject({status:z.literal('available'),value:z.json()}),z.strictObject({status:z.literal('available'),byteLength:z.number().int().nonnegative(),sha256:z.string().regex(/^[a-f0-9]{64}$/)})]);
const headerSchema=z.strictObject({format:z.literal('history-window-diagnostic-v1'),trialIndex:z.union([z.literal(0),z.literal(1)]),collectorVersion:z.literal('2.1.0'),analyzerVersion:z.literal('2.1.0'),scoringEligibility:z.literal(false),unscored:z.literal(true),notCanonicalComparisonResult:z.literal(true),facts:z.record(z.string().min(1).max(4096),fact)}).refine(v=>Object.keys(v.facts).length<=4096);
const terminalSchema=z.strictObject({status:z.enum(['prepared','unavailable']),sourceClosureVerified:z.boolean(),canonicalClosureVerified:z.boolean(),scoringEligibility:z.literal(false)});
export type HistoryCompanion=Readonly<{components:readonly string[];byteLength:number}>;
let companions:WeakSet<object>|undefined;
let companionRecordCounts:WeakMap<object,number>|undefined;
/** Only an already acquired owned primitive fact is admitted; never invokes accessors or toJSON. */
function headerFactTokens(value:unknown,maxBytes:number):ComparisonPrimitiveToken[]{
 const tokens:ComparisonPrimitiveToken[]=[];let bytes=0;
 const add=(n:number)=>{bytes+=n;if(bytes>maxBytes)throw new Error('Header fact byte capacity');};
 const push=(...v:ComparisonPrimitiveToken[])=>{if(tokens.length+v.length>COMPARISON_CAPTURE_LIMITS.maxRecordTokens)throw new Error('Header fact token capacity');tokens.push(...v);};
 const quote=(text:string)=>{add(2);for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);if(c===34||c===92)add(2);else if(c<32)add(6);else if(c<128)add(1);else if(c<2048)add(2);else if(c>=0xd800&&c<=0xdbff&&text.charCodeAt(i+1)>=0xdc00&&text.charCodeAt(i+1)<=0xdfff){add(4);i++;}else if(c>=0xd800&&c<=0xdfff)add(6);else add(3);}};
 const visit=(v:unknown,depth:number):void=>{
  if(depth>COMPARISON_CAPTURE_LIMITS.maxRecordDepth)throw new Error('Header fact depth capacity');
  if(v===null){add(4);push('null');return;}if(typeof v==='string'){quote(v);push('string',v);return;}if(typeof v==='boolean'){add(v?4:5);push('boolean',v);return;}if(typeof v==='number'){if(!Number.isFinite(v))throw new Error('Header finite number required');add(String(v).length);push('number',v);return;}
  if(typeof v!=='object')throw new Error('Header primitive fact required');
  if(Array.isArray(v)){if(v.length>COMPARISON_CAPTURE_LIMITS.maxRecordTokens)throw new Error('Header fact token capacity');add(2+Math.max(0,v.length-1));push('array',v.length);for(let i=0;i<v.length;i++){const d=Object.getOwnPropertyDescriptor(v,String(i));if(!d||!('value'in d))throw new Error('Header accessor unavailable');visit(d.value,depth+1);}return;}
  const prototype=Object.getPrototypeOf(v);if(prototype!==null&&prototype!==Object.prototype)throw new Error('Header owned plain object required');const keys:string[]=[];
  for(const key in v)if(Object.hasOwn(v,key)){if(keys.length===4096)throw new Error('Header fact field capacity');const d=Object.getOwnPropertyDescriptor(v,key);if(!d||!('value'in d))throw new Error('Header accessor unavailable');if(d.value!==undefined)keys.push(key);}
  keys.sort();add(2+Math.max(0,keys.length-1));push('object',keys.length);for(const key of keys){quote(key);add(1);push(key);visit(Object.getOwnPropertyDescriptor(v,key)!.value,depth+1);}
 };
 visit(value,0);return tokens;
}
export function encodeHistoryHeaderFact(value:unknown):string{return admitHistoryTokens(headerFactTokens(value,65536));}
type HistoryTransfer={status:'snapshots-admitted'|'unavailable';records:readonly string[];finalOwnershipVerified:false;scoringEligibility:false;ownerRelation:string;signedOffsetCssPx:number|null;absoluteOffsetCssPx:number|null;omittedFailures:number;recordCount:number};
const transferSchema=z.strictObject({status:z.enum(['snapshots-admitted','unavailable']),records:z.array(z.string()).max(3),finalOwnershipVerified:z.literal(false),scoringEligibility:z.literal(false),ownerRelation:z.enum(['same-original-owner','changed-owner','not-in-admitted-candidates','anchor-not-acquired','unavailable']),signedOffsetCssPx:z.number().finite().nullable(),absoluteOffsetCssPx:z.number().finite().nonnegative().nullable(),omittedFailures:z.number().int().nonnegative(),recordCount:z.number().int().min(0).max(3)});
export interface HistoryWindowExperiment {
 readonly trialIndex:0|1;
 validateSlot(context:import('./long-thread-run.js').ComparisonSlotContext):void;
 transfer(value:unknown):void;
 fail(error:unknown):void;
 ownershipSettled():Promise<void>;
 finish(input:{canonicalRoot:string;deadline:ComparisonDeadline;clock:ComparisonOwnershipClock;canonicalSettled:boolean;facts:readonly Readonly<{key:string;value:unknown}>[]}):Promise<void>;
 snapshot():{transfer:HistoryTransfer|null;publication:HistoryPublicationOutcome|null;originalFailures:readonly unknown[];omittedFailures:number;canContinue:boolean};
}
type ExperimentOptions={sibling:string;sources?:readonly SourceFact[];sourceGraphAuthority?:PublicationInput['sourceGraphAuthority'];previous?:HistoryWindowExperiment;io?:Io};
let experiments:WeakSet<object>|undefined;
export function createHistoryWindowExperiment(mode:unknown,collector:unknown,analyzer:unknown,trial:unknown,rawOptions?:unknown):HistoryWindowExperiment|null{
 if(typeof mode!=='string'||mode!=='none'&&mode!=='history-window-diagnostic-v1')throw new Error('Unsupported history diagnostic mode');
 if(mode==='none')return null;
 if(collector!=='2.1.0'||analyzer!=='2.1.0')throw new Error('Diagnostic requires explicit matched2.1 family');
 if(trial!==0&&trial!==1)throw new Error('Unsupported fixed diagnostic trial');
 const options=rawOptions as ExperimentOptions|undefined;
 if(trial===1&&(!options?.previous||!experiments?.has(options.previous)||options.previous.trialIndex!==0||!options.previous.snapshot().canContinue))throw new Error('Previous original trial has unknown or unsafe closure');
 if(!options||typeof options.sibling!=='string')throw new Error('Explicit independent sibling required');
 if((options.sources?.length??0)>4096)throw new Error('Source inventory capacity');
 const sibling=options.sibling,sourceGraphAuthority=options.sourceGraphAuthority===undefined?undefined:Object.freeze({...options.sourceGraphAuthority}),ports=options.io===undefined?undefined:Object.freeze({...options.io});
 const sourceFacts=Object.freeze((options.sources??[]).map(v=>Object.freeze({...v}))),errors:unknown[]=[];let omitted=0,taken=false,finished=false,transfer:HistoryTransfer|null=null,publication:ReturnType<typeof startHistoryPublication>|null=null;
 const fail=(error:unknown)=>{if(errors.length<32)errors.push(error);else omitted++;};
 const session:HistoryWindowExperiment={trialIndex:trial,
  validateSlot(context){const w=context.fixture.workload;if(context.comparisonVersion!=='2.1.0'||context.identity.collectorVersion!=='2.1.0'||context.identity.analyzerVersion!=='2.1.0')throw new Error('Diagnostic requires explicit matched2.1 family');if(context.identity.caseIndex!==(trial===0?1:5)||context.descriptor.seed!==1||w.seed!==1||w.historyCount!==(trial===0?100:1000)||w.responseBytes!==6400||w.journey!=='history-reading')throw new Error('Fixed original diagnostic trial differs');},
  transfer(value){if(taken)throw new Error('Diagnostic transfer can occur once');taken=true;
   // The original page returns only this closed bounded primitive shape.
   if(value===null||typeof value!=='object')throw new Error('Diagnostic transfer unavailable');
   const records=(value as {records?:unknown}).records;if(!Array.isArray(records)||records.length>3)throw new Error('Diagnostic transfer capacity');
   let bytes=0;for(const record of records){if(typeof record!=='string')throw new Error('Diagnostic primitive record unavailable');bytes+=serializedBytes(record,COMPARISON_CAPTURE_LIMITS.maxRecordSerializedBytes);if(bytes>3*COMPARISON_CAPTURE_LIMITS.maxRecordSerializedBytes)throw new Error('Diagnostic snapshot capacity');}
   const parsed=transferSchema.parse(value);for(let i=0;i<parsed.records.length;i++){const r=historyWindowRecordSchema.parse(JSON.parse(parsed.records[i]!));if(r.requestOrdinal!==i)throw new Error('Diagnostic original role order');}
   if(parsed.status==='snapshots-admitted'&&(parsed.records.length!==3||parsed.recordCount!==3||parsed.omittedFailures!==0))throw new Error('Diagnostic transfer completeness differs');transfer=Object.freeze({...parsed,records:Object.freeze(parsed.records.slice())});
  },fail,
  async finish(input){if(finished){fail(new Error('Diagnostic finalization can occur once'));return;}finished=true;
   try{
    const preparation=createOriginalDisposalGuard(input.deadline,input.clock.now);preparation.assertRemaining();
    const facts:Record<string,unknown>=Object.create(null) as Record<string,unknown>;if(input.facts.length>4094)throw new Error('Header fact capacity');
    for(const f of input.facts){if(Object.hasOwn(facts,f.key)||f.key.length>4096)throw new Error('Header original fact key');facts[f.key]=f.value===null?{status:'unavailable',reason:'Original fact not acquired'}:{status:'available',value:f.value};}
    if(Object.hasOwn(facts,'declaredSourceInventory')||Object.hasOwn(facts,'sourceGraphCallerReviewPrecondition'))throw new Error('Reserved header source fact');
    facts.declaredSourceInventory=sourceFacts.length?{status:'available',value:sourceFacts}:{status:'unavailable',reason:'No independently bound source inventory supplied'};
    facts.sourceGraphCallerReviewPrecondition=sourceGraphAuthority?{status:'available',value:sourceGraphAuthority}:{status:'unavailable',reason:'Complete execution graph review authority not supplied'};
    const header=headerFactTokens({format:'history-window-diagnostic-v1',trialIndex:trial,collectorVersion:'2.1.0',analyzerVersion:'2.1.0',scoringEligibility:false,unscored:true,notCanonicalComparisonResult:true,facts},COMPARISON_CAPTURE_LIMITS.maxRecordSerializedBytes);
    // Packet describes preparation, not its own final source/FD/close authority.
    const terminal:ComparisonPrimitiveToken[]=['object',4,'status','string','unavailable','sourceClosureVerified','boolean',false,'canonicalClosureVerified','boolean',input.canonicalSettled,'scoringEligibility','boolean',false];
    const packet=admitHistoryCompanion(header,transfer?.records??[],terminal);preparation.assertRemaining();
    publication=startHistoryPublication({...input,sibling,packet,sources:sourceFacts,...(sourceGraphAuthority?{sourceGraphAuthority}:{}),...(ports?{io:ports}:{})});await publication.result;
   }catch(error){fail(error);}
  },
  ownershipSettled(){return publication?.settled??Promise.resolve();},
  snapshot(){const p=publication?.snapshot()??null;return {transfer,publication:p,originalFailures:Object.freeze(errors.slice()),omittedFailures:omitted,canContinue:errors.length===0&&omitted===0&&transfer?.status==='snapshots-admitted'&&p?.canContinue===true};},
 };
 (experiments??=new WeakSet<object>()).add(session);return Object.freeze(session);
}
export function requireHistoryWindowExperiment(value:unknown):HistoryWindowExperiment{if(value===null||typeof value!=='object'||!experiments?.has(value))throw new Error('Original history experiment session required');return value as HistoryWindowExperiment;}
type Epoch=readonly string[];
const epoch=(s:BigIntStats):Epoch=>Object.freeze([s.dev,s.ino,s.size,s.mtimeNs,s.ctimeNs,s.mode,s.nlink].map(String));
const same=(a:Epoch,b:Epoch)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const sameOwner=(a:BigIntStats,b:BigIntStats)=>a.dev===b.dev&&a.ino===b.ino;
type SourceFact={path:string;byteLength:number;sha256:string};
type Io=Partial<Pick<typeof fs,'open'|'opendir'|'mkdir'|'lstat'>>;
type PublicationInput={sibling:string;canonicalRoot:string;packet:HistoryCompanion;deadline:ComparisonDeadline;clock:ComparisonOwnershipClock;canonicalSettled:boolean;sources:readonly SourceFact[];sourceGraphAuthority?:{status:'reviewed-execution-graph';proofSha256:string};io?:Io};
type DataParent={path:string;dev:string;ino:string};
type ReadWitness={path:string;byteLength:number;sha256:string;epoch:Epoch;ancestors:readonly DataParent[];closeAttempted:true;closeCompleted:boolean};
type PublicationWitness={recording:{createdEpoch:Epoch|null;finalFdEpoch:Epoch|null;closeAttempted:boolean;closeCompleted:boolean;expectedSha256:string};readback:ReadWitness|null;directory:{createdEpoch:Epoch|null;beforeCloseEpoch:Epoch|null;finalEpoch:Epoch|null;members:readonly string[];observedEntries:number;enumerationComplete:boolean;iteratorCloseAttempted:boolean;iteratorCloseCompleted:boolean};sources:readonly ReadWitness[];sharedAncestors:readonly DataParent[]};
export type HistoryPublicationOutcome={status:'published'|'unavailable';canContinue:boolean;scoringEligibility:false;pending:boolean;originalFailures:readonly unknown[];omittedFailures:number;byteLength:number;sha256:string|null;path:string;sourceClosureVerified:boolean;canonicalClosureVerified:boolean;sourceGraphAuthorityKind:'caller-review-precondition'|'unavailable';witness:PublicationWitness};
/** Independent original IO stays tracked after expiry; no new disposal lease or self-dependent join. */
export function startHistoryPublication(input:PublicationInput):{result:Promise<HistoryPublicationOutcome>;settled:Promise<void>;snapshot:()=>HistoryPublicationOutcome}{
 if(!companions?.has(input.packet))throw new Error('Genuine admitted companion required');
 for(const path of [input.sibling,input.canonicalRoot])if(typeof path!=='string'||path.length>4096||!isAbsolute(path)||normalize(path)!==path||path.includes('\0')||path===sep)throw new Error('Normalized original publication paths required');
 const inside=(a:string,b:string)=>{const r=relative(a,b);return r===''||r!=='..'&&!r.startsWith('..'+sep)&&!isAbsolute(r);};
 if(inside(input.canonicalRoot,input.sibling)||inside(input.sibling,input.canonicalRoot))throw new Error('Independent sibling overlaps canonical root');
 if(input.sources.length>4096)throw new Error('Source inventory capacity');
 const sourcePaths=new Set<string>();for(const source of input.sources){if(typeof source.path!=='string'||source.path.length>4096||sourcePaths.has(source.path)||!Number.isSafeInteger(source.byteLength)||source.byteLength<0||source.byteLength>COMPARISON_CAPTURE_LIMITS.maxPendingSerializedBytes||typeof source.sha256!=='string'||!/^[a-f0-9]{64}$/.test(source.sha256))throw new Error('Original declared source fact unavailable');sourcePaths.add(source.path);}
 const io={...fs,...input.io},guard=createOriginalDisposalGuard(input.deadline,input.clock.now),path=join(input.sibling,'companion.json'),failures:unknown[]=[];
 guard.assertRemaining();const expectedHash=createHash('sha256');for(const component of input.packet.components){guard.assertRemaining();expectedHash.update(component,'utf8');}guard.assertRemaining();const expectedDigest=expectedHash.digest('hex');
 const witness:PublicationWitness={recording:{createdEpoch:null,finalFdEpoch:null,closeAttempted:false,closeCompleted:false,expectedSha256:expectedDigest},readback:null,directory:{createdEpoch:null,beforeCloseEpoch:null,finalEpoch:null,members:[],observedEntries:0,enumerationComplete:false,iteratorCloseAttempted:false,iteratorCloseCompleted:false},sources:[],sharedAncestors:[]};
 let omitted=0,pending=true,expired=false,published=false,sourceVerified=false,digest:string|null=null,actualBytes=0;
 const fail=(e:unknown)=>{if(failures.length<32)failures.push(e);else omitted++;};
 const assertActive=()=>{if(expired)throw new Error('Original diagnostic disposal deadline exhausted');guard.assertRemaining();};
 const snapshot=():HistoryPublicationOutcome=>({status:published&&!expired&&!failures.length&&!omitted?'published':'unavailable',canContinue:published&&!expired&&!pending&&!failures.length&&!omitted&&sourceVerified&&input.canonicalSettled&&input.sourceGraphAuthority?.status==='reviewed-execution-graph'&&/^[a-f0-9]{64}$/.test(input.sourceGraphAuthority.proofSha256)&&companionRecordCounts?.get(input.packet)===3,scoringEligibility:false,pending,originalFailures:Object.freeze(failures.slice()),omittedFailures:omitted,byteLength:actualBytes,sha256:digest,path,sourceClosureVerified:sourceVerified&&!expired&&!pending&&!failures.length&&!omitted&&input.sourceGraphAuthority?.status==='reviewed-execution-graph'&&/^[a-f0-9]{64}$/.test(input.sourceGraphAuthority.proofSha256),canonicalClosureVerified:input.canonicalSettled,sourceGraphAuthorityKind:input.sourceGraphAuthority===undefined?'unavailable':'caller-review-precondition',witness:{...witness,recording:{...witness.recording},directory:{...witness.directory,members:Object.freeze([...witness.directory.members])},sources:Object.freeze([...witness.sources]),sharedAncestors:Object.freeze([...witness.sharedAncestors])}});
 type Parent={path:string;stat:BigIntStats};
 const dataParents=(rows:readonly Parent[]):readonly DataParent[]=>Object.freeze(rows.map(v=>Object.freeze({path:v.path,dev:String(v.stat.dev),ino:String(v.stat.ino)})));
 async function parents(file:string):Promise<Parent[]>{const rows:Parent[]=[];let current=dirname(file);while(current!==sep){assertActive();const s=await io.lstat(current,{bigint:true});assertActive();if(!s.isDirectory()||s.isSymbolicLink())throw new Error('Unsafe diagnostic ancestor');rows.unshift({path:current,stat:s});current=dirname(current);}return rows;}
 async function recheckParents(rows:readonly Parent[]){for(const row of rows){const s=await io.lstat(row.path,{bigint:true});if(!s.isDirectory()||s.isSymbolicLink()||!sameOwner(s,row.stat))throw new Error('Original diagnostic ancestor changed');}}
 async function readChecked(file:string,expected:SourceFact,original?:Epoch):Promise<{epoch:Epoch;parents:Parent[];witness:ReadWitness}>{
  assertActive();if(!isAbsolute(file)||normalize(file)!==file||file.includes('\0'))throw new Error('Normalized original source/readback path required');const ancestors=await parents(file),initial=await io.lstat(file,{bigint:true});
  if(!initial.isFile()||initial.isSymbolicLink()||initial.nlink!==1n||initial.size!==BigInt(expected.byteLength)||expected.byteLength<0||expected.byteLength>COMPARISON_CAPTURE_LIMITS.maxPendingSerializedBytes||!/^[a-f0-9]{64}$/.test(expected.sha256))throw new Error('Original diagnostic source/readback admission');
  if(original&&!same(epoch(initial),original))throw new Error('Original diagnostic readback identity changed');
  assertActive();const fd=await io.open(file,constants.O_RDONLY|constants.O_NOFOLLOW);const priorFailures=failures.length,priorOmitted=omitted;let failed=false,primary:unknown,closed=false,observedBytes=0,observedSha256:string|null=null;
  try{
   assertActive();if(!same(epoch(await fd.stat({bigint:true})),epoch(initial)))throw new Error('Original diagnostic FD differs');const hash=createHash('sha256'),buffer=Buffer.alloc(65536);let bytes=0;
   for(;;){assertActive();const r=await fd.read(buffer,0,Math.min(buffer.length,expected.byteLength-bytes+1),bytes);assertActive();if(!Number.isSafeInteger(r.bytesRead)||r.bytesRead<0||r.bytesRead>buffer.length)throw new Error('Original diagnostic read count');if(!r.bytesRead)break;bytes+=r.bytesRead;if(bytes>expected.byteLength)throw new Error('Original diagnostic bytes changed');hash.update(buffer.subarray(0,r.bytesRead));}
   observedBytes=bytes;observedSha256=hash.digest('hex');if(bytes!==expected.byteLength||observedSha256!==expected.sha256||!same(epoch(await fd.stat({bigint:true})),epoch(initial)))throw new Error('Original diagnostic readback bytes differ');
  }catch(e){failed=true;primary=e;}
  try{await fd.close();closed=true;}catch(e){if(failed){fail(primary);failed=false;}fail(e);}
  if(failed)fail(primary);
  const final=await io.lstat(file,{bigint:true});await recheckParents(ancestors);if(!same(epoch(final),epoch(initial)))throw new Error('Original diagnostic file changed after close');assertActive();if(failures.length!==priorFailures||omitted!==priorOmitted||!closed||observedSha256===null)throw new Error('Original diagnostic read or close incomplete');return {epoch:epoch(initial),parents:ancestors,witness:Object.freeze({path:file,byteLength:observedBytes,sha256:observedSha256,epoch:epoch(initial),ancestors:dataParents(ancestors),closeAttempted:true,closeCompleted:closed})};
 }
 const sourceEpochs:{fact:SourceFact;epoch:Epoch;parents:Parent[];witness:ReadWitness}[]=[];
 const body=(async()=>{
  let owned:BigIntStats|undefined,ownedFinal:Epoch|undefined,fileFinal:Epoch|undefined,ancestors:Parent[]=[];
  try{
   assertActive();ancestors=await parents(input.sibling);const canonicalParents=await parents(input.canonicalRoot),canonical=await io.lstat(input.canonicalRoot,{bigint:true});if(!canonical.isDirectory()||canonical.isSymbolicLink())throw new Error('Original canonical root unavailable');for(const source of input.sources){const observed=await readChecked(source.path,source);sourceEpochs.push({fact:source,...observed});}
   witness.sharedAncestors=dataParents(ancestors);witness.sources=Object.freeze(sourceEpochs.map(v=>v.witness));
   assertActive();await io.mkdir(input.sibling,{mode:0o700});owned=await io.lstat(input.sibling,{bigint:true});witness.directory.createdEpoch=epoch(owned);if(!owned.isDirectory()||owned.isSymbolicLink())throw new Error('Exclusive diagnostic directory unavailable');
   assertActive();const fd=await io.open(path,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);let failed=false,primary:unknown;
   try{
    assertActive();const initial=await fd.stat({bigint:true});witness.recording.createdEpoch=epoch(initial);if(!initial.isFile()||initial.nlink!==1n||initial.size!==0n||!same(epoch(initial),epoch(await io.lstat(path,{bigint:true}))))throw new Error('Original diagnostic recording FD unavailable');
    const hash=createHash('sha256');
    for(const component of input.packet.components){assertActive();const bytes=Buffer.from(component,'utf8');for(let offset=0;offset<bytes.length;){assertActive();const end=Math.min(bytes.length,offset+65536),written=await fd.write(bytes,offset,end-offset,actualBytes);if(!Number.isSafeInteger(written.bytesWritten)||written.bytesWritten<=0||written.bytesWritten>end-offset)throw new Error('Original diagnostic short write');hash.update(bytes.subarray(offset,offset+written.bytesWritten));offset+=written.bytesWritten;actualBytes+=written.bytesWritten;if(actualBytes>input.packet.byteLength)throw new Error('Original diagnostic written capacity');assertActive();}}
    const final=await fd.stat({bigint:true});fileFinal=epoch(final);witness.recording.finalFdEpoch=fileFinal;if(!sameOwner(initial,final)||final.nlink!==1n||!final.isFile()||final.size!==BigInt(actualBytes)||actualBytes!==input.packet.byteLength||!same(fileFinal,epoch(await io.lstat(path,{bigint:true}))))throw new Error('Original diagnostic written identity differs');digest=hash.digest('hex');
    if(digest!==expectedDigest)throw new Error('Original admitted diagnostic SHA differs');const dir=await io.lstat(input.sibling,{bigint:true});if(!dir.isDirectory()||dir.isSymbolicLink()||!sameOwner(dir,owned))throw new Error('Owned diagnostic directory replaced');ownedFinal=epoch(dir);witness.directory.beforeCloseEpoch=ownedFinal;
   }catch(e){failed=true;primary=e;}
   witness.recording.closeAttempted=true;try{await fd.close();witness.recording.closeCompleted=true;}catch(e){if(failed){fail(primary);failed=false;}fail(e);}
   if(failed)fail(primary);
   assertActive();if(failures.length||!fileFinal||!digest||!ownedFinal)throw new Error('Original diagnostic recording incomplete');
   witness.readback=(await readChecked(path,{path,byteLength:actualBytes,sha256:digest},fileFinal)).witness;
   // Final source FD closes precede the bounded owned iterator and terminal nonacquiring sweep.
   const finalSources:ReadWitness[]=[];for(const source of sourceEpochs)finalSources.push((await readChecked(source.fact.path,source.fact,source.epoch)).witness);witness.sources=Object.freeze(finalSources);
   assertActive();const directory=await io.opendir(input.sibling);let iteratorFailed=false,iteratorPrimary:unknown;const members:string[]=[];
   try{for(;;){assertActive();const member=await directory.read();assertActive();if(!member)break;witness.directory.observedEntries++;if(members.length===1)throw new Error('Diagnostic owned member capacity');members.push(member.name);witness.directory.members=Object.freeze(members.slice());if(member.name!=='companion.json'||!member.isFile()||member.isSymbolicLink())throw new Error('Unknown diagnostic owned member');}if(members.length!==1)throw new Error('Diagnostic member absent');witness.directory.enumerationComplete=true;}catch(e){iteratorFailed=true;iteratorPrimary=e;}
   witness.directory.iteratorCloseAttempted=true;try{await directory.close();witness.directory.iteratorCloseCompleted=true;}catch(e){if(iteratorFailed){fail(iteratorPrimary);iteratorFailed=false;}fail(e);}
   if(iteratorFailed)fail(iteratorPrimary);
   // No FD acquisition follows this sweep; later close cannot silently adopt an earlier replacement.
   assertActive();for(const source of sourceEpochs){const s=await io.lstat(source.fact.path,{bigint:true});if(!s.isFile()||s.isSymbolicLink()||!same(epoch(s),source.epoch))throw new Error('Original diagnostic source changed late');await recheckParents(source.parents);}
   const file=await io.lstat(path,{bigint:true}),dir=await io.lstat(input.sibling,{bigint:true});witness.directory.finalEpoch=epoch(dir);if(!file.isFile()||file.isSymbolicLink()||!same(epoch(file),fileFinal)||!dir.isDirectory()||dir.isSymbolicLink()||!same(epoch(dir),ownedFinal))throw new Error('Original diagnostic final epoch changed');await recheckParents(ancestors);const canonicalAfter=await io.lstat(input.canonicalRoot,{bigint:true});if(!canonicalAfter.isDirectory()||canonicalAfter.isSymbolicLink()||!sameOwner(canonicalAfter,canonical))throw new Error('Original canonical root changed');await recheckParents(canonicalParents);assertActive();sourceVerified=input.sources.length>0;published=failures.length===0&&omitted===0;
  }catch(e){fail(e);}
  finally{pending=false;}
 })();
 let timer:ReturnType<typeof setTimeout>|undefined;
 const expiry=new Promise<void>(resolve=>{try{timer=(input.clock.setTimer??setTimeout)(()=>{expired=true;fail(new Error('Original diagnostic disposal deadline exhausted'));resolve();},guard.remainingMs());}catch(e){expired=true;fail(e);resolve();}});
 const settled=body.then(()=>{});void settled.catch(()=>{});
 const result=Promise.race([settled,expiry]).then(()=>{if(timer!==undefined)try{(input.clock.clearTimer??clearTimeout)(timer);}catch(e){fail(e);}return snapshot();});
 return {result,settled,snapshot};
}
function serializedBytes(text:string,max:number):number{
 let bytes=0;
 for(let i=0;i<text.length;i++){
  const c=text.charCodeAt(i);if(c<128)bytes++;else if(c<2048)bytes+=2;else if(c>=0xd800&&c<=0xdbff&&text.charCodeAt(i+1)>=0xdc00&&text.charCodeAt(i+1)<=0xdfff){bytes+=4;i++;}else bytes+=3;
  if(bytes>max)throw new Error('Diagnostic serialized byte capacity');
 }return bytes;
}
/** Strings and tokens are already bounded primitives; no unchecked caller graph is serialized. */
export function admitHistoryCompanion(header:readonly ComparisonPrimitiveToken[],records:readonly string[],terminal:readonly ComparisonPrimitiveToken[]):HistoryCompanion{
 if(records.length>3)throw new Error('Diagnostic record capacity');
 const t=admitHistoryTokens(terminal),h=admitHistoryTokens(header);
 if(!headerSchema.safeParse(JSON.parse(h)).success)throw new Error('Header schema unavailable');
 const end=terminalSchema.parse(JSON.parse(t));
 const roles=['before','post','later'];
 if(serializedBytes(h,COMPARISON_CAPTURE_LIMITS.maxRecordSerializedBytes)+serializedBytes(t,COMPARISON_CAPTURE_LIMITS.maxRecordSerializedBytes)+'{"header":'.length+',"records":['.length+'],"terminal":'.length+'}\n'.length+Math.max(0,records.length-1)>COMPARISON_CAPTURE_LIMITS.maxRecordSerializedBytes)throw new Error('Diagnostic header and terminal reserve capacity');
 let bytes=serializedBytes(h,COMPARISON_CAPTURE_LIMITS.maxRecordSerializedBytes)+serializedBytes(t,COMPARISON_CAPTURE_LIMITS.maxRecordSerializedBytes)+'{"header":'.length+',"records":['.length+'],"terminal":'.length+'}\n'.length+Math.max(0,records.length-1);
 for(let i=0;i<records.length;i++){
  const text=records[i];if(typeof text!=='string')throw new Error('Diagnostic record must be primitive');
  bytes+=serializedBytes(text,COMPARISON_CAPTURE_LIMITS.maxRecordSerializedBytes);
  if(bytes>COMPARISON_CAPTURE_LIMITS.maxPendingSerializedBytes)throw new Error('Diagnostic companion byte capacity');
  const parsed=historyWindowRecordSchema.parse(JSON.parse(text));if(parsed.role!==roles[i]||parsed.requestOrdinal!==i)throw new Error('Diagnostic original role order');
 }
 if(bytes>COMPARISON_CAPTURE_LIMITS.maxPendingSerializedBytes)throw new Error('Diagnostic companion byte capacity');
 if(end.status==='prepared'&&(records.length!==3||!end.sourceClosureVerified||!end.canonicalClosureVerified))throw new Error('Diagnostic preparation closure unavailable');
 const components=Object.freeze(['{"header":',h,',"records":[',...records.flatMap((r,i)=>i?[',',r]:[r]),'],"terminal":',t,'}\n']);
 const exact=components.reduce((n,c)=>n+serializedBytes(c,COMPARISON_CAPTURE_LIMITS.maxPendingSerializedBytes),0);
 if(exact>COMPARISON_CAPTURE_LIMITS.maxPendingSerializedBytes)throw new Error('Diagnostic companion byte capacity');
 const packet=Object.freeze({components,byteLength:exact});(companions??=new WeakSet<object>()).add(packet);(companionRecordCounts??=new WeakMap<object,number>()).set(packet,records.length);return packet;
}
