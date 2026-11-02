// Owns a logical event waiter, never a raw CDP command or remote EOF outcome.
export function createAimockTraceCompletionWaiterV1({pageSession,browser,onTerminal}){
 let sealed=false,original=null,resolveOriginal=null,rejectOriginal=null,settled=false,closedError=null,ownedPageSession=null;const observedTerminals=new Set();
 function terminal(code){
  if(sealed||observedTerminals.has(code))return;observedTerminals.add(code);
  const error=Error(code);closedError??=error;
  if(original!==null&&!settled){settled=true;rejectOriginal(closedError);}
  try{onTerminal(error);}catch{}
 }
 const onSessionClose=()=>terminal('timeline-trace-complete-page-session-closed');
 const onBrowserDisconnected=()=>terminal('timeline-trace-complete-browser-disconnected');
 function attachPageSession(session){
  if(sealed)throw Error('timeline-completion-waiter-sealed');if(closedError)throw closedError;
  if(ownedPageSession!==null)throw Error('timeline-completion-page-session-once');
  ownedPageSession=session;session.on('close',onSessionClose);
 }
 browser.on('disconnected',onBrowserDisconnected);if(pageSession)attachPageSession(pageSession);
 return Object.freeze({
  attachPageSession,
  assertOpen(){if(sealed)throw Error('timeline-completion-waiter-sealed');if(closedError)throw closedError;},
  original(){
   if(sealed)throw Error('timeline-completion-waiter-sealed');
   if(original===null){original=new Promise((resolve,reject)=>{resolveOriginal=resolve;rejectOriginal=reject;});void original.catch(()=>{});if(closedError){settled=true;rejectOriginal(closedError);}}
   return original;
  },
  complete(raw){if(!sealed&&original!==null&&!settled){settled=true;resolveOriginal(raw);}},
  seal(){if(sealed)return;sealed=true;ownedPageSession?.off('close',onSessionClose);browser.off('disconnected',onBrowserDisconnected);},
 });
}
