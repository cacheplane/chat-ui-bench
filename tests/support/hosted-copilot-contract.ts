/** Inert declared-input policies. They neither parse assets nor prove release/API/runtime facts. */
export const LIMITS=Object.freeze({files:128,bytes:32*1024*1024,references:4096});
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
export function assertInventory(input:readonly FileFact[]) {
 assertDenseEntries(input,LIMITS.files);
 const seen=new Set<string>();let bytes=0;
 const files=input.map(file=> {
  if(!ordinaryPath(file.path)||seen.has(file.path)||!Number.isSafeInteger(file.bytes)||file.bytes<0||file.sha256.length!==64||!(/^[a-f0-9]{64}$/.test(file.sha256))||file.regular!==true||file.contained!==true||file.symlink!==false) throw new Error('Inventory ordinary file denied');
  seen.add(file.path);bytes+=file.bytes;if(bytes>LIMITS.bytes) throw new Error('Inventory aggregate overflow; upload denied');
  return Object.freeze({...file});
 });
 return Object.freeze({files:Object.freeze(files),bytes,qualification:false as const});
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
