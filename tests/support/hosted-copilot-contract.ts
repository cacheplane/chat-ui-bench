/** Inert declared-input policies. They neither parse assets nor prove release/API/runtime facts. */
export const LIMITS=Object.freeze({files:128,bytes:32*1024*1024,references:4096});
/** Fixed production cohorts; generic/source/mounted inventory remains128. */
export const PRODUCTION_FILE_LIMITS=Object.freeze({hookFiles:1024,outputFiles:1025,manifestRecords:1024,artifactFiles:1152,visitedEntries:4096});
type ProductionCountDomain='hook-files'|'output-files'|'manifest-records'|'artifact-files'|'visited-entries'|'final-files'|'final-entries';
const productionCounts=Object.freeze({'hook-files':PRODUCTION_FILE_LIMITS.hookFiles,'output-files':PRODUCTION_FILE_LIMITS.outputFiles,'manifest-records':PRODUCTION_FILE_LIMITS.manifestRecords,'artifact-files':PRODUCTION_FILE_LIMITS.artifactFiles,'visited-entries':PRODUCTION_FILE_LIMITS.visitedEntries,'final-files':PRODUCTION_FILE_LIMITS.artifactFiles,'final-entries':PRODUCTION_FILE_LIMITS.visitedEntries});
/** Supplied counts only; traversal stops give observed-at-refusal, not an exact tree total. */
export function assertProductionCount(domain:ProductionCountDomain,observed:number):void {
 if(!Object.hasOwn(productionCounts,domain)||!Number.isSafeInteger(observed)||observed<0) throw new Error('Production count shape denied');
 const limit=productionCounts[domain];
 if(observed>limit) throw new Error(`production-${domain} ${domain==='visited-entries'?'observed-at-refusal':'observed'}=${observed} limit=${limit}`);
}
export interface HostedCopilotContext {candidateSha:string;checkoutSha:string;githubSha:string;workflowSha:string;tagSha:string;repository:string;releaseId:string;githubRef:string;workflowRef:string;eventName:string;actions:string;platform:string;runnerOs:string;runnerMarker:string;attempt:string}
export function releaseTag(id:string):string {
 if(!/^hosted-copilot-react-production-build-[a-z0-9][a-z0-9-]*$/.test(id)||id.length>64||id.includes('\n')) throw new Error('Invalid production release identity');
 return id;
}
export function assertContext(v:HostedCopilotContext) {
 const ref=`refs/tags/${releaseTag(v.releaseId)}`;
 if([v.candidateSha,v.checkoutSha,v.githubSha,v.workflowSha,v.tagSha].some(sha=>sha.length!==40||!(/^[a-f0-9]{40}$/.test(sha))||sha!==v.candidateSha)||v.repository!=='cacheplane/chat-ui-bench'||v.githubRef!==ref||v.workflowRef!==`cacheplane/chat-ui-bench/.github/workflows/hosted-copilot-production.yml@${ref}`||v.eventName!=='workflow_dispatch'||v.actions!=='true'||v.platform!=='linux'||v.runnerOs!=='Linux'||v.runnerMarker!=='ubuntu-24.04-hosted-copilot-production'||v.attempt!=='1') throw new Error('Hosted source/context policy denied');
 return Object.freeze({...v,unusedRelease:'unverified' as const,qualification:false as const});
}
export function ordinaryPath(path:string):boolean {
 return typeof path==='string'&&path.length>0&&path.length<=1024&&!path.includes('\n')&&/^[A-Za-z0-9._@/-]+$/.test(path)&&!path.startsWith('/')&&path.split('/').every(part=>part!==''&&part!=='.'&&part!=='..');
}
export interface FileFact {path:string;bytes:number;sha256:string;regular:boolean;contained:boolean;symlink:boolean}
/** Typed array density only; no getter, iterator or hostile Proxy guarantee. */
export function assertDenseEntries(input:readonly unknown[],maximum:number,allowEmpty=false):void {
 if(!Array.isArray(input)||input.length>maximum||(!allowEmpty&&input.length===0)) throw new Error('Array entry bound');
 for(let index=0;index<input.length;index++) if(!Object.hasOwn(input,index)) throw new Error('Sparse array entries denied');
}
function inventory(input:readonly FileFact[],maximum:number) {
 assertDenseEntries(input,maximum);
 const seen=new Set<string>();let bytes=0;
 const files=input.map(file=> {
  if(!ordinaryPath(file.path)||seen.has(file.path)||!Number.isSafeInteger(file.bytes)||file.bytes<0||file.sha256.length!==64||!(/^[a-f0-9]{64}$/.test(file.sha256))||file.regular!==true||file.contained!==true||file.symlink!==false) throw new Error('Inventory ordinary file denied');
  seen.add(file.path);bytes+=file.bytes;if(bytes>LIMITS.bytes) throw new Error('Inventory aggregate overflow; upload denied');
  return Object.freeze({...file});
 });
 return Object.freeze({files:Object.freeze(files),bytes,qualification:false as const});
}
export function assertInventory(input:readonly FileFact[]) {return inventory(input,LIMITS.files);}
export function assertProductionOutputInventory(input:readonly FileFact[]) {
 if(Array.isArray(input)) assertProductionCount('output-files',input.length);
 return inventory(input,PRODUCTION_FILE_LIMITS.outputFiles);
}
export function assertProductionArtifactInventory(input:readonly FileFact[]) {
 if(Array.isArray(input)) assertProductionCount('artifact-files',input.length);
 return inventory(input,PRODUCTION_FILE_LIMITS.artifactFiles);
}
/** serializedInventoryBytes is the actual UTF8 JSON PLUS its written newline. */
export function assertProductionFinalInventory(input:readonly FileFact[],visitedEntries:number,serializedInventoryBytes:number) {
 const value=assertProductionArtifactInventory(input);
 if(input.some(file=>file.path==='artifact-inventory.json')) throw new Error('Production pre-existing artifact-inventory.json denied');
 if(!Number.isSafeInteger(visitedEntries)||visitedEntries<input.length||!Number.isSafeInteger(serializedInventoryBytes)||serializedInventoryBytes<1) throw new Error('Production final inventory counts invalid');
 const files=input.length+1,entries=visitedEntries+1,bytes=value.bytes+serializedInventoryBytes;
 assertProductionCount('final-files',files);assertProductionCount('final-entries',entries);
 if(!Number.isSafeInteger(bytes)||bytes>LIMITS.bytes) throw new Error(`production-final-bytes observed=${bytes} limit=${LIMITS.bytes}`);
 return Object.freeze({files,entries,bytes,qualification:false as const});
}
export interface ParsedAssetReferences {parserComplete:boolean;references:readonly {from:string;target:string}[]}
/** Parser-produced normalized local targets only, never a substitute for a parser. */
export function assertParsedAssetReferences(parsed:ParsedAssetReferences,files:readonly FileFact[]) {
 assertDenseEntries(parsed.references,LIMITS.references,true);
 const inventory=assertInventory(files),names=new Set(inventory.files.map(file=>file.path));
 if(parsed.parserComplete!==true||parsed.references.length>LIMITS.references) throw new Error('Parser asset coverage incomplete or overflow');
 for(const ref of parsed.references) if(!ordinaryPath(ref.from)||!ordinaryPath(ref.target)||!names.has(ref.from)||!names.has(ref.target)) throw new Error('Unresolved or external parsed asset reference');
 return Object.freeze({referenceCount:parsed.references.length,qualification:false as const,scope:'declared parser-output policy only' as const});
}
export interface OriginalCommand {exitCode:number|null;signal:string|null;stdoutBytes:number;stderrBytes:number;stdoutRetainedBytes:number;stderrRetainedBytes:number;closed:boolean;streamsComplete:boolean}
export function assertOriginalCommand(v:OriginalCommand) {
 const lengths=[v.stdoutBytes,v.stderrBytes,v.stdoutRetainedBytes,v.stderrRetainedBytes];
 if(lengths.some(bytes=>!Number.isSafeInteger(bytes)||bytes<0)||v.stdoutRetainedBytes>v.stdoutBytes||v.stderrRetainedBytes>v.stderrBytes||v.streamsComplete&&(v.stdoutRetainedBytes!==v.stdoutBytes||v.stderrRetainedBytes!==v.stderrBytes)||v.exitCode!==null&&(!Number.isSafeInteger(v.exitCode)||v.exitCode<0)||v.signal!==null&&(typeof v.signal!=='string'||v.signal.length>64)) throw new Error('Contradictory original command facts');
 const uploadEligible=v.streamsComplete&&v.stdoutBytes+v.stderrBytes<=LIMITS.bytes;
 return Object.freeze({...v,uploadEligible,success:v.closed&&v.exitCode===0&&v.signal===null&&uploadEligible,qualification:false as const});
}
