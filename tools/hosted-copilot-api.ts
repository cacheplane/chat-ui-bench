/** Native provider adapter for the separately admitted hosted production guard.
 * No I/O on import; local verification compiles source without invoking acquisition. */
import {createHash} from 'node:crypto';
import {readHostedCopilotContext} from '../tests/support/hosted-copilot-context.ts';
import {assertProviderSnapshot,assertProviderNextLink,type ProviderPage,type ProviderRun,type ProviderSnapshot} from '../tests/support/hosted-copilot-production-policy.ts';
export interface ApiReceipt {path:string;status:number|null;observedBytes:number;retainedBytes:number;bodyEof:boolean;streamsComplete:boolean;sha256:string;body:Uint8Array;error:string|null;closedUtc:string}
function record(value:unknown):Record<string,unknown> {if(typeof value!=='object'||value===null||Array.isArray(value)) throw new Error('Provider object missing');return value as Record<string,unknown>;}
function text(value:unknown):string {if(typeof value!=='string'||value.length===0||value.length>4096) throw new Error('Provider scalar missing');return value;}
function number(value:unknown):number {if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0) throw new Error('Provider integer missing');return value;}
function id(value:unknown):string {return String(number(value));}
function run(value:unknown):ProviderRun {
 const v=record(value);return {id:id(v['id']),headSha:text(v['head_sha']),title:text(v['display_title']),event:text(v['event']),workflowId:id(v['workflow_id']),attempt:number(v['run_attempt']),tag:text(v['head_branch'])};
}
export async function acquireHostedCopilotProvider(options:{token:string;retain:(receipt:ApiReceipt)=>Promise<void>}):Promise<ProviderSnapshot> {
 const context=readHostedCopilotContext(); // Existing exact hosted/Git/tag policy first.
 const runId=process.env['GITHUB_RUN_ID']??'';
 if(!/^[1-9][0-9]{0,19}$/.test(runId)||!options.token||options.token.length>4096) throw new Error('Provider credentials/run identity absent');
 const start=performance.now();let requests=0,totalRetained=0;
 const base='/repos/cacheplane/chat-ui-bench';
 async function get(path:string):Promise<{status:number;value:unknown;link:string|null}> {
  if(++requests>14||performance.now()-start>=60_000||path!==base&&!path.startsWith(base+'/')) throw new Error('Provider acquisition request/budget denied');
  const chunks:Uint8Array[]=[];let reader:ReadableStreamDefaultReader<Uint8Array>|undefined,status:number|null=null,observed=0,retained=0,eof=false,complete=true,error:string|null=null,link:string|null=null;
  try {
   const remaining=Math.max(1,Math.min(15_000,60_000-(performance.now()-start)));
   const response=await fetch(`https://api.github.com${path}`,{method:'GET',redirect:'error',headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${options.token}`,'X-GitHub-Api-Version':'2026-03-10'},signal:AbortSignal.timeout(remaining)});
   status=response.status;link=response.headers.get('link');
   if(!response.body) throw new Error('Original provider body absent');reader=response.body.getReader();
   for(;;) {const item=await reader.read();if(item.done) {eof=true;break;}observed+=item.value.byteLength;
    if(!complete||observed>1024*1024||totalRetained+item.value.byteLength>4*1024*1024) {complete=false;continue;}
    const copy=item.value.slice();chunks.push(copy);retained+=copy.byteLength;totalRetained+=copy.byteLength;
   }
  } catch(cause) {error=cause instanceof Error?cause.name.slice(0,64):'ProviderError';complete=false;}
  finally {reader?.releaseLock();}
  const body=Buffer.concat(chunks);
  // The evidence owner receives its own bytes, not the private parse input.
  await options.retain({path,status,observedBytes:observed,retainedBytes:retained,bodyEof:eof,streamsComplete:complete&&eof,sha256:createHash('sha256').update(body).digest('hex'),body:Uint8Array.from(body),error,closedUtc:new Date().toISOString()});
  if(error!==null||!complete||!eof||status===null||performance.now()-start>60_000) throw new Error('Original provider acquisition incomplete or overflow');
  if(status!==200&&status!==404) throw new Error(`Original provider HTTP ${status}`);
  return {status,value:JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(body)) as unknown,link};
 }
 const repo=await get(base);if(repo.status!==200||record(repo.value)['full_name']!=='cacheplane/chat-ui-bench') throw new Error('Authenticated repository identity differs');
 const workflow=await get(`${base}/actions/workflows/hosted-copilot-production.yml`),w=record(workflow.value);
 if(workflow.status!==200||w['path']!=='.github/workflows/hosted-copilot-production.yml'||w['state']!=='active') throw new Error('Concrete provider workflow differs');
 const workflowId=id(w['id']);
 const currentResponse=await get(`${base}/actions/runs/${runId}`);if(currentResponse.status!==200) throw new Error('Original current run unavailable');const currentRun=run(currentResponse.value);
 const runPages:ProviderPage<ProviderRun>[]=[];
 for(let page=1;page<=5;page++) {
  const path=`${base}/actions/workflows/${workflowId}/runs`,response=await get(`${path}?per_page=100&page=${page}`),v=record(response.value),values=v['workflow_runs'];
  if(response.status!==200||!Array.isArray(values)||values.length>100) throw new Error('Provider run page shape');
  const hasNext=assertProviderNextLink(response.link,path,page);runPages.push({page,totalCount:number(v['total_count']),hasNext,records:values.map(run),status:response.status,bodyComplete:true});
  if(!hasNext) break;if(page===5) throw new Error('Provider history pagination incomplete');
 }
 const releasePages:ProviderPage<{id:string;tag:string}>[]=[];
 for(let page=1;page<=5;page++) {
  const path=`${base}/releases`,response=await get(`${path}?per_page=100&page=${page}`);
  if(response.status!==200||!Array.isArray(response.value)||response.value.length>100) throw new Error('Provider release page shape');
  const hasNext=assertProviderNextLink(response.link,path,page);releasePages.push({page,totalCount:null,hasNext,records:response.value.map(value=> {const v=record(value);return {id:id(v['id']),tag:text(v['tag_name'])};}),status:response.status,bodyComplete:true});
  if(!hasNext) break;if(page===5) throw new Error('Provider releases pagination incomplete');
 }
 const lookup=await get(`${base}/releases/tags/${context.releaseId}`);
 const snapshot:ProviderSnapshot={repository:context.repository,workflowId,candidateSha:context.candidateSha,releaseId:context.releaseId,currentRunId:runId,currentRun,runPages,releasePages,releaseLookupStatus:lookup.status,acquisitionClosed:true,draftVisibility:'unverified'};
 assertProviderSnapshot(snapshot);return snapshot;
}
