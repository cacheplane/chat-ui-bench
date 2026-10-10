import {createComparisonBuffer,type AdapterCaptureEvent,type ReplayEvent} from '@chat-ui-bench/contract';

/** Only known adapter shapes and explicit primitives cross the admission boundary. */
export function createAdapterCaptureBuffer() {
    const queue=createComparisonBuffer('transport');
    const validHeader=(timestampMs:number,sequence:number)=>Number.isFinite(timestampMs)&&timestampMs>=0&&Number.isSafeInteger(sequence)&&sequence>=0;
    function receipt(timestampMs:number,sequence:number,type:ReplayEvent['type'],scheduledMs:number,messageId:string,text:string):boolean {
        if(!validHeader(timestampMs,sequence)||!Number.isFinite(scheduledMs)||scheduledMs<0||typeof messageId!=='string'||messageId.length===0||typeof text!=='string'||!['assistant-start','text-delta','assistant-complete'].includes(type)||(type!=='text-delta'&&text!=='')) return queue.enqueue('invalid-record');
        return queue.enqueue('object',4,'kind','string','receipt','timestampMs','number',timestampMs,'sequence','number',sequence,'data','object',1,'event','object',5,
            'type','string',type,'sequence','number',sequence,'scheduledMs','number',scheduledMs,'messageId','string',messageId,'text','string',text);
    }
    function translation(timestampMs:number,sequence:number,protocolEvent:string,messageId:string,text:string):boolean {
        if(!validHeader(timestampMs,sequence)||typeof protocolEvent!=='string'||protocolEvent.length===0||typeof messageId!=='string'||messageId.length===0||typeof text!=='string') return queue.enqueue('invalid-record');
        return queue.enqueue('object',4,'kind','string','translation','timestampMs','number',timestampMs,'sequence','number',sequence,'data','object',3,
            'protocolEvent','string',protocolEvent,'messageId','string',messageId,'text','string',text);
    }
    return {receipt,translation,state:queue.state,drain:()=>queue.drain().map(serialized=>JSON.parse(serialized) as AdapterCaptureEvent)};
}
