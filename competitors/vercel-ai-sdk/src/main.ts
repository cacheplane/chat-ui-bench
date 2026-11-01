import {parsePublicContextText,PUBLIC_CONTEXT_PROTOCOL_HEADER} from '../../shared/context.mjs';
import {mountBench} from './app.ts';
import './styles.css';
async function main(){
  const response=await fetch('/context',{cache:'no-store',signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('vercel-context-http');
  const text=await response.text();
  const context=parsePublicContextText(text,response.headers.get(PUBLIC_CONTEXT_PROTOCOL_HEADER)??'functional-v2');
  const container=document.getElementById('root');if(!container)throw Error('vercel-root-missing');
  window.competitorBench=await mountBench(context,container);
}
main().catch(error=>{window.competitorBenchError=String(error).slice(0,4096);});
