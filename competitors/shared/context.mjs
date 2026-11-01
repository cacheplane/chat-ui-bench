const profiles=new Set(['threadplane','copilotkit','assistant-ui','vercel-ai-sdk']);
export const PUBLIC_CONTEXT_PROTOCOL_HEADER='x-chat-ui-bench-protocol';
export const PUBLIC_CONTEXT_LIMITS=Object.freeze({'functional-v2':131072,'matrix-v3':8388608});
const fail=reason=>{throw new Error(`competitor-${reason}`);};
export function closedData(value,keys){
  if(!value||Object.getPrototypeOf(value)!==Object.prototype)fail('data-shape');
  const actual=Reflect.ownKeys(value);if(actual.length!==keys.length||actual.some(k=>!keys.includes(k)))fail('data-fields');
  return Object.fromEntries(keys.map(key=>{const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)fail('own-data');return[key,d.value];}));
}
function identity(value){if(typeof value!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value))fail('identity');return value;}
export function parsePublicContext(input){
  const value=closedData(input,['schema','profile','threadId','runId','canonicalResponseId','history','workload','digests']);
  if(![1,2].includes(value.schema)||!profiles.has(value.profile))fail('profile');
  const workload=closedData(value.workload,['seed','historyCount','responseBytes','deltaCount','deltaIntervalMs','journey']);
  for(const[k,v]of Object.entries({seed:1,deltaCount:200,deltaIntervalMs:50}))if(workload[k]!==v)fail('workload');
  if(value.schema===1?(workload.historyCount!==100||workload.responseBytes!==6400):(![100,1000,10000].includes(workload.historyCount)||![6400,262144].includes(workload.responseBytes)))fail('workload');
  if(!['follow','history-reading'].includes(workload.journey))fail('journey');
  if(!Array.isArray(value.history)||value.history.length!==workload.historyCount)fail('history-size');
  const seen=new Set();
  const history=Array.from({length:workload.historyCount},(_,index)=>{
    const descriptor=Object.getOwnPropertyDescriptor(value.history,String(index));if(!descriptor||!Object.hasOwn(descriptor,'value'))fail('history-own-data');const raw=descriptor.value;
    const m=closedData(raw,['id','role','text']);identity(m.id);
    if(seen.has(m.id)||m.role!==(index%2===0?'assistant':'user')||typeof m.text!=='string'||m.text.length!==512||!/^[\x20-\x7e]+$/.test(m.text))fail('history-data');
    seen.add(m.id);return Object.freeze(m);
  });
  const digests=closedData(value.digests,['sourceSha256','historySha256','responseSha256']);
  if(Object.values(digests).some(x=>typeof x!=='string'||!/^[a-f0-9]{64}$/.test(x)))fail('digest');
  const canonicalResponseId=identity(value.canonicalResponseId);if(seen.has(canonicalResponseId))fail('response-collision');
  return Object.freeze({schema:value.schema,profile:value.profile,threadId:identity(value.threadId),runId:identity(value.runId),canonicalResponseId,history:Object.freeze(history),workload:Object.freeze(workload),digests:Object.freeze(digests)});
}
/** Native bulk body consumption occurs in the caller; this bounds preparse data,
 * not physical heap. Protocol is an explicit owned HTTP header, never a guess. */
export function parsePublicContextText(text,protocol='functional-v2'){
  if(protocol!=='functional-v2'&&protocol!=='matrix-v3')fail('context-protocol');
  const limit=PUBLIC_CONTEXT_LIMITS[protocol];
  if(typeof text!=='string'||text.length>limit||new TextEncoder().encode(text).byteLength>limit)fail('context-cap');
  const context=parsePublicContext(JSON.parse(text));
  if(context.schema!==(protocol==='matrix-v3'?2:1))fail('context-protocol');
  return context;
}
