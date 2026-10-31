export function createRunOperation(perform,stop,unmount){
  let status='idle',original=null,failure=null,closing=null,closed=false;
  return Object.freeze({
    start(){
      if(status!=='idle'||closed)throw Error('vercel-run-once');status='pending';
      try{original=perform();if(!original||typeof original.then!=='function')throw Error('vercel-original-run-promise-required');}
      catch(error){failure=error;status='rejected';original=Promise.reject(error);}
      // Keep the ORIGINAL object for wait/disposal; this observer owns no completion authority.
      original.then(()=>{status='fulfilled';},error=>{failure=error;status='rejected';});
    },
    wait(){if(!original)throw Error('vercel-run-not-started');return original;},
    state(){return{kind:'original-run-promise',status};},
    error(){return failure;},
    dispose(){
      if(closing)return closing;closed=true;
      closing=(async()=>{
        const errors=[];try{await stop();}catch(error){errors.push(error);}
        try{unmount();}catch(error){errors.push(error);}
        if(original)try{await original;}catch(error){errors.push(error);}
        if(errors.length)throw new AggregateError(errors,'vercel-disposal-failed');
      })();return closing;
    },
  });
}
