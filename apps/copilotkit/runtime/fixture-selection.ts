/** Supplied fixture data only. SDK selection is bound explicitly by wire.ts. */
import type {AGUIFixture,AGUIFixtureMatch,AGUIRunAgentInput} from '@copilotkit/aimock/agui';
type Message={id:string;role:'user'|'assistant';content:string};
type ProducerRecord={sequence:number;scheduledMs:number;messageId:string;type:string;text:string};
export type SelectedFixtureEvent=Record<string,unknown>&{type:string;timestamp:number;metadata:Record<string,unknown>};
export interface FixtureSelectionContext {threadId:string;seedRunId:string;continuationRunId:string;history:readonly Message[];events:readonly ProducerRecord[];epochMs:number}
export interface FixtureSelectionPorts {findFixture(input:AGUIRunAgentInput,fixtures:AGUIFixture[]):AGUIFixture|null;matchesFixture(input:AGUIRunAgentInput,match:AGUIFixtureMatch):boolean}
export interface ContinuationFixtureReader {next(event:unknown):SelectedFixtureEvent[];complete():void}
export interface FixtureSelection {seed(input:unknown):SelectedFixtureEvent[];continuation(input:unknown):ContinuationFixtureReader}
const fail=():never=>{throw Error('Native AIMock fixture selection denied');};
const need=(ok:unknown):void=>{if(!ok)fail();};
type Row=Record<string,unknown>;
function row(value:unknown,maxKeys=12):Row {
 need(value!==null&&typeof value==='object'&&!Array.isArray(value));
 const p=Object.getPrototypeOf(value);need(p===Object.prototype||p===null);
 const ownKeys=Reflect.ownKeys(value as object);
 need(ownKeys.length<=maxKeys&&ownKeys.every(key=>typeof key==='string'&&key.length<=128));
 const out:Row={};
 for(const key of ownKeys){
  const d=Object.getOwnPropertyDescriptor(value,key);need(d&&Object.hasOwn(d,'value'));
  Object.defineProperty(out,key,{value:d!.value,enumerable:true,writable:true});
 }
 return out;
}
function keys(value:Row,wanted:string[],optional:string[]=[]):void {const actual=Object.keys(value);need(wanted.every(k=>Object.hasOwn(value,k))&&actual.every(k=>wanted.includes(k)||optional.includes(k)));}
function list(value:unknown,length:number):unknown[]{
 need(Array.isArray(value)&&Object.getPrototypeOf(value)===Array.prototype&&value.length===length&&Reflect.ownKeys(value).length===length+1);
 const out:unknown[]=[];for(let i=0;i<length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));need(d&&Object.hasOwn(d,'value'));out.push(d!.value);}return out;
}
function copy(value:unknown,depth=0,budget={count:0,text:0}):unknown {
 need(depth<=12&&++budget.count<=10000);
 if(value===null||typeof value==='boolean')return value;
 if(typeof value==='number'){need(Number.isSafeInteger(value));return value;}
 if(typeof value==='string'){budget.text+=value.length;need(value.length<=8192&&budget.text<=131072);return value;}
 if(Array.isArray(value)){need(value.length<=204);return list(value,value.length).map(x=>copy(x,depth+1,budget));}
 const r=row(value);need(Object.keys(r).length<=12);return Object.fromEntries(Object.entries(r).map(([k,v])=>[k,copy(v,depth+1,budget)]));
}
const same=(a:unknown,b:unknown):boolean=>JSON.stringify(a)===JSON.stringify(b);
function identity(v:unknown):void{need(typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v));}
function messages(value:unknown,length:number):Message[]{return list(value,length).map(v=>{const m=row(v);keys(m,['id','role','content']);identity(m.id);need((m.role==='user'||m.role==='assistant')&&typeof m.content==='string'&&m.content.length===512&&/^[\x20-\x7e]+$/.test(m.content));return {id:m.id as string,role:m.role as Message['role'],content:m.content as string};});}

export function createFixtureSelection(context:FixtureSelectionContext,fixtures:{seed:unknown;continuation:unknown},ports:FixtureSelectionPorts):FixtureSelection {
 const c=copy(context) as unknown as FixtureSelectionContext;
 keys(c as unknown as Row,['threadId','seedRunId','continuationRunId','history','events','epochMs']);
 for(const id of [c.threadId,c.seedRunId,c.continuationRunId])identity(id);
 need(c.seedRunId!==c.continuationRunId&&Number.isSafeInteger(c.epochMs)&&c.epochMs>=0&&Number.isSafeInteger(c.epochMs+10000));
 const history=messages(c.history,100);need(new Set(history.map(m=>m.id)).size===100);
 const original=list(c.events,202).map((v,i)=>{const e=row(v);keys(e,['sequence','scheduledMs','messageId','type','text']);identity(e.messageId);need(e.sequence===i&&e.scheduledMs===Math.min(i,200)*50&&e.type===(i===0?'assistant-start':i===201?'assistant-complete':'text-delta')&&typeof e.text==='string'&&(i>0&&i<201?e.text.length===32&&/^[\x20-\x7e]+$/.test(e.text):e.text===''));return e as ProducerRecord;});
 const responseId=original[0]!.messageId;need(original.every(e=>e.messageId===responseId)&&!history.some(m=>m.id===responseId));
 const ownFixture=(input:unknown,length:number):AGUIFixture=>{const f=row(input);keys(f,['match','events']);const match=row(f.match);keys(match,['predicate']);need(typeof match.predicate==='function');return {match:{predicate:match.predicate as (input:AGUIRunAgentInput)=>boolean},events:copy(list(f.events,length)) as AGUIFixture['events']};};
 const choices=[ownFixture(fixtures.seed,3),ownFixture(fixtures.continuation,204)];
 const selected=new Set<string>();
 function select(input:unknown,seed:boolean):SelectedFixtureEvent[]{
  // At most16 root fields allow bounded public SDK request extras. Only the
  // admitted identity/history projection reaches matching; extras stay opaque.
  const envelope=row(input,16);identity(envelope.threadId);identity(envelope.runId);
  need(envelope.threadId===c.threadId&&envelope.runId===(seed?c.seedRunId:c.continuationRunId));
  const actualMessages=messages(envelope.messages,seed?0:100);need(seed||same(actualMessages,history));
  // The owned envelope is the exact admitted match input. SDK-only optional
  // request fields cannot alter fixture selection or become transport metadata.
  const actual:AGUIRunAgentInput={threadId:c.threadId,runId:envelope.runId as string,messages:actualMessages};
  const found=ports.findFixture(actual,choices);
  const matches=choices.filter(f=>ports.matchesFixture(actual,f.match));
  need(matches.length===1&&found===matches[0]&&found===choices[seed?0:1]&&!selected.has(actual.runId));
  const events=copy(list(found!.events,seed?3:204)) as SelectedFixtureEvent[];
  events.forEach((event,i)=>{
   const e=row(event);const terminal=i===(seed?2:203);
   const expectedType=seed?['RUN_STARTED','MESSAGES_SNAPSHOT','RUN_FINISHED'][i]:i===0?'RUN_STARTED':i===1?'TEXT_MESSAGE_START':i===202?'TEXT_MESSAGE_END':i===203?'RUN_FINISHED':'TEXT_MESSAGE_CONTENT';
   need(e.type===expectedType);const fields=['type','timestamp','metadata'];
   if(i===0||terminal){fields.push('threadId','runId');need(e.threadId===actual.threadId&&e.runId===actual.runId);}
   else if(seed){fields.push('messages');need(same(messages(e.messages,100),history));}
   else {fields.push('messageId');need(e.messageId===responseId);if(i===1){fields.push('role');need(e.role==='assistant');}else if(i<202){fields.push('delta');need(e.delta===original[i-1]!.text);}}
   keys(e,fields,terminal?['outcome']:[]);
   const scheduled=seed?i:i<2?0:i>=202?10000:original[i-1]!.scheduledMs;
   const metadata=row(e.metadata);keys(metadata,['clock','epochMs','scheduledMs']);
   need(metadata.clock===(seed?'synthetic-canonical-history-restore-ms':'synthetic-canonical-replay-ms')&&metadata.epochMs===c.epochMs&&metadata.scheduledMs===scheduled&&e.timestamp===c.epochMs+scheduled);
   if(terminal&&Object.hasOwn(e,'outcome')){const outcome=row(e.outcome);keys(outcome,['type']);need(outcome.type==='success');}
  });
  // All future events validated before the first slice. This is the only native
  // terminal adaptation; error/unknown outcomes never become successful.
  events.at(-1)!.outcome={type:'success'};selected.add(actual.runId);
  return events;
 }
 return {
  seed:input=>select(input,true),
  continuation(input){const events=select(input,false);let next=0,state:'open'|'failed'|'closed'='open';return {
   next(value){try{need(state==='open'&&next<202);const e=row(value);keys(e,['sequence','scheduledMs','messageId','type','text']);const expected=original[next]!;need(Object.keys(expected).every(k=>e[k]===expected[k as keyof ProducerRecord]));const sequence=next++;
    return copy(sequence===0?events.slice(0,2):sequence===201?events.slice(202,204):events.slice(sequence+1,sequence+2)) as SelectedFixtureEvent[];
   }catch(error){state='failed';throw error;}
   },
   complete(){try{need(state==='open'&&next===202);state='closed';}catch(error){state='failed';throw error;}},
  };},
 };
}
