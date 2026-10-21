// Private source-only capability: tables are adapter-owned, never caller DTOs.
// The adapter proves canonical ownership/closure before and after this helper.
// Native capabilities are captured by that adapter; tests supply explicit fakes.
const ownedArray=Array,finite=Number.isFinite,safeInteger=Number.isSafeInteger,freeze=Object.freeze;
export function createWarmBaseline(native, typed) {
 const integer=(v,lo,hi)=>typeof v==='number'&&safeInteger(v)&&v>=lo&&v<=hi;
 const positive=v=>typeof v==='number'&&finite(v)&&v>0&&v<=1e7;
 const id=v=>integer(v,1,32768);
 const commit=v=>v===null||id(v);
 function refuse(reason){return {status:'unavailable',reason};}
 function build(source,viewport,overscan,cache,origins,bindings,layout,sealed){
  try{
   if(typeof native.nodeConnected!=='function'||!positive(viewport)||!integer(overscan,0,10)||!integer(layout,1,21)||!id(sealed)||!native.array(origins)||origins.length!==101||!native.array(bindings)||bindings.length!==101)return refuse('native');
   // Brand getters precede prototype inspection, including Proxy refusal.
   if(native.apply(typed.length,source,[])!==200||native.apply(typed.tag,source,[])!=='Float64Array')return refuse('geometry');
   const buffer=native.apply(typed.buffer,source,[]);
   if(native.apply(typed.byteLength,buffer,[])!==1600||typed.resizable&&native.apply(typed.resizable,buffer,[])||native.prototype(source)!==typed.float64Prototype||native.prototype(buffer)!==typed.arrayBufferPrototype)return refuse('geometry');
   const cacheSize=native.apply(native.mapSize,cache,[]);
   if(!integer(cacheSize,0,128)||native.prototype(cache)!==native.mapPrototype)return refuse('cache');
   const iterator=native.apply(native.mapEntries,cache,[]);
   for(let j=0;j<=128;j++){
    const step=native.apply(native.mapNext,iterator,[]);
    if(step.done){if(j!==cacheSize)return refuse('cache');break;}
    if(j===128||!integer(step.value[0],0,99)||!positive(step.value[1]))return refuse('cache');
   }
   const flat=ownedArray(200),mask=ownedArray(100),keys=ownedArray(100);
   let end=0;
   for(let i=0;i<100;i++){
    const start=source[2*i],size=source[2*i+1],cached=native.apply(native.mapGet,cache,[i]);
    if(typeof start!=='number'||!finite(start)||start!==end||!positive(size)||size<1||start+size>1e7||cached!==undefined&&cached!==size)return refuse('geometry');
    flat[2*i]=start;flat[2*i+1]=size;end=start+size;
    mask[i]=cached===undefined?0:1;keys[i]='history-'+i;
    const o=origins[i];
    if(o!=null){
     if(o.row!==i||!id(o.node)||!positive(o.size)||!integer(o.layout,1,21)||typeof o.eligible!=='boolean'||!commit(o.commit)||!id(o.measure)||!id(o.edge)||!id(o.resize)||!integer(o.seq,1,6400))return refuse('origin');
     if(o.layout===layout&&o.eligible===true&&o.commit!==null&&o.commit<=sealed&&cached===o.size)mask[i]|=2;
    }
   }
   // Include unmeasured/invalid latest bindings and the potential tail row.
   for(let i=0;i<101;i++){
    const b=bindings[i];if(b==null)continue;
    if(b.row!==i||!id(b.id)||!id(b.render)||!commit(b.commit)||!integer(b.layout,1,21)||typeof b.connected!=='boolean'||typeof b.measured!=='boolean')return refuse('binding');
    const connected=native.apply(native.nodeConnected,b.node,[]);
    if(typeof connected!=='boolean')return refuse('binding');
    if(i===100){if(connected)return refuse('tail');continue;}
    if(connected)mask[i]|=4;
    const o=origins[i];
    if(connected&&b.measured&&b.connected&&(mask[i]&2)!==0&&o.node===b.id&&b.commit!==null&&o.commit!==null&&b.commit<=o.commit&&o.commit<=sealed&&b.layout===layout&&o.eligible===true&&o.layout===layout&&native.apply(native.mapGet,cache,[i])===o.size)mask[i]|=8;
   }
   return {status:'prepared-input',inputs:{flat,mask,keys,viewport,overscan}};
  }catch{return refuse('native');}
 }
 return freeze({build});
}
