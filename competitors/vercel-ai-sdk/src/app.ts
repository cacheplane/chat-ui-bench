import {createElement as h,useEffect,useLayoutEffect,useMemo,useRef,useState,type ChangeEvent} from 'react';
import {createRoot} from 'react-dom/client';
import {useChat} from '@ai-sdk/react';
import {DefaultChatTransport,type ChatTransport,type UIMessage} from 'ai';
import type {MatrixCompetitorBench,PublicContext,ProseMessage} from '../../shared/protocol.ts';
import {parsePublicContext} from '../../shared/context.mjs';
import {createRunOperation} from './operation.mjs';
import {readSdkProgress,readSdkResponse} from './projection.ts';

/** This profile composes AI SDK UI hooks with benchmark-owned plain text/scroll UI. */
export function mountBench(input:PublicContext,container:HTMLElement,transport?:ChatTransport<UIMessage>):Promise<MatrixCompetitorBench>{
  const context=parsePublicContext(input);
  if(context.profile!=='vercel-ai-sdk')throw Error('vercel-profile-mismatch');
  return new Promise((resolve,reject)=>{
    const root=createRoot(container,{onUncaughtError:reject});
    function App(){
      const initial=useMemo<UIMessage[]>(()=>context.history.map(m=>({id:m.id,role:m.role,parts:[{type:'text',text:m.text}]})),[]);
      const selectedTransport=useMemo(()=>transport??new DefaultChatTransport({api:'/stream/ui',body:{runId:context.runId}}),[]);
      const finish=useRef<{seen:boolean;error:string|null}>({seen:false,error:null});
      const chat=useChat({id:context.threadId,messages:initial,transport:selectedTransport,onFinish:event=>{
        finish.current={seen:true,error:event.isAbort?'vercel-stream-aborted':event.isDisconnect?'vercel-stream-disconnected':event.isError?'vercel-stream-error':event.finishReason!=='stop'?'vercel-finish-reason-unavailable':null};
      }});
      const current=useRef(chat);current.current=chat;
      const scroller=useRef<HTMLDivElement>(null),follow=useRef(true);
      const [following,setFollowing]=useState(true),[composer,setComposer]=useState('');
      useLayoutEffect(()=>{if(follow.current&&scroller.current)scroller.current.scrollTop=scroller.current.scrollHeight;},[chat.messages]);
      useEffect(()=>{
        let disposed=false;
        const operation=createRunOperation(()=>{finish.current={seen:false,error:null};return current.current.regenerate();},()=>current.current.stop(),()=>root.unmount());
        const readProgress=()=>{
          if(disposed)throw Error('vercel-profile-disposed');
          const disposition=operation.state(),completionError=disposition.status==='fulfilled'&&!finish.current.seen?'vercel-finish-callback-unavailable':finish.current.error;
          return readSdkProgress(current.current,context,disposition,operation.error()??completionError);
        };
        const bench:MatrixCompetitorBench={
          readProgress,
          readResponse(){if(disposed)throw Error('vercel-profile-disposed');return readSdkResponse(current.current,context);},
          read(){
            if(disposed)throw Error('vercel-profile-disposed');
            const sdk=current.current;
            const messages:ProseMessage[]=sdk.messages.map(m=>{
              if(m.role!=='user'&&m.role!=='assistant'||m.parts.some(p=>p.type!=='text'))throw Error('vercel-non-prose-runtime');
              return{id:m.id,role:m.role,text:m.parts.map(p=>p.type==='text'?p.text:'').join('')};
            });
            const progress=readProgress();
            return{messages,running:progress.running,error:progress.error,responseId:progress.responseId,operation:progress.operation};
          },
          start(){operation.start();},waitForRun(){return operation.wait();},
          async dispose(){disposed=true;await operation.dispose();if(window.competitorBench===bench)delete window.competitorBench;},
          selectors:{scroller:'[data-bench-scroll]',composer:'[data-bench-composer]',message:'[data-bench-message]',messageContent:'[data-bench-content]',returnToResponse:'[data-bench-return]'},
          capabilities:{rendering:'all-mounted',scrollPolicy:'bottom-follow',returnToResponse:'native-control'},
        };resolve(bench);
      },[]);
      const returnToResponse=()=>{follow.current=true;setFollowing(true);if(scroller.current)scroller.current.scrollTop=scroller.current.scrollHeight;};
      return h('main',{className:'benchmark-app'},
        h('div',{className:'benchmark-title'},'AI SDK UI — benchmark plain-text renderer'),
        h('div',{'data-bench-scroll':'',className:'benchmark-scroll',ref:scroller,
          onWheel:(event)=>{if(event.deltaY<0){follow.current=false;setFollowing(false);}},
          onScroll:()=>{const node=scroller.current;if(node){const atBottom=node.scrollHeight-node.scrollTop-node.clientHeight<=80;follow.current=atBottom;setFollowing(atBottom);}}},
          ...chat.messages.map(m=>h('article',{key:m.id,'data-bench-message':m.id,'data-role':m.role,className:'benchmark-message '+m.role},
            h('div',{'data-bench-content':''},...m.parts.filter(p=>p.type==='text').map((p,i)=>h('span',{key:i},p.type==='text'?p.text:'')))))),
        h('button',{'data-bench-return':'',hidden:following,onClick:returnToResponse},'Return to response'),
        h('form',{onSubmit:event=>{event.preventDefault();if(composer.trim()){void chat.sendMessage({text:composer});setComposer('');}}},
          h('textarea',{'data-bench-composer':'','aria-label':'Message',value:composer,onChange:(event:ChangeEvent<HTMLTextAreaElement>)=>setComposer(event.currentTarget.value)}),h('button',{type:'submit'},'Send')));
    }
    root.render(h(App));
  });
}
