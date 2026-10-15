/** Supplied-data policies only. No parser, SDK, filesystem or network imports. */
import {createHash} from 'node:crypto';
import {posix} from 'node:path';
import {assertDenseEntries,assertOriginalCommand,ordinaryPath,releaseTag,LIMITS,PRODUCTION_FILE_LIMITS,assertProductionCount,type OriginalCommand} from './hosted-copilot-contract.ts';
export interface ProviderRun {id:string;headSha:string;title:string;event:string;workflowId:string;attempt:number;tag?:string}
export interface ProviderPage<T> {page:number;totalCount:number|null;hasNext:boolean;records:readonly T[];status:number;bodyComplete:boolean}
export interface ProviderSnapshot {repository:string;workflowId:string;candidateSha:string;releaseId:string;currentRunId:string;currentRun:ProviderRun;runPages:ProviderPage<ProviderRun>[];releasePages:ProviderPage<{id:string;tag:string}>[];releaseLookupStatus:number;acquisitionClosed:boolean;draftVisibility:'unverified'|'root-reviewed-visible'}
function scalar(value:string,max=128):boolean{return typeof value==='string'&&value.length>0&&value.length<=max&&!/[\x00-\x1f\x7f]/.test(value)&&Buffer.byteLength(value)<=max;}
function identity(id:string):boolean{return scalar(id,20)&&/^[1-9][0-9]*$/.test(id);}
function sha(value:string,length=40):boolean{return typeof value==='string'&&value.length===length&&/^[a-f0-9]+$/.test(value);}
function pages<T>(input:readonly ProviderPage<T>[],counted:boolean):readonly T[] {
 assertDenseEntries(input,5);let count=0;const records:T[]=[];
 for(let index=0;index<input.length;index++) {
  const page=input[index]!;assertDenseEntries(page.records,100,true);
  if(page.page!==index+1||page.status!==200||page.bodyComplete!==true||page.hasNext!==(index<input.length-1)||page.hasNext&&page.records.length!==100) throw new Error('Incomplete provider page chain');
  count+=page.records.length;if(count>500) throw new Error('Provider record bound');
  if(counted?(!Number.isSafeInteger(page.totalCount)||page.totalCount===null||page.totalCount<0||page.totalCount!==input[0]!.totalCount):page.totalCount!==null) throw new Error('Provider total count inconsistent');
  records.push(...page.records);
 }
 if(counted&&count!==input[0]!.totalCount) throw new Error('Provider pages do not cover total');
 return records;
}
function validRun(run:ProviderRun):void {
 if(!identity(run.id)||!identity(run.workflowId)||!sha(run.headSha)||!scalar(run.title)||!scalar(run.event,32)||!Number.isSafeInteger(run.attempt)||run.attempt<1||run.tag!==undefined&&!scalar(run.tag)) throw new Error('Unrecognized provider run identity');
}
export function assertProviderSnapshot(v:ProviderSnapshot) {
 releaseTag(v.releaseId);validRun(v.currentRun);
 if(v.repository!=='cacheplane/chat-ui-bench'||!identity(v.workflowId)||!sha(v.candidateSha)||!identity(v.currentRunId)||v.acquisitionClosed!==true||!['unverified','root-reviewed-visible'].includes(v.draftVisibility)||v.releaseLookupStatus!==404) throw new Error('Provider acquisition facts denied');
 const current=v.currentRun;
 if(current.id!==v.currentRunId||current.workflowId!==v.workflowId||current.headSha!==v.candidateSha||current.title!==v.releaseId||current.event!=='workflow_dispatch'||current.attempt!==1||current.tag!==v.releaseId) throw new Error('Current original run differs');
 const runs=pages(v.runPages,true),ids=new Set<string>();let found=0;
 for(const run of runs) {
  validRun(run);if(ids.has(run.id)||run.workflowId!==v.workflowId) throw new Error('Duplicate or mismatched workflow row');ids.add(run.id);
  if(run.id===current.id) {if(run.headSha!==current.headSha||run.title!==current.title||run.event!==current.event||run.workflowId!==current.workflowId||run.attempt!==current.attempt||run.tag!==current.tag) throw new Error('Current listed row differs');found++;}
  else if(run.title===v.releaseId||run.headSha===v.candidateSha||run.tag===v.releaseId) throw new Error('Prior or competing observed use');
 }
 if(found!==1) throw new Error('Validated current row absent');
 const releases=pages(v.releasePages,false),releaseIds=new Set<string>();
 for(const release of releases) {if(!identity(release.id)||!scalar(release.tag)||releaseIds.has(release.id)) throw new Error('Release identity incomplete or duplicate');releaseIds.add(release.id);if(release.tag===v.releaseId) throw new Error('Observed release identity already used');}
 return Object.freeze({observedUnused:true as const,runRecords:runs.length,releaseRecords:releases.length,draftVisibility:v.draftVisibility,atomicLease:false as const,qualification:false as const,scope:'supplied acquisition-window observations only' as const});
}
function normalizeInNamespace(from:string,raw:string,names:readonly string[],maximum:number) {
 assertDenseEntries(names,maximum);if(names.some(name=>!ordinaryPath(name))||new Set(names).size!==names.length||!names.includes(from)||!ordinaryPath(from)||!scalar(raw,4096)||raw.includes('\\')||raw.startsWith('//')||/^[A-Za-z][A-Za-z0-9+.-]*:/.test(raw)) throw new Error('Unsupported resource URL or owner');
 const split=raw.indexOf('#'),path=split<0?raw:raw.slice(0,split),fragment=split<0?null:raw.slice(split+1);
 if(path.includes('?')||/%(?:2f|5c|00|25)/i.test(path)) throw new Error('Unsupported query/encoded separator');
 let decoded:string;try {decoded=decodeURIComponent(path);}catch {throw new Error('Malformed encoded resource URL');}
 const components=decoded.split('/'),original=path.split('/');
 if(components.some((part,index)=>(part==='.'||part==='..')&&original[index]?.includes('%'))) throw new Error('Encoded traversal');
 const target=path===''?from:posix.normalize(decoded.startsWith('/')?decoded.slice(1):posix.join(posix.dirname(from),decoded));
 if(!ordinaryPath(target)||!names.includes(target)) throw new Error('Unresolved or escaping resource');
 return Object.freeze({from,raw,target,fragment,sameDocument:path==='',qualification:false as const});
}
export function normalizeReference(from:string,raw:string,names:readonly string[]) {return normalizeInNamespace(from,raw,names,LIMITS.files);}
export function normalizeProductionReference(from:string,raw:string,names:readonly string[]) {
 if(Array.isArray(names)) assertProductionCount('output-files',names.length);
 return normalizeInNamespace(from,raw,names,PRODUCTION_FILE_LIMITS.outputFiles);
}
export function assertEmbeddedSvg(raw:string,occurrence=1) {
 const prefix='data:image/svg+xml;charset=utf-8,';
 if(!scalar(raw,4096)||!raw.startsWith(prefix)||!Number.isSafeInteger(occurrence)||occurrence<1||occurrence>16) throw new Error('Embedded data bound/type');
 let text:string;try{text=decodeURIComponent(raw.slice(prefix.length));}catch{throw new Error('Embedded data encoding');}
 const decodedBytes=Buffer.byteLength(text),decodedSha256=createHash('sha256').update(text).digest('hex');
 if(decodedBytes!==212||decodedSha256!=='5ca272b5c51f5790821b50ebfb5f2868f20230a839431baf92f45bfff38861ea') throw new Error('Unsupported decoded SVG content');
 return Object.freeze({rawBytes:Buffer.byteLength(raw),rawSha256:createHash('sha256').update(raw).digest('hex'),decodedBytes,decodedSha256,qualification:false as const});
}
export function assertReferenceCount(counts:readonly number[]):number {
 assertDenseEntries(counts,LIMITS.references,true);let count=0;
 for(const value of counts) {if(!Number.isSafeInteger(value)||value<0) throw new Error('Reference count invalid');count+=value;if(count>LIMITS.references) throw new Error('Reference occurrence overflow');}
 return count;
}
export function classifyJsReference(node:{kind:string;specifier:string|null;base:string|null}):string|null {
 if(node.kind==='endpoint') return null;
 if(!['import','export','dynamic-import','new-url'].includes(node.kind)||node.specifier===null||!scalar(node.specifier,4096)||node.kind==='new-url'&&node.base!=='import-meta-url') throw new Error('Ambiguous supplied JavaScript resource form');
 if(node.kind!=='new-url'&&!['./','../','/'].some(prefix=>node.specifier!.startsWith(prefix))) throw new Error('Bare ESM specifier unresolved');
 return node.specifier;
}
export interface ModuleMapping {id:string;kind:'physical'|'virtual';external:boolean;path?:string;sha256?:string}
export const MODULE_OWNERSHIP_LIMIT=16384;
/** Next zero-based ownership slot; count and character preflight precede byte scanning. */
export function assertModuleOwnershipId(id:unknown,index:number):asserts id is string {
 if(!Number.isSafeInteger(index)||index<0||index>=MODULE_OWNERSHIP_LIMIT) throw new Error('Module ownership count exceeds 16384');
 if(typeof id!=='string'||id.length===0||id.length>4096) throw new Error('Module ownership ID shape/length denied');
 if(Buffer.byteLength(id)>4096) throw new Error('Module ownership ID byte bound');
}
export function assertMappings(input:readonly ModuleMapping[]) {
 if(Array.isArray(input)&&input.length>MODULE_OWNERSHIP_LIMIT) throw new Error('Module ownership count exceeds 16384');
 assertDenseEntries(input,MODULE_OWNERSHIP_LIMIT,true);const ids=new Set<string>();let physical=0,virtual=0,index=0;
 for(const row of input) {
  assertModuleOwnershipId(row.id,index++);
  if(ids.has(row.id)||row.external!==false) throw new Error('Module mapping unavailable/duplicate/external');ids.add(row.id);
  if(row.kind==='physical') {if(!row.path||!ordinaryPath(row.path)||!row.sha256||!sha(row.sha256,64)||row.id.includes('\0')) throw new Error('Physical module ownership absent');physical++;}
  else if(row.kind==='virtual') {if(!(row.id.startsWith('\0')||row.id.startsWith('virtual:'))||row.path!==undefined||row.sha256!==undefined) throw new Error('Virtual module ownership differs');virtual++;}
  else throw new Error('Unsupported module mapping kind');
 }
 return Object.freeze({physical,virtual,qualification:false as const,scope:'supplied module classifications only' as const});
}
export interface ManifestRecord {key:string;file:string;imports:readonly string[];dynamicImports:readonly string[];css:readonly string[];assets:readonly string[]}
function manifestInNamespace(rows:readonly ManifestRecord[],names:readonly string[],rowMaximum:number,nameMaximum:number) {
 assertDenseEntries(rows,rowMaximum);assertDenseEntries(names,nameMaximum);const records=new Map<string,ManifestRecord>();let count=0;
 if(names.some(name=>!ordinaryPath(name))||new Set(names).size!==names.length) throw new Error('Manifest admitted file names differ');
 for(const row of rows) {
  if(!scalar(row.key,4096)||records.has(row.key)||!ordinaryPath(row.file)||!names.includes(row.file)) throw new Error('Manifest owner/key unavailable');
  for(const refs of [row.imports,row.dynamicImports,row.css,row.assets]) {assertDenseEntries(refs,LIMITS.references,true);count=assertReferenceCount([count,refs.length]);}
  count=assertReferenceCount([count,1]);records.set(row.key,row);
 }
 const references:{from:string;target:string}[]=[];
 for(const row of rows) {
  for(const key of [...row.imports,...row.dynamicImports]) {const other=records.get(key);if(!other) throw new Error('Manifest import key missing');references.push({from:row.file,target:other.file});}
  for(const path of [...row.css,...row.assets]) {if(!ordinaryPath(path)||!names.includes(path)) throw new Error('Manifest resource missing');references.push({from:row.file,target:path});}
 }
 return Object.freeze({referenceCount:count,references:Object.freeze(references.map(ref=>Object.freeze(ref))),qualification:false as const});
}
export function assertManifest(rows:readonly ManifestRecord[],names:readonly string[]) {return manifestInNamespace(rows,names,LIMITS.files,LIMITS.files);}
export function assertProductionManifest(rows:readonly ManifestRecord[],names:readonly string[]) {
 if(Array.isArray(rows)) assertProductionCount('manifest-records',rows.length);
 if(Array.isArray(names)) assertProductionCount('output-files',names.length);
 return manifestInNamespace(rows,names,PRODUCTION_FILE_LIMITS.manifestRecords,PRODUCTION_FILE_LIMITS.outputFiles);
}
function expectedFailure(original:OriginalCommand):void {const v=assertOriginalCommand(original);if(!v.closed||!v.streamsComplete||!v.uploadEligible||v.exitCode!==1||v.signal!==null) throw new Error('Original declared failure incomplete or changed');}
export interface AuditCounts {info:number;low:number;moderate:number;high:number;critical:number;total:number}
export function assertFullAudit(full:OriginalCommand,counts:AuditCounts):void {
 expectedFailure(full);if(!counts||counts.info!==0||counts.low!==9||counts.moderate!==0||counts.high!==0||counts.critical!==0||counts.total!==9) throw new Error('Audit exception differs');
}
export function assertExpectedAudit(full:OriginalCommand,high:OriginalCommand,counts:AuditCounts) {
 assertFullAudit(full,counts);if(!assertOriginalCommand(high).success) throw new Error('Audit exception differs');
 return Object.freeze({fullAuditExitCode:1 as const,fullAuditSuccess:false as const,policyMayContinue:true as const,qualification:false as const});
}
export interface CapturedStreamFacts {readableEOF:boolean;writerFinish:boolean;writerClose:boolean;writerError:boolean;seen:number;retained:number;retainedBytesKnown:boolean}
export function capturedStreamComplete(v:CapturedStreamFacts):boolean {
 return v.readableEOF===true&&v.writerFinish===true&&v.writerClose===true&&v.writerError===false&&v.retainedBytesKnown===true&&Number.isSafeInteger(v.seen)&&v.seen>=0&&Number.isSafeInteger(v.retained)&&v.seen===v.retained;
}
const expectedVendor:Readonly<Record<string,number>>=Object.freeze({mcpAppsRenderer:1677,ai:8,reactCore:6,runtimeClientGql:3,shared:3,channelsCore:1,runtime:1,mcpSdk:1,urql:1,mermaid:1});
export function assertExpectedVendor(original:OriginalCommand,owned:number,categories:readonly {category:string;count:number}[]) {
 expectedFailure(original);assertDenseEntries(categories,10);const seen=new Set<string>();let total=0;
 if(owned!==0||categories.length!==10) throw new Error('Owned/new vendor diagnostic category');
 for(const row of categories) {if(!Object.hasOwn(expectedVendor,row.category)||seen.has(row.category)||row.count!==expectedVendor[row.category]) throw new Error('Vendor category/count changed');seen.add(row.category);total+=row.count;}
 return Object.freeze({vendorExitCode:1 as const,vendorSuccess:false as const,total,policyMayContinue:true as const,qualification:false as const});
}

/** Parses supplied Link syntax only; callers construct requests independently. */
export function assertProviderNextLink(link:string|null,path:string,page:number):boolean {
 if(!Number.isSafeInteger(page)||page<1||page>5) throw new Error('Provider page bound');
 if(link===null||link==='') return false;
 if(!scalar(link,8192)) throw new Error('Provider Link scalar bound');
 const seen=new Set<string>();let next=false,last:number|undefined;
 for(const item of link.split(',')) {
  const match=/^\s*<([^>]+)>;\s*rel="(next|prev|first|last)"\s*$/.exec(item);
  if(!match?.[1]||!match[2]||seen.has(match[2])) throw new Error('Malformed or duplicate provider Link');
  seen.add(match[2]);const url=new URL(match[1]),target=Number(url.searchParams.get('page'));
  if(url.origin!=='https://api.github.com'||url.pathname!==path||url.hash!==''||url.username!==''||url.password!==''||url.searchParams.get('per_page')!=='100'||[...url.searchParams.keys()].length!==2||!Number.isSafeInteger(target)||target<1||target>5) throw new Error('Unexpected provider pagination URL');
  if(match[2]==='next') {if(target!==page+1) throw new Error('Missing provider next page');next=true;}
  else if(match[2]==='prev'&&target!==page-1||match[2]==='first'&&target!==1||match[2]==='last'&&target<page) throw new Error('Inconsistent provider Link relation');
  if(match[2]==='last') last=target;
 }
 if(last!==undefined&&(last>page)!==next) throw new Error('Provider last/next chain incomplete');
 return next;
}

export function classifyVendorDiagnostics(text:string):{owned:number;total:number;categories:{category:string;count:number}[]} {
 if(Buffer.byteLength(text)>4*1024*1024) throw new Error('Original compiler output bound');
 const paths:Readonly<Record<string,string>>={'@copilotkit/mcp-apps-renderer':'mcpAppsRenderer','ai':'ai','@copilotkit/react-core':'reactCore','@copilotkit/runtime-client-gql':'runtimeClientGql','@copilotkit/shared':'shared','@copilotkit/channels-core':'channelsCore','@copilotkit/runtime':'runtime','@modelcontextprotocol/sdk':'mcpSdk','@urql/core':'urql','mermaid':'mermaid'};
 const counts=new Map<string,number>();let owned=0,total=0;
 for(const line of text.replace(/\x1b\[[0-9;]*m/g,'').split('\n')) {
  const match=/^(.+)\([0-9]+,[0-9]+\): error TS[0-9]+:/.exec(line);if(!match?.[1]) continue;
  if(++total>4096) throw new Error('Original diagnostic count bound');
  const category=Object.entries(paths).find(([path])=>match[1]!.includes(`node_modules/${path}/`))?.[1];
  if(category) counts.set(category,(counts.get(category)??0)+1);else owned++;
 }
 return {owned,total,categories:[...counts].map(([category,count])=>({category,count}))};
}
