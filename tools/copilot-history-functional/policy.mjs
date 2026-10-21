import {boundedRead} from './instrument.mjs';
import {requiredStaticOutputs} from './build.mjs';
import fs from 'node:fs';import {resolve} from 'node:path';import {createHash} from 'node:crypto';
export const SLOTS=Object.freeze([['partial-01.json',262144],['partial-02.json',262144],['partial-03.json',262144],['partial-04.json',262144],['intent.json',65536],['operations.json',262144],['server-evidence.json',1048576],['layout-identity.json',131072],['phase.json',262144],['closure.json',262144],['failure.json',65536],['outside-closure.json',131072]].map(Object.freeze));
export const COMMANDS=Object.freeze(['identity-target','identity-frame','identity-context','identity-version','navigate','launch','load-history','baseline','observe-1','observe-2','observe-3','observe-4','observe-5','observe-6','observe-7','observe-8','snapshot-1','snapshot-2','snapshot-3','snapshot-4','invalidate-viewport','dispose-host','close-case-server','close-page','close-context','close-browser','close-control','drain-1','drain-2','drain-3','drain-4','drain-5']);
export const ROUTES=Object.freeze([['GET','/__bench/context'],['POST','/__bench/mounted'],['GET','/copilot/info'],['POST','/copilot/agent/benchmark/run'],['POST','/copilot/agent/benchmark/connect'],['POST','/copilot/agent/benchmark/stop/C-thread-1']]);
export const hash=b=>createHash('sha256').update(b).digest('hex');
export function commandLedger(){const rows=[],seen=new Set();let closed=false;return{begin(name){if(closed||!COMMANDS.includes(name)||seen.has(name)||rows.length>=32)throw Error('C-command');seen.add(name);const r={name,state:'pending'};rows.push(r);return r;},settle(r,normal){if(!rows.includes(r)||r.state!=='pending')throw Error('C-command');r.state=normal?'fulfilled':'rejected';},close(){closed=true;},snapshot(){return rows.map(r=>({...r}));}};}
const keys={ 'intent.json':['kind','release','deadline','sourceSeal','buildSha256'], 'operations.json':['kind','rows'], 'server-evidence.json':['kind','evidence'], 'layout-identity.json':['kind','identity','layout'], 'phase.json':['kind','status','reason','counts','closure'], 'closure.json':['kind','status','reason','inventory','external','process','cleanup','sourcePinsMatch','withinDeadline','authority'], 'failure.json':['kind','reason'], 'outside-closure.json':['kind','required','refs'] };
function exact(o,k){if(!o||Object.getPrototypeOf(o)!==Object.prototype||Object.keys(o).sort().join('|')!==[...k].sort().join('|'))throw Error('C-shape');}
function bounded(v,depth=0,work={n:0}){if(++work.n>100000||depth>12)throw Error('C-shape');if(v===null||typeof v==='boolean')return;if(typeof v==='number'){if(!Number.isFinite(v))throw Error('C-shape');return;}if(typeof v==='string'){if(v.length>4096)throw Error('C-shape');return;}if(Array.isArray(v)){if(v.length>3200)throw Error('C-shape');for(const x of v)bounded(x,depth+1,work);return;}if(!v||Object.getPrototypeOf(v)!==Object.prototype||Object.keys(v).length>128)throw Error('C-shape');for(const [k,x]of Object.entries(v)){if(k.length>128)throw Error('C-shape');bounded(x,depth+1,work);}}
function epochTuple(e){if(!Array.isArray(e)||e.length!==8)throw Error('C-shape');for(const i of [0,2,3])if(e[i]!==null&&(!Number.isInteger(e[i])||e[i]<1||e[i]>32768))throw Error('C-shape');if(!Number.isInteger(e[1])||e[1]<0||e[1]>=100||typeof e[4]!=='boolean'||typeof e[5]!=='boolean'||e[6]!==1||!Number.isInteger(e[7])||e[7]<1||e[7]>21)throw Error('C-shape');}
export function encodeSlot(name,value){const slot=SLOTS.find(x=>x[0]===name);if(!slot)throw Error('C-slot');if(name.startsWith('partial-')){exact(value,['kind','phase','status','reason','fullH100Readiness','generations','counts','rows','epochs','closure','authority']);if(value.kind!=='live-history-C-partial-v1'||value.fullH100Readiness!=='unavailable'||value.rows.length!==100||value.epochs.length>3200||value.rows.some(r=>r.length!==16)||value.epochs.some(e=>e.length!==8))throw Error('C-shape');value.epochs.forEach(epochTuple);}else exact(value,keys[name]);bounded(value);const b=Buffer.from(JSON.stringify(value));if(b.length>slot[1])throw Error('C-slot-limit');return b;}
export function writeExclusive(path,bytes){const b=Buffer.from(bytes),flags=fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW;let fd;try{fd=fs.openSync(path,flags,0o600);fs.writeFileSync(fd,b);fs.fsyncSync(fd);}finally{if(fd!==undefined)fs.closeSync(fd);}const a=fs.lstatSync(path,{bigint:true});if(!a.isFile()||a.nlink!==1n||a.size!==BigInt(b.length))throw Error('C-file');const data=boundedRead(path,b.length);if(!data.equals(b))throw Error('C-readback');return{path:resolve(path),bytes:b.length,sha256:hash(b),fsynced:true,closed:true,readbackMatched:true};}
export function functionalWriter(out,deadline){const used=new Set(),inventory=[];return{write(name,value){if(monotonicMs()>=deadline||used.has(name))throw Error('C-writer');const bytes=encodeSlot(name,value);used.add(name);const r=writeExclusive(resolve(out,name),bytes);inventory.push(r);if(monotonicMs()>=deadline)throw Error('C-late');return r;},inventory(){return inventory.map(x=>({...x}));}};}
export const monotonicMs=()=>Number(process.hrtime.bigint())/1e6;
export function CPhases(start,budget){if(!Number.isFinite(start)||!Number.isInteger(budget)||budget<=0||budget>160000)throw Error('C-budget');const deadline=start+budget;let observed=false;return{deadline,setup:Math.min(deadline-20000,start+60000),observe(now){if(observed||!Number.isFinite(now)||now>=deadline-20000)throw Error('C-phase');observed=true;return Math.min(deadline-20000,now+60000);}};}
export async function CStart(fn,deadline){if(typeof fn!=='function'||monotonicMs()>=deadline)throw Error('C-deadline');let timer;try{const value=await Promise.race([fn(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('C-deadline')),Math.max(1,deadline-monotonicMs()));})]);if(monotonicMs()>=deadline)throw Error('C-deadline');return value;}finally{clearTimeout(timer);}}

export function CEnvironment(observed,configured,injected){const exact={...configured,...injected};if(Object.keys(observed).sort().join('|')!==Object.keys(exact).sort().join('|')||Object.keys(exact).some(k=>observed[k]!==exact[k]))throw Error('C-environment');return true;}
// The request journal is setup provenance, separate from component evaluation evidence.
export function CStaticLedger(outputGraph,emitted,html){
 const files=new Map(),requests=[],requested=new Set();let finished=false;
 for(const f of emitted){if(!/^[A-Za-z0-9._-]{1,128}$/.test(f.name)||files.has('/'+f.name)||!Number.isInteger(f.bytes)||f.bytes<0||f.bytes>8388608||!/^[a-f0-9]{64}$/.test(f.sha256))throw Error('C-static-graph');files.set('/'+f.name,{bytes:f.bytes,sha256:f.sha256});}
 files.set('/',{bytes:html.length,sha256:hash(html)});files.set('/favicon.ico',{bytes:0,sha256:hash(Buffer.alloc(0))});
 const required=[...requiredStaticOutputs(outputGraph,'app.mjs')].map(n=>'/'+n);required.push('/app.css','/');if(required.length>640||new Set(required).size!==required.length||required.some(n=>!files.has(n)))throw Error('C-static-graph');
 return{record(path,body){if(finished||requests.length>=640)throw Error('C-static-population');const expected=files.get(path),bytes=Buffer.from(body);if(!expected||bytes.length!==expected.bytes||hash(bytes)!==expected.sha256)throw Error('C-static-body');requests.push([path,bytes.length,expected.sha256]);requested.add(path);},finish(readEmitted){if(finished)throw Error('C-static-once');finished=true;if(required.some(n=>!requested.has(n)))throw Error('C-static-missing');for(const name of requested){if(name==='/'||name==='/favicon.ico')continue;const expected=files.get(name),bytes=Buffer.from(readEmitted(name.slice(1)));if(bytes.length!==expected.bytes||hash(bytes)!==expected.sha256)throw Error('C-static-readback');}return{kind:'C-requested-static-closure-v1',required,requests:requests.map(r=>[...r]),staticClosureMatch:true,postReadbackMatch:true,origin:'Original static requests and source-owned served body bytes/hash; evaluation evidence remains separate source bindings and commits.'};},snapshot(){return{kind:'C-requested-static-closure-v1',required,requests:requests.map(r=>[...r]),staticClosureMatch:false,postReadbackMatch:false,origin:'Incomplete original static request journal; unavailable.'};}};
}

// Opt-in warm source-unit encoding. The default writer/encodeSlot above is exact.
const warmReasons=['commit','disposal','generation','layout','limit','mapping','node','original-failure','source-gap','timeout','unmeasured'];
const warmCaptureReasons=['record-capacity','invalid-record','ordinal','byte-capacity','already-closed','pair-owner','pair-stale','pair-null','pair-extractor','pair-reentrant','source-fault'];
const warmPlanReasons=['invalid-input','gap-capacity','range-capacity','step-capacity','coverage-gap','final-cached-remount','unsafe-join','no-gap'];
const warmFenceReasons=['first-fence','historical-gap','live-binding-gap','fence-drift','source-shape','closed','reentrant'];
function warmNeed(v){if(!v)throw Error('warm-shape');}
function warmInteger(n,lo,hi){return typeof n==='number'&&Number.isSafeInteger(n)&&n>=lo&&n<=hi;}
function warmID(n){return n===null||warmInteger(n,1,32768);}
function warmAuthority(a){exact(a,['qualification','nativeGO','performance','scoring','ranking','fps']);for(const k of ['qualification','nativeGO','performance','scoring','ranking'])warmNeed(a[k]===false);warmNeed(a.fps==='unavailable');}
function warmPartial(p){
 exact(p,['kind','phase','status','reason','fullH100Readiness','generations','counts','rows','epochs','closure','authority']);warmNeed(p.kind==='live-history-C-partial-v1'&&p.fullH100Readiness==='unavailable'&&Array.isArray(p.rows)&&p.rows.length===100&&Array.isArray(p.epochs)&&p.epochs.length<=3200);
 warmNeed(p.phase==='selected'||p.phase==='preselection');warmNeed(p.status==='partial'||p.status==='unavailable');warmNeed(p.reason===null||warmReasons.includes(p.reason));
 exact(p.generations,['owner','cache','layout','commit']);warmNeed([null,1].includes(p.generations.owner)&&[null,1].includes(p.generations.cache)&&warmInteger(p.generations.layout,1,21)&&warmID(p.generations.commit));
 const limits={scopes:12832,renders:32,commits:32,nodes:3200,writes:6400,censuses:4,exports:4,options:64,detach:6400,layoutEvents:20,work:67108864};exact(p.counts,Object.keys(limits));for(const k of Object.keys(limits))warmNeed(warmInteger(p.counts[k],0,limits[k]));
 for(let i=0;i<100;i++){const r=p.rows[i];warmNeed(Array.isArray(r)&&r.length===16&&r[0]===i&&r[1]===i&&warmID(r[2])&&warmID(r[3])&&(r[4]===null||typeof r[4]==='number'&&Number.isFinite(r[4])&&r[4]>0&&r[4]<=1e7)&&[null,1].includes(r[5])&&[null,1].includes(r[6])&&warmInteger(r[7],1,21));for(let j=8;j<12;j++)warmNeed(warmID(r[j]));warmNeed((r[12]===null||warmInteger(r[12],1,6400))&&(r[13]===null||r[13]===true)&&typeof r[14]==='boolean'&&typeof r[15]==='boolean');}
 for(const e of p.epochs){warmNeed(Array.isArray(e)&&e.length===8);epochTuple(e);warmNeed(warmInteger(e[0],1,32768)&&warmInteger(e[2],1,32768));}
 exact(p.closure,['active','pending','disposed','late','originalFailed','fontFailed']);warmNeed(warmInteger(p.closure.active,0,4608)&&warmInteger(p.closure.pending,0,8));for(const k of ['disposed','late','originalFailed','fontFailed'])warmNeed(typeof p.closure[k]==='boolean');warmAuthority(p.authority);
}
function warmChronology(c){
 exact(c,['status','reason','complete','records','bytes','text','fullWarmReady','nativeGO']);warmNeed(c.status==='captured-baseline-only'||c.status==='unavailable');warmNeed(c.reason===null||warmCaptureReasons.includes(c.reason));warmNeed(typeof c.complete==='boolean'&&c.complete===(c.reason===null)&&c.status===(c.complete?'captured-baseline-only':'unavailable'));
 warmNeed(warmInteger(c.records,0,464)&&warmInteger(c.bytes,0,49152)&&typeof c.text==='string'&&c.text.length===c.bytes&&c.fullWarmReady===false&&c.nativeGO===false);
 // Closed source records only. Disjoint newline/payload classes bound the
 // native walk; cap lines before allocating either global prefix-match vector.
 warmNeed(/^(?:(?:R|E)\|[|0-9a-f,-]*\n){0,464}$(?![\s\S])/.test(c.text));
 const ranges=c.text.match(/^R\|/gm)?.length??0,events=c.text.match(/^E\|/gm)?.length??0;
 warmNeed(ranges+events===c.records&&ranges<=16&&events<=448);
}
function warmPlan(p){
 exact(p,['status','reason','gapStart','gapEnd','partition','targets','finalLow','finalHigh','steps','rangeCalls']);warmNeed(p.status==='prepared-structural-only'||p.status==='unavailable');warmNeed(p.reason===null||warmPlanReasons.includes(p.reason));warmNeed(warmInteger(p.steps,0,12)&&warmInteger(p.rangeCalls,0,24)&&typeof p.targets==='string'&&p.targets.length<=35);
 if(p.status==='unavailable'){warmNeed(p.reason!==null&&p.gapStart===null&&p.gapEnd===null&&p.partition===null&&p.finalLow===null&&p.finalHigh===null&&p.targets===''&&p.steps===0);return;}
 warmNeed(p.reason===null);for(const k of ['gapStart','gapEnd','partition','finalLow','finalHigh'])warmNeed(warmInteger(p[k],0,99));warmNeed(p.gapStart<=p.gapEnd&&p.finalLow<=p.finalHigh&&p.steps>0);
 const a=p.targets.split(',');warmNeed(a.length===p.steps);for(const x of a)warmNeed(/^(0|[1-9][0-9]?)$/.test(x));
}
function warmFence(f){
 exact(f,['historicalComplete','liveSubsetValid','fullWarmReady','connectedRows','reason','nativeGO','qualified','fps']);for(const k of ['historicalComplete','liveSubsetValid','fullWarmReady'])warmNeed(typeof f[k]==='boolean');warmNeed(warmInteger(f.connectedRows,0,101)&&(f.reason===null||warmFenceReasons.includes(f.reason))&&f.nativeGO===false&&f.qualified===false&&f.fps===null);
 if(f.fullWarmReady)warmNeed(f.historicalComplete&&f.liveSubsetValid&&f.reason===null);
}
export function encodeWarmSlot(name,value){
 warmNeed(typeof name==='string'&&/^partial-0[1-4]\.json$/.test(name));exact(value,['kind','slot','partial','chronology','plan','fence','authority']);warmNeed(value.kind==='warm-history-C-wrapper-v1'&&value.slot===Number(name[9]));
 // The browser's unchanged partialResult already serializes the original partial.
 // Closed primitive validation here adds no second partial serialization pass.
 warmPartial(value.partial);warmAuthority(value.authority);warmFence(value.fence);
 if(value.slot===1){warmChronology(value.chronology);warmPlan(value.plan);}else warmNeed(value.chronology===null&&value.plan===null);
 const bytes=Buffer.from(JSON.stringify(value));if(bytes.length>262144)throw Error('warm-slot-limit');return bytes;
}
