import type {UIMessage} from 'ai';
import type {BenchSnapshot,MatrixBenchProgress,PublicContext,ProseMessage} from '../../shared/protocol.ts';

type PublicSdkState={messages:UIMessage[];status:string;error?:Error};
const diagnostic=(error:unknown)=>error==null?null:String(error instanceof Error?error.message:error).slice(0,4096);

function currentResponse(messages:UIMessage[],context:PublicContext):UIMessage|null{
  const count=messages.length;
  if(count<context.history.length||count>context.history.length+1)throw Error('vercel-message-count');
  if(count===context.history.length)return null;
  const message=messages.at(-1);
  if(!message||message.role!=='assistant')throw Error('vercel-non-prose-runtime');
  return message;
}
function textLength(message:UIMessage,context:PublicContext):number{
  let length=0;
  for(const part of message.parts){
    if(part.type!=='text'||typeof part.text!=='string')throw Error('vercel-non-prose-runtime');
    length+=part.text.length;
  }
  if(length>context.workload.responseBytes)throw Error('vercel-response-cap');
  return length;
}
/** Reads only the actual current public message; never traverses historical rows. */
export function readSdkProgress(sdk:PublicSdkState,context:PublicContext,operation:BenchSnapshot['operation'],error:unknown):MatrixBenchProgress{
  const messages=sdk.messages,response=currentResponse(messages,context);
  return{schema:1,messageCount:messages.length,responseId:response?.id??null,responseCharacters:response?textLength(response,context):null,running:sdk.status==='submitted'||sdk.status==='streaming',error:diagnostic(sdk.error??error),operation};
}
/** Sparse text materialization is deliberately separate from the scalar polling path. */
export function readSdkResponse(sdk:PublicSdkState,context:PublicContext):ProseMessage|null{
  const response=currentResponse(sdk.messages,context);if(!response)return null;
  textLength(response,context);
  return{id:response.id,role:'assistant',text:response.parts.map(part=>part.type==='text'?part.text:'').join('')};
}
