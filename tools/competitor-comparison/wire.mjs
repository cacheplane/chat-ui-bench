import {setTimeout as delay} from 'node:timers/promises';

/** Source pacing is independent of browser application; receipts are not DOM or FPS. */
export async function* scheduledPlayback(value,kind,{signal,now=()=>performance.now(),wait=ms=>delay(ms,undefined,{signal}),observe=()=>{},omitDelta}={}){
  if(!['seed','continuation'].includes(kind)||!(signal instanceof AbortSignal)||omitDelta!==undefined&&(!Number.isInteger(omitDelta)||omitDelta<1||omitDelta>200))throw Error('competitor-playback-selection');
  const events=kind==='seed'?value.historyRestore:value.continuation;
  if(!Array.isArray(events)||events.length!==(kind==='seed'?3:204))throw Error('competitor-playback-source');
  const started=now();let previous=0,lastClock=started,delta=0;
  for(let index=0;index<events.length;index++){
    signal.throwIfAborted();const event=events[index],scheduledMs=event.metadata?.scheduledMs;
    if(!Number.isSafeInteger(scheduledMs)||scheduledMs<previous||scheduledMs>10000)throw Error('competitor-playback-schedule');previous=scheduledMs;
    const current=now();if(!Number.isFinite(current)||current<lastClock)throw Error('competitor-playback-clock');lastClock=current;
    const remaining=started+scheduledMs-current;if(remaining>0)await wait(remaining);
    signal.throwIfAborted();const emitted=now();if(!Number.isFinite(emitted)||emitted<lastClock)throw Error('competitor-playback-clock');lastClock=emitted;
    if(kind==='continuation'&&event.type==='TEXT_MESSAGE_CONTENT'&&++delta===omitDelta)continue;
    observe({kind,index,eventType:event.type,scheduledMs,emittedMs:emitted-started,latenessMs:Math.max(0,emitted-started-scheduledMs)});
    yield structuredClone(event);
  }
}

const sse=value=>'data: '+JSON.stringify(value)+'\n\n';
/** Explicit UI protocol projection, preserving actual source delta bytes. */
export async function* uiSse(events){
  let started=false,textStarted=false,textEnded=false,finished=false,messageId=null,count=0;
  for await(const event of events){
    if(++count>204||finished)throw Error('competitor-ui-lifecycle');
    switch(event.type){
      case 'RUN_STARTED':
        if(started)throw Error('competitor-ui-lifecycle');started=true;break;
      case 'TEXT_MESSAGE_START':
        if(!started||textStarted||typeof event.messageId!=='string'||event.messageId.length<1||event.messageId.length>128||event.role!=='assistant')throw Error('competitor-ui-lifecycle');
        messageId=event.messageId;textStarted=true;yield sse({type:'start',messageId});yield sse({type:'text-start',id:'text-0'});break;
      case 'TEXT_MESSAGE_CONTENT':
        if(!textStarted||textEnded||event.messageId!==messageId||typeof event.delta!=='string'||event.delta.length<1||event.delta.length>2048)throw Error('competitor-ui-lifecycle');
        yield sse({type:'text-delta',id:'text-0',delta:event.delta});break;
      case 'TEXT_MESSAGE_END':
        if(!textStarted||textEnded||event.messageId!==messageId)throw Error('competitor-ui-lifecycle');textEnded=true;yield sse({type:'text-end',id:'text-0'});break;
      case 'RUN_FINISHED':
        if(!textEnded)throw Error('competitor-ui-lifecycle');finished=true;yield sse({type:'finish',finishReason:'stop'});break;
      default:throw Error('competitor-ui-event');
    }
  }
  if(!finished)throw Error('competitor-ui-incomplete');yield 'data: [DONE]\n\n';
}
