// Fixed source-owned acquisition delay. Receipt describes only elapsed Node time.
const unavailable=()=>Error('native-request-window-preroll-unavailable');
function sample(){const value=Number(process.hrtime.bigint())/1000000;if(!Number.isFinite(value)||value<0||Object.is(value,-0)||value>Number.MAX_SAFE_INTEGER)throw unavailable();return value;}
export async function waitRequestWindowPrerollV1(){
 const start=sample();let timer;
 try{
  return await new Promise((resolve,reject)=>{timer=setTimeout(()=>{try{const elapsedMs=sample()-start;if(!Number.isFinite(elapsedMs)||elapsedMs<1000||elapsedMs>2000)throw unavailable();const elapsedNs=Math.floor(elapsedMs*1000000);if(!Number.isSafeInteger(elapsedNs)||elapsedNs<1000000000||elapsedNs>2000000000)throw unavailable();resolve(Object.freeze({policy:'request-window-trace-preroll-1000-v1',requestedMs:1000,elapsedNs:String(elapsedNs),state:'fulfilled'}));}catch(error){reject(error);}},1000);});
 }finally{if(timer!==undefined)clearTimeout(timer);}
}
