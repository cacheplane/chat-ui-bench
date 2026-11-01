/** This entire factory is serialized verbatim into the browser evaluator.
 * Build the bounded historical identity index once, never on a polling path.
 * Progress/response checks and their precedence mirror V4 admission exactly.
 */
export function createMatrixScalarClassifierV5(metadata){
 const need=(value,reason)=>{if(!value)throw Error('matrix-'+reason);};
 const fail=reason=>{throw Error('competitor-'+reason);};
 function closedData(value,keys){
  if(!value||Object.getPrototypeOf(value)!==Object.prototype)fail('data-shape');
  const actual=Reflect.ownKeys(value);if(actual.length!==keys.length||actual.some(k=>!keys.includes(k)))fail('data-fields');
  return Object.fromEntries(keys.map(key=>{const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)fail('own-data');return[key,d.value];}));
 }
 const value=closedData(metadata,['profile','historyCount','responseBytes','historicalIds']);
 need(['threadplane','copilotkit','assistant-ui','vercel-ai-sdk'].includes(value.profile)&&[100,1000,10000].includes(value.historyCount)&&[6400,262144].includes(value.responseBytes),'v5-metadata');
 need(Array.isArray(value.historicalIds)&&value.historicalIds.length===value.historyCount,'v5-metadata-ids');
 const ids=new Set(),transportIds=[];
 for(let i=0;i<value.historyCount;i++){
  const descriptor=Object.getOwnPropertyDescriptor(value.historicalIds,String(i));
  need(descriptor&&Object.hasOwn(descriptor,'value'),'v5-metadata-own-id');const id=descriptor.value;
  need(typeof id==='string'&&id.length>0&&id.length<=128&&!ids.has(id),'v5-metadata-id');ids.add(id);transportIds.push(id);
 }
 // Serialize only the validated own values: no getter or array toJSON executes.
 const transport={profile:value.profile,historyCount:value.historyCount,responseBytes:value.responseBytes,historicalIds:transportIds};
 need(new TextEncoder().encode(JSON.stringify(transport)).byteLength<=8388608,'v5-metadata-bound');
 const h=value.historyCount,r=value.responseBytes,kind=value.profile==='assistant-ui'?'public-runtime-state-transition':'original-run-promise';
 const minimum=16*Math.floor(r/200)+Math.min(16,r%200);
 return function classify(progress,response){
  const p=closedData(progress,['schema','messageCount','responseId','responseCharacters','running','error','operation']);
  need(p.schema===1&&typeof p.running==='boolean'&&p.error===null,'progress-runtime');
  const op=closedData(p.operation,['kind','status']);need(op.kind===kind,'operation-kind');need(['idle','pending','fulfilled','rejected'].includes(op.status),'operation-status');
  need(Number.isSafeInteger(p.messageCount)&&(p.messageCount===h||p.messageCount===h+1),'progress-count');
  if(p.messageCount===h)need(p.responseId===null&&p.responseCharacters===null,'progress-no-response');
  else need(typeof p.responseId==='string'&&p.responseId.length>0&&p.responseId.length<=128&&!ids.has(p.responseId)&&Number.isSafeInteger(p.responseCharacters)&&p.responseCharacters>=0&&p.responseCharacters<=r,'progress-response');
  need(op.status!=='rejected','progress-rejected');
  if(op.status==='idle')need(!p.running&&p.messageCount===h,'progress-idle');
  if(op.status==='pending')need(p.running,'progress-pending');
  if(op.status==='fulfilled')need(!p.running&&p.messageCount===h+1,'progress-fulfilled');
  let actual=null;
  if(response!==null){
   actual=closedData(response,['id','role','text']);
   need(typeof actual.id==='string'&&actual.id.length>0&&actual.id.length<=128&&['assistant','user'].includes(actual.role)&&typeof actual.text==='string','message');
   need(p.messageCount===h+1&&actual.role==='assistant'&&actual.id===p.responseId&&!ids.has(actual.id)&&actual.text.length<=p.responseCharacters&&actual.text.length<=r,'sample-response');
  }
  need(p.running&&op.status==='pending','active-history-phase');
  return actual===null||actual.text.length<minimum?'wait-prefix':'prefix-eligible';
 };
}
