// Private lexical ingress only: imported exclusively by the pinned source transform.
// Synthetic tests establish function behavior, never browser delivery or performance.
const caps={scopes:12832,renders:32,commits:32,nodes:3200,writes:6400,censuses:4,exports:4,options:64,detach:6400,layoutEvents:20,work:67108864};
const counts={scopes:0,renders:0,commits:0,nodes:0,writes:0,censuses:0,exports:0,options:0,detach:0,layoutEvents:0,work:1366464};
let reason=null,owner=null,cache=null,scroller=null,mapping=null,render=null,current=null,fiber=null,component=null;
let nativeCandidateBaseline=null,originalFailed=false,fontFailed=false,carry=null,selectedRoot=null,eligible=false,baselineWidth=null,refs=0,roEntries=0,batches=0;
let next=0,layout=1,sealed=0,disposed=false,late=false,closed=false;
let baselineOwner=null,baselineCache=null,baselineScroller=null,baselineLayout=null,provisionalNodeOwner=null;
function liveRender(r){return !!r&&r===render&&!r.closed&&!r.superseded&&!r.done&&r.Component===component&&r.rootWork?.tag===3&&r.rootWork.stateNode===r.root&&r.root.current?.alternate===r.rootWork;}
let firstSite=null,firstOptions=null;
let committedTarget=null;
function diagnostic(){return {site:firstSite,options:firstOptions?{...firstOptions}:null};}
const moduleBindings=new Set();
const bindingNames=['copilot','core','react','wrapper'],bindingCounts=[0,0,0,0],fiberFrames=[];
const renders=[],commits=[],scopes=[],epochs=[],origins=Array(101).fill(null),bindings=Array(101).fill(null);
const nodeRows=new Map(),renderByWork=new Map();
const expected=Array.from({length:100},(_,i)=>prose(i));
const refusal='live-history-export-refused';
function fail(value,site='unknown',facts=null){if(value==='original-failure')originalFailed=true;const first=reason===null;reason??=value;carry=null;eligible=false;if(first){committedTarget=null;firstSite=site;firstOptions=facts;}}
function fontFailure(){fontFailed=true;fail('layout');}
function id(){if(next===32768){fail('limit','l-id');throw 'live-history-id-refused';}return ++next;}
function admit(kind,charge){if(reason&&kind!=='exports'&&kind!=='censuses')return false;if(counts[kind]>=caps[kind]||counts.work+charge>caps.work||(['scopes','renders','commits','nodes'].includes(kind)&&next===32768)){fail('limit','l-admit');return false;}counts[kind]++;counts.work+=charge;return true;}
function prose(i){const s=`The reader considers the calm conversation number ${i} from collection 1. Clear words describe a familiar place and a thoughtful reply. `;return s.repeat(Math.ceil(512/s.length)).slice(0,511).replace(/ $/,'a')+'.';}
function ascii(s,max){if(typeof s!=='string'||s.length>max||!s.length)return false;for(let i=0;i<s.length;i++)if(s.charCodeAt(i)>127)return false;return true;}
function consumeScope(s,kind,amount){if(!s||!Number.isInteger(amount)||amount<0||s.quota[kind]<amount){fail('limit','l-scope');return false;}s.quota[kind]-=amount;return true;}
function commitScalar(c,amount,site='l-scalar'){if(!c||c.scalar<amount){fail('limit',site);return false;}c.scalar-=amount;return true;}
function verify(r,c,mainSite,tailSite){
 if(!r||r.rows.length!==r.messages.length||r.rows.length<100||r.rows.length>101)return false;
 for(let i=0;i<100;i++){
  if(!commitScalar(c,32,mainSite))return false;
  const row=r.rows[i],m=r.messages[i];
  if(row.type!=='message'||row.message!==m||m.id!==`history-${i}`||m.role!==(i%2?'user':'assistant')||m.content!==expected[i]||r.keys.get(m.id)!==m.id)return false;
 }
 if(r.rows.length===101){if(!commitScalar(c,16,tailSite))return false;const m=r.messages[100];if(r.rows[100].type!=='message'||r.rows[100].message!==m||!ascii(m.id,128)||m.id==='history-0'||/^history-\d+$/.test(m.id)||m.role!=='assistant'||r.keys.get(m.id)!==m.id)return false;}
 return true;
}
function same(a,b){return a&&b&&a.rows===b.rows&&a.messages===b.messages&&a.keys===b.keys&&a.store===b.store&&a.owner===b.owner&&a.scroller===b.scroller&&a.layout===b.layout;}
function completedFiber(r){return r.done&&!r.superseded&&r.work===fiber;}
function targetContext(r,instance){const c=current,top=fiberFrames.at(-1);return !!c&&!!r&&c.renders.length===1&&c.renders[0]===r&&top?.commit===c&&fiber===top.fiber&&r.owner===instance&&r.optionsOwner===instance&&r.optionsOK&&r.done&&!r.closed&&!r.superseded&&r.root===c.root&&r.rootWork===c.work&&c.work.tag===3&&c.work.stateNode===c.root&&renderByWork.get(r.work)===r&&r.count===100&&!!r.scroller&&r.agentId==='benchmark'&&r.threadId==='C-thread-1'&&r.cacheRef===instance.itemSizeCache;}
function cleanupPhase(s){const c=current;return !!c&&c===s.sourceCommit&&commits.at(-1)===c&&counts.renders===s.renderCount&&c.mutation===false&&c.layout===false&&c.renders.length===0;}
function cleanupOwner(s,r){const i=s.instance;return (!owner||(owner===i&&(!r||(r.cacheRef===cache&&r.scroller===scroller))))&&(!provisionalNodeOwner||provisionalNodeOwner===i)&&(!baselineOwner||(baselineOwner===i&&(!r||(r.cacheRef===baselineCache&&r.scroller===baselineScroller))));}
function cleanupCapture(s,r){const c=current;return !!c&&!!r&&r.owner===s.instance&&r.optionsOwner===s.instance&&r.optionsOK&&r.done&&!r.closed&&!r.superseded&&r.root===c.root&&r.rootWork===c.work&&r.Component===component&&r.agentId==='benchmark'&&r.threadId==='C-thread-1'&&r.count===100&&r.scroller!=null&&r.layout===layout&&renderByWork.get(r.work)===r;}
function cleanupRecognize(s,node){if(!consumeScope(s,'table',16)||!consumeScope(s,'scalar',128))return false;if(node){fail('node','n-clean-ref');return false;}if(!cleanupPhase(s)){fail('node','n-clean-phase');return false;}if(!cleanupOwner(s,null)){fail('generation','g-clean-owner');return false;}if(!consumeScope(s,'table',8)||!consumeScope(s,'scalar',64))return false;const c=current,root=c.root,work=c.work,instance=s.instance;let live=0,candidate=null;for(const r of renders){if(!consumeScope(s,'table',4)||!consumeScope(s,'scalar',16))return false;if(r.owner===instance&&r.count===100&&r.scroller!=null){if(r.done&&!r.closed&&!r.superseded&&r.root===root&&r.rootWork===work){live++;candidate=r;}}}if(live>1){fail('commit','c-clean-many');return false;}if(live!==1){fail('node','n-clean-live');return false;}if(!cleanupOwner(s,candidate)){fail('generation','g-clean-owner');return false;}if(!cleanupCapture(s,candidate)){fail('node','n-clean-capture');return false;}s.target=candidate;return true;}
function cleanupRescan(s){if(!consumeScope(s,'table',32)||!consumeScope(s,'scalar',128))return false;const c=current,root=c.root,work=c.work,instance=s.instance;let live=0,candidate=null;for(const r of renders){if(r.owner===instance&&r.count===100&&r.scroller!=null){if(r.done&&!r.closed&&!r.superseded&&r.root===root&&r.rootWork===work){live++;candidate=r;}}}return live===1&&candidate===s.target;}
function broadFailureSite(kind,refArg,c,r,prefix){if(reason!==null)return 'n-rec-broad';const k=kind===1?1:kind===2?2:kind===3?3:0,cp=c?1:0,p=r==null?0:prefix,f=k===1?(!refArg?0:1):2,m=cp?((c.mutation?2:0)+(c.layout?1:0)):4;return 'n-rec-broad-k'+k+'f'+f+'c'+cp+'m'+m+'p'+p;}
function recognizeScope(s,kind,refArg){if(!consumeScope(s,'table',8)||!consumeScope(s,'scalar',64))return false;const c=current,root=c?.root,work=c?.work,instance=s.instance;let broad=false,live=0;for(const r of renders){if(!consumeScope(s,'table',4)||!consumeScope(s,'scalar',16))return false;if(r.owner===instance&&r.count===100&&r.scroller!=null){broad=true;if(r.done&&!r.closed&&!r.superseded&&r.root===root&&r.rootWork===work)live++;}}if(live>1){fail('commit','c-rec-many');return false;}let prefix=0;const r=c?.renders[0];if((prefix=1,r?.owner===s.instance)&&(prefix=2,r.count===100)&&(prefix=3,r.scroller!=null)){if(!broad||!targetContext(r,s.instance)){fail('node','n-rec-target');return false;}s.target=r;return true;}if(!c&&s.instance===owner&&(s.kind===2||s.kind===3))return true;if(broad){fail('node',broadFailureSite(kind,refArg,c,r,prefix));return false;}return true;}
function scopeContext(s){if(!s||!consumeScope(s,'table',4)||!consumeScope(s,'scalar',32))return false;if(current!==s.sourceCommit||counts.renders!==s.renderCount){fail('commit','c-scope-commit');return false;}if(s.target){const c=current,top=fiberFrames.at(-1),r=s.target;if(!c||c.renders[0]!==r||top?.commit!==c||fiber!==top.fiber||r.owner!==s.instance||r.closed||r.superseded||r.root!==c.root||r.rootWork!==c.work||r.cacheRef!==s.instance.itemSizeCache){fail('node','n-scope-context');return false;}}return true;}
function ancestor(instance,s){const r=s?.target,c=current;if(!r)return null;if(c!==s.sourceCommit||counts.renders!==s.renderCount||c?.renders[0]!==r||fiberFrames.at(-1)?.commit!==c||r.owner!==instance){fail('node','n-anc-context');return null;}let f=fiber;for(let i=0;f&&i<45;i++,f=f.return){if(!consumeScope(s,'table',1)||!consumeScope(s,'ancestor',1)||!consumeScope(s,'scalar',2))return null;if(f===r.work)return r;}fail('node','n-anc-target');return null;}
function pendingPopulation(){let total=0;for(const c of commits)total+=c.nodes.length+c.writes.length;for(const s of scopes)total+=s.writes.length;return total;}
function activePopulation(){let total=fiberFrames.length+scopes.length;for(let i=0;i<scopes.length;i++){const s=scopes[i],e=s.edge;if(e&&e.s===s)total++;}return total;}
function admitActive(){if(reason)return false;if(activePopulation()>=7728){fail('limit','l-active');return false;}return true;}
function closeCommit(c){
 if(current!==c||commits.at(-1)!==c){fail('commit','c-close-order');return;}
 commits.pop();current=commits.at(-1)||null;
 const frame=fiberFrames.at(-1);
 fiber=current&&current===c.previousCommit&&fiberFrames.length===c.frameDepth&&frame?.commit===current&&frame===c.previousFrame?c.previousFiber:null;
}
function pendingWrite(o){if(current){if(current.nodes.length+current.writes.length>=2048){fail('limit','l-pwrite');return;}current.writes.push(o);}else{if(!sealed||!bindings[o.row]?.commit){fail('commit','c-pwrite-seal');return;}o.commit=sealed;origins[o.row]=o;}}
function carryFailureSite(prefix){return 'm-end-carry-p'+prefix;}
function emptyCommitSite(c){if(reason!==null)return 'c-end-empty-owner';return 'c-empty-r'+(c.root===selectedRoot?1:0)+'p'+(c.previousCommit===null?1:0)+'n'+(c.nodes.length===0?1:0)+'w'+(c.writes.length===0?1:0)+'f'+(c.frameDepth===0?1:0)+'m'+(mapping!==null?1:0);}
// Committed-target preservation. Bounds apply to owned work, not arbitrary getter CPU.
// Continuity assumes the pinned ordinary React/canonical data model, not hostile Proxies.
// NEW proof reads own data only; native operations never dispatch application methods.
const continuityNative={descriptor:Object.getOwnPropertyDescriptor,prototype:Object.getPrototypeOf,apply:Reflect.apply,array:Array.isArray,mapPrototype:Map.prototype,mapGet:Map.prototype.get,mapEntries:Map.prototype.entries,mapSize:Object.getOwnPropertyDescriptor(Map.prototype,'size').get,mapNext:Object.getPrototypeOf(new Map().entries()).next,nodeConnected:typeof Node==='undefined'?null:Object.getOwnPropertyDescriptor(Node.prototype,'isConnected').get,elementWidth:typeof Element==='undefined'?null:Object.getOwnPropertyDescriptor(Element.prototype,'clientWidth').get};
function ownData(object,key){const d=continuityNative.descriptor(object,key);if(!d||!('value'in d))throw 'continuity-data-refused';return d.value;}
function nativeMap(map){if(continuityNative.prototype(map)!==continuityNative.mapPrototype)throw 'continuity-map-refused';return continuityNative.apply(continuityNative.mapSize,map,[]);}
function connected(node){if(continuityNative.nodeConnected)return continuityNative.apply(continuityNative.nodeConnected,node,[]);if(typeof window!=='undefined')throw 'continuity-dom-refused';return ownData(node,'isConnected');}
function width(node){if(continuityNative.elementWidth)return continuityNative.apply(continuityNative.elementWidth,node,[]);if(typeof window!=='undefined')throw 'continuity-dom-refused';return ownData(node,'clientWidth');}
function captureTarget(c,r,nextMapping){
 try{
  const f=r.work,host=c.work;
  if(ownData(f,'type')!==component||ownData(f,'tag')!==0||ownData(c.root,'current')!==host||ownData(r.owner,'itemSizeCache')!==r.cacheRef||!same(nextMapping,r))return null;
  const props=ownData(f,'memoizedProps'),state=ownData(f,'memoizedState'),queue=ownData(f,'updateQueue'),dependencies=ownData(f,'dependencies'),contexts=[];
  if(!props||typeof props!=='object'||!state||typeof state!=='object'||!queue||typeof queue!=='object')return null;
  let d=dependencies===null?null:ownData(dependencies,'firstContext');
  while(d!==null){if(contexts.length===32||!d||typeof d!=='object')return null;const context=ownData(d,'context'),value=ownData(d,'memoizedValue'),next=ownData(d,'next');contexts.push([d,context,value,next]);d=next;}
  return {mapping:nextMapping,fiber:f,host,props,state,queue,contexts,key:r.optionsKey,commit:c.id,layout:r.layout};
 }catch{return null;}
}
function emptyOwned(c,p){return !reason&&current===c&&commits.at(-1)===c&&c.previousCommit===null&&c.frameDepth===0&&!scopes.length&&!fiberFrames.length&&!c.nodes.length&&!c.writes.length&&c.root===selectedRoot&&p===committedTarget&&p.mapping===mapping&&p.commit===sealed&&p.layout===layout&&!!mapping&&mapping.owner===owner&&mapping.cacheRef===cache&&mapping.scroller===scroller&&mapping.layout===layout&&mapping.root===selectedRoot&&(!baselineOwner||(baselineOwner===owner&&baselineCache===cache&&baselineScroller===scroller&&baselineLayout===layout));}
function emptyLive(p){const options=ownData(owner,'options'),initial=ownData(options,'initialMeasurementsCache');return ownData(owner,'itemSizeCache')===cache&&nativeMap(cache)<=128&&ownData(options,'count')===100&&ownData(options,'lanes')===1&&ownData(options,'enabled')===true&&ownData(options,'getItemKey')===p.key&&continuityNative.array(initial)&&ownData(initial,'length')===0&&connected(scroller)===true&&(!eligible||width(scroller)===baselineWidth);}
function emptyContexts(f,p){const dependencies=ownData(f,'dependencies');let d=dependencies===null?null:ownData(dependencies,'firstContext');for(const e of p.contexts){if(d!==e[0]||ownData(d,'context')!==e[1]||ownData(d,'memoizedValue')!==e[2]||ownData(d,'next')!==e[3])return false;d=e[3];}return d===null;}
function treeEntrySite(f,count){return !f?'c-tree-falsy':typeof f!=='object'?'c-tree-type':count===3072?'c-tree-limit':'c-tree-cycle';}
function emptyVisible(path,refusal){const allowed=[0,1,3,5,6,7,8,9,10,11,12,13,14,15,22,23,24,26,27];for(let i=0;i<path.length;i++){const f=path[i],tag=ownData(f,'tag');if(!allowed.includes(tag)||(tag===3&&i!==0)||((tag===13||tag===22||tag===23)&&ownData(f,'memoizedState')!==null)){refusal.site=!allowed.includes(tag)?'c-tree-tag':tag===3&&i!==0?'c-tree-root':'c-tree-hidden';return false;}}return true;}
function emptyTarget(host,p){
 const seen=new Set(),path=[],certified=p.fiber,alternate=ownData(certified,'alternate'),refusal={site:null};let count=0,found=null,bad=false;
 function visit(f,depth){
  if(!f||typeof f!=='object'||count===3072||seen.has(f)){bad=treeEntrySite(f,count);return;}
  count++;seen.add(f);path.push(f);
  if(f===certified||(f===alternate&&ownData(f,'alternate')===certified)){if(found!==null||!emptyVisible(path,refusal)){bad=found!==null?'c-tree-duplicate':refusal.site;return;}found=f;}
  for(let child=ownData(f,'child');child!==null;child=ownData(child,'sibling')){if(depth===127){bad='c-tree-depth';break;}visit(child,depth+1);if(bad)break;}
  path.pop();
 }
 visit(host,0);return bad?bad:found;
}
function emptyPayload(c){
 const rows=mapping.rows,messages=mapping.messages,keys=mapping.keys,length=ownData(rows,'length');
 if(length!==ownData(messages,'length')||length<100||length>101)return false;nativeMap(keys);
 for(let i=0;i<100;i++){
  if(!commitScalar(c,32,'l-empty-verify'))return false;
  const row=ownData(rows,i),m=ownData(messages,i),id=ownData(m,'id');
  if(ownData(row,'type')!=='message'||ownData(row,'message')!==m||id!==`history-${i}`||ownData(m,'role')!==(i%2?'user':'assistant')||ownData(m,'content')!==expected[i]||continuityNative.apply(continuityNative.mapGet,keys,[id])!==id)return false;
 }
 if(length===101){if(!commitScalar(c,16,'l-empty-tail'))return false;const row=ownData(rows,100),m=ownData(messages,100),id=ownData(m,'id');if(ownData(row,'type')!=='message'||ownData(row,'message')!==m||!ascii(id,128)||id==='history-0'||/^history-\d+$/.test(id)||ownData(m,'role')!=='assistant'||continuityNative.apply(continuityNative.mapGet,keys,[id])!==id)return false;}
 return true;
}
function emptyCache(){nativeMap(cache);const iterator=continuityNative.apply(continuityNative.mapEntries,cache,[]);let entries=0;for(;;){const item=continuityNative.apply(continuityNative.mapNext,iterator,[]);if(item.done)return true;const pair=item.value,key=pair[0],value=pair[1];if(++entries>128||!Number.isInteger(key)||key<0||key>100||!Number.isFinite(value)||value<=0||value>1e7)return false;}}
function emptyContinuity(c){
 const p=committedTarget;if(!p)return false;const start=counts.work;
 if(!emptyOwned(c,p))return 'c-empty-context';const host=c.work,oldHost=p.host;
 if(ownData(host,'tag')!==3||ownData(host,'stateNode')!==selectedRoot||ownData(selectedRoot,'current')!==host||ownData(host,'sibling')!==null||!(host===oldHost||(ownData(host,'alternate')===oldHost&&ownData(oldHost,'alternate')===host)))return 'c-empty-root';
 if(!emptyLive(p))return 'c-empty-options';const target=emptyTarget(host,p);
 if(typeof target==='string')return target;
 if(!target)return 'c-tree-absent';
 if(c.closedVisit&&target!==c.closedVisit)return 'c-bail-target';
 if(ownData(target,'type')!==component||ownData(target,'tag')!==0||ownData(target,'memoizedProps')!==p.props||ownData(target,'memoizedState')!==p.state||ownData(target,'updateQueue')!==p.queue||!emptyContexts(target,p))return 'c-empty-payload';
 if(mapping.agentId!=='benchmark'||mapping.threadId!=='C-thread-1'||!emptyPayload(c))return 'c-empty-payload';
 if(!emptyCache())return 'c-empty-cache';
 if(counts.work!==start||!emptyOwned(c,p))return 'c-empty-context';
 return null;
}
// CLOSED_BAILOUT_HELPER_BEGIN
function deferClosedFiber(c,r,finished){
 if(c.closedVisit){fail('commit','c-bail-repeat');return;}
 c.closedVisit=finished;
 const p=committedTarget;
 if(!p){fail('commit','c-bail-e1');return;}if(!owner){fail('commit','c-bail-e2');return;}if(!mapping){fail('commit','c-bail-e3');return;}if(current!==c){fail('commit','c-bail-e4');return;}if(commits.at(-1)!==c){fail('commit','c-bail-e5');return;}if(c.previousCommit!==null){fail('commit','c-bail-e6');return;}if(c.frameDepth!==0){fail('commit','c-bail-e7');return;}if(c.renders.length){fail('commit','c-bail-e8');return;}if(c.nodes.length){fail('commit','c-bail-e9');return;}if(c.writes.length){fail('commit','c-bail-e10');return;}if(scopes.length){fail('commit','c-bail-e11');return;}if(fiberFrames.length){fail('commit','c-bail-e12');return;}if(p.mapping!==mapping){fail('commit','c-bail-e13');return;}if(p.commit!==sealed){fail('commit','c-bail-e14');return;}if(p.layout!==layout){fail('commit','c-bail-e15');return;}if(r.superseded){fail('commit','c-bail-e16');return;}if(r.count!==100){fail('commit','c-bail-e17');return;}if(!r.rows){fail('commit','c-bail-e18');return;}if(!r.optionsOK){fail('commit','c-bail-e19');return;}if(r.optionsOwner!==owner){fail('commit','c-bail-e20');return;}if(r.owner!==owner){fail('commit','c-bail-e21');return;}if(r.root!==c.root){fail('commit','c-bail-e22');return;}const historicalRoot=r.rootWork;if(historicalRoot!==c.work&&(!historicalRoot||typeof historicalRoot!=='object'||ownData(c.work,'alternate')!==historicalRoot||ownData(historicalRoot,'alternate')!==c.work||ownData(historicalRoot,'tag')!==3||ownData(historicalRoot,'stateNode')!==c.root)){fail('commit','c-bail-e23');return;}if(r.cacheRef!==cache){fail('commit','c-bail-e24');return;}if(r.scroller!==scroller){fail('commit','c-bail-e25');return;}if(r.agentId!=='benchmark'){fail('commit','c-bail-e26');return;}if(r.threadId!=='C-thread-1'){fail('commit','c-bail-e27');return;}if(!same(mapping,r)){fail('commit','c-bail-e28');return;}
 const certified=p.fiber;
 if(finished!==certified){if(ownData(certified,'alternate')!==finished){fail('commit','c-bail-a1');return;}if(ownData(finished,'alternate')!==certified){fail('commit','c-bail-a2');return;}}if(ownData(finished,'type')!==component){fail('commit','c-bail-a3');return;}if(ownData(finished,'tag')!==0){fail('commit','c-bail-a4');return;}
 const flags=ownData(finished,'flags');
 if(typeof flags!=='number'||!Number.isSafeInteger(flags)||flags< -2147483648||flags>2147483647||(flags&4)!==0){fail('commit','c-bail-flags');return;}
}
// CLOSED_BAILOUT_HELPER_END
function endCommit(root,work,normal,phase){
 const c=current;
 if(!c||c.root!==root||c.work!==work){fail('commit','c-end-identity');return;}
 if(!normal){fail('original-failure');closeCommit(c);return;}
 if(phase===1){c.layout=true;return;}
 if(!c.mutation||!c.layout){fail('commit','c-end-phases');return;}
 const joined=c.renders;let candidate=null,nextMapping=mapping,nextCarry=carry;
 for(const proposed of renders){if(!commitScalar(c,16,'l-cscan'))break;if(!proposed.closed&&!proposed.superseded&&proposed.done&&proposed.root===c.root&&proposed.rootWork===c.work&&proposed.rows&&proposed.count===100&&proposed.scroller&&!joined.includes(proposed))fail('commit','c-end-unjoined');}
 if(scopes.length||fiberFrames.some(f=>f.commit===c))fail('commit','c-end-active');
 // CLOSED_BAILOUT_END_BEGIN
 if(c.closedVisit){const site=c.renders.length?'c-bail-mixed':emptyContinuity(c);if(site!==null)fail('commit',site||'c-bail-context');closeCommit(c);return;}
 // CLOSED_BAILOUT_END_END
 for(const r of joined){
  if(!r.done||r.superseded||r.owner.itemSizeCache!==r.cacheRef||r.owner.options.count!==r.count){fail('mapping','m-end-capture');break;}
  if(r.rows.length===0&&!owner&&r.count===0)continue;
  if(!verify(r,c,'l-cverify','l-cverify-tail')||r.agentId!=='benchmark'||r.threadId!=='C-thread-1'){fail('mapping','m-end-verify');break;}
  if(!owner&&r.count===0){if(r.map)nextCarry={r,root:c.root,commit:c.id,cache:r.owner.itemSizeCache};continue;}
  let carryPrefix=0;const carried=(carryPrefix=1,!owner)&&(carryPrefix=2,carry)&&(carryPrefix=3,carry.root===c.root)&&(carryPrefix=4,carry.cache===r.owner.itemSizeCache)&&['rows','messages','keys','store','owner','agentId','threadId'].every(k=>(carryPrefix++,carry.r[k]===r[k]));
  if(!same(mapping,r)&&!r.map&&!carried){fail('mapping',carryFailureSite(carryPrefix));break;}
  if(r.count!==100||!r.scroller){fail('mapping','m-end-target');break;}
  if(selectedRoot&&selectedRoot!==c.root){fail('generation');break;}
  if(owner&&owner!==r.owner){fail('generation');break;}
  if(cache&&cache!==r.owner.itemSizeCache){fail('generation');break;}
  if(scroller&&scroller!==r.scroller){fail('layout');break;}
  if(r.owner.elementsCache.size>100){fail('limit','l-elements');break;}
  if(!owner&&c.previousCommit){fail('commit','c-end-nested-owner');break;}
  if(baselineOwner&&(baselineOwner!==r.owner||baselineCache!==r.owner.itemSizeCache||baselineScroller!==r.scroller||baselineLayout!==r.layout)){fail('layout');break;}
  candidate=r;if(r.map||carried)nextMapping=r;nextCarry=null;
 }
 if(!joined.length&&owner){const site=emptyContinuity(c);if(site===null){closeCommit(c);return;}fail('commit',site||emptyCommitSite(c));}
 const captureWork=counts.work,prepared=!reason&&candidate&&!c.previousCommit?captureTarget(c,candidate,nextMapping):null;
 if(counts.work!==captureWork)fail('source-gap','c-certificate-context');
 if(!reason){for(const e of c.nodes){e.commit=c.id;const old=bindings[e.row];if(old)old.connected=false;bindings[e.row]=e;}
  for(const o of c.writes){o.commit=c.id;origins[o.row]=o;}
  c.done=true;
 }
 closeCommit(c);
 if(!current&&!reason){if(candidate){owner=candidate.owner;cache=owner.itemSizeCache;scroller=candidate.scroller;selectedRoot=c.root;mapping=nextMapping;}carry=nextCarry;if(owner)sealed=c.id;for(const r of renders)if(r.root===c.root&&r.rootWork===c.work){r.closed=true;r.seen?.clear();}}
 if(!reason&&candidate&&!c.previousCommit){if(current||commits.length||counts.work!==captureWork)fail('source-gap','c-certificate-context');else if(prepared){const finalRoot=ownData(root,'current');if(!reason&&finalRoot===work&&!current&&!commits.length&&counts.work===captureWork&&sealed===c.id&&mapping===prepared.mapping&&owner===mapping.owner&&cache===mapping.cacheRef&&scroller===mapping.scroller&&layout===prepared.layout)committedTarget=prepared;else fail('source-gap','c-certificate-context');}else committedTarget=null;}
}
function exportResult(){
 const rows=[];
 for(let i=0;i<100;i++){
  const b=bindings[i],o=origins[i],valid=!!o&&!!b&&cache?.get(i)===o.size&&o.layout===layout;
  if(!valid)fail('unmeasured');
  rows.push([i,i,b?.id??null,o?.node??null,o?.size??null,owner?1:null,cache?1:null,layout,o?.commit??null,o?.measure??null,o?.edge??null,o?.resize??null,o?.seq??null,o?true:null,!!b?.measured&&!!b?.connected,valid]);
 }
 const result={kind:'live-history-cache-capability-v1',status:reason?'unavailable':'observed',reason,mappingDigest:mapping?'0328cdfa29c0798eb463060b2c016761e242fed6c3409255f6f3991ce99e2cb1':null,generations:{owner:owner?1:null,cache:cache?1:null,layout,commit:sealed||null},counts:{...counts},rows,epochs:epochs.map(e=>[e.id,e.row,e.render,e.commit,e.connected,e.measured,1,e.layout]),closure:{active:activePopulation(),pending:commits.length,commitOpen:!!current,disposed,late},authority:{qualification:false,nativeGO:false,performance:false,scoring:false,ranking:false,fps:'unavailable'}};
 if(new TextEncoder().encode(JSON.stringify(result,null,2)+'\n').length>262144)throw refusal;
 return result;
}
function partialResult(){
 if(bindingCounts.some(n=>n!==1))fail('source-gap');
 if(!admit('exports',262144)||!admit('censuses',8192))throw refusal;
 if(current||scopes.length||fiberFrames.length)fail('commit','c-export-active');
 if(owner&&owner.itemSizeCache!==cache)fail('generation');
 if(cache){if(cache.size>128)fail('limit','l-cache-partial');else for(const [k,v]of cache)if(!Number.isInteger(k)||k<0||k>=100||!Number.isFinite(v)||v<=0||v>1e7)fail('mapping','m-partial-cache');}
 const rows=[];for(let i=0;i<100;i++){const b=bindings[i],o=origins[i],valid=!!b&&!!o&&o.node===b.id&&b.commit!==null&&o.commit!==null&&b.commit<=o.commit&&o.commit<=sealed&&b.layout===layout&&o.eligible===true&&o.layout===layout&&cache?.get(i)===o.size;rows.push([i,i,b?.id??null,o?.node??null,o?.size??null,owner?1:null,cache?1:null,layout,o?.commit??null,o?.measure??null,o?.edge??null,o?.resize??null,o?.seq??null,o?true:null,!!b?.measured&&!!b?.connected&&b.node?.isConnected===true,valid]);}
 const out={kind:'live-history-C-partial-v1',phase:owner?'selected':'preselection',status:reason?'unavailable':'partial',reason,fullH100Readiness:'unavailable',generations:{owner:owner?1:null,cache:cache?1:null,layout,commit:sealed||null},counts:{...counts},rows,epochs:epochs.map(e=>[e.id,e.row,e.render,e.commit,e.connected,e.measured,1,e.layout]),closure:{active:activePopulation(),pending:commits.length,disposed,late,originalFailed,fontFailed},authority:{qualification:false,nativeGO:false,performance:false,scoring:false,ranking:false,fps:'unavailable'}};
 if(new TextEncoder().encode(JSON.stringify(out)).length>262144)throw refusal;return out;
}
const hooks={
 partial(){return partialResult();},
 baseline(instance,scroll,fontsReady,width){if(reason||eligible||instance!==owner||scroll!==scroller||fontsReady!==true||!Number.isFinite(width)||width<=0){fail('layout');return false;}baselineWidth=width;eligible=true;return true;},
 guard(width,fontChange=false){if(!admit('layoutEvents',256))return;if(eligible&&(fontChange||width!==baselineWidth)){layout++;fail('layout');}},

 moduleBinding(kind){const index=bindingNames.indexOf(kind);if(index<0){fail('source-gap');return;}bindingCounts[index]=Math.min(2,bindingCounts[index]+1);if(bindingCounts[index]!==1){fail('source-gap');return;}moduleBindings.add(kind);},
 bindingReceipt(){const available=bindingCounts.every(n=>n===1)&&!reason&&!closed&&!late;return {kind:'private-live-history-emitted-singleton-v1',status:available?'observed':'unavailable',reason:available?null:reason??'source-gap',bindings:[...moduleBindings].sort(),counts:[...bindingCounts],qualification:false,performance:false};},
 component(value){if(component&&component!==value){fail('source-gap');return;}component=value;},
 renderStart(work,Component,root,rootWork){if(Component!==component)return null;if(!root||rootWork?.tag!==3||rootWork.stateNode!==root||root.current?.alternate!==rootWork){fail('commit','c-render-root');return null;}if(!admit('renders',4096))return null;const previous=renderByWork.get(work);if(previous&&!previous.closed)previous.superseded=true;const r={id:id(),work,Component,root,rootWork,done:false,closed:false,parent:render,optionsOwner:null,optionsKey:null,optionsOK:false,scalar:4032};renders.push(r);renderByWork.set(work,r);render=r;return r;},
 renderEnd(r,normal){if(!normal)fail('original-failure');if(!r)return;r.done=!!normal;render=r.parent;},
 rows(rows,messages,keys,store,instance,scroll,transform,group,children,agentId,threadId){if(!render||render.rows||transform||group||children){fail('mapping','m-rows-shape');return null;}if(!liveRender(render)||!render.optionsOK||render.optionsOwner!==instance){fail('source-gap');return null;}if(owner&&owner!==instance){fail('generation');return null;}Object.assign(render,{rows,messages,keys,store,owner:instance,cacheRef:instance.itemSizeCache,scroller:scroll,count:instance.options.count,agentId,threadId,layout,seen:new Map()});if(nativeCandidateBaseline)nativeCandidateBaseline(instance,scroll,render);return render;},
 key(row,value){if(render?.rows){if(!commitScalar(render,8,'l-rkey'))return value;if((render.keyCalls??0)>=101)fail('limit','l-key-count');else{render.keyCalls=(render.keyCalls??0)+1;render.seen.set(row,value);}}return value;},
 mapping(r){if(!commitScalar(current,16,'l-map'))return;if(!current||!r||!current.renders.includes(r)){fail('commit','c-map-join');return;}r.map=true;},
 commitStart(root,work){if(current?.closedVisit){fail('commit','c-bail-nested');return null;}if(commits.length>=8){fail('limit','l-commit-depth');return null;}if(!admit('commits',262144))return null;const c={id:id(),root,work,closedVisit:null,nodes:[],writes:[],renders:[],mutation:false,layout:false,scalar:15424,previousCommit:current,previousFiber:fiber,previousFrame:fiberFrames.at(-1),frameDepth:fiberFrames.length};commits.push(c);current=c;fiber=null;return c;},
 commitMutationEnd(c,normal){if(!c)return;if(!normal){fail('original-failure');closeCommit(c);return;}c.mutation=true;},
 fiberStart(root,currentFiber,finished){if(reason)return null;const c=current,host=c?.work;if(!c||root!==c.root||host?.tag!==3||host.stateNode!==root){fail('commit','c-fiber-root');return null;}if(!commitScalar(current,16,'l-fiber'))return null;const top=fiberFrames.at(-1),inside=top?.commit===current,r=renderByWork.get(finished);if(inside){if(finished.return!==fiber||(r&&r!==current.renders[0])){fail('commit','c-fiber-parent');return null;}}else{if(!r)return null;if((r.closed||r.superseded)&&r.count===0)return null;if(r.work!==finished){fail('commit','c-fiber-r1');return null;}if(!r.done){fail('commit','c-fiber-r2');return null;}if(r.closed){deferClosedFiber(c,r,finished);return null;}if(r.superseded){fail('commit','c-fiber-r4');return null;}if(!r.rows){fail('commit','c-fiber-r5');return null;}if(!r.optionsOK){fail('commit','c-fiber-r6');return null;}if(r.optionsOwner!==r.owner){fail('commit','c-fiber-r7');return null;}if(r.root!==current.root){fail('commit','c-fiber-r8');return null;}if(r.rootWork!==current.work){fail('commit','c-fiber-r9');return null;}if(r.cacheRef!==r.owner.itemSizeCache){fail('commit','c-fiber-r10');return null;}if(r.agentId!=='benchmark'){fail('commit','c-fiber-r11');return null;}if(r.threadId!=='C-thread-1'){fail('commit','c-fiber-r12');return null;}if(current.renders.length){fail('commit','c-fiber-r13');return null;}}if(!admitActive())return null;const token={commit:current,previous:fiber,fiber:finished};fiberFrames.push(token);fiber=finished;if(!inside)current.renders.push(r);return token;},
 fiberEnd(token,normal){if(!normal)fail('original-failure');if(!token)return;if(fiberFrames.at(-1)!==token||current!==token.commit){fail('commit','c-fiber-end');return;}fiberFrames.pop();fiber=token.previous;},
 commitLayoutEnd(root,work,normal){endCommit(root,work,normal,1);},
 commitSpawnedEnd(root,work,normal){endCommit(root,work,normal,2);},
 beginCleanup(instance,node){if(reason)return null;if(++refs>3200){fail('limit','l-begin-count');return null;}if(scopes.length>=8){fail('limit','l-begin-depth');return null;}if(!admitActive()||!admit('scopes',4096))return null;const s={id:id(),instance,kind:5,node:null,index:null,edge:null,resize:null,writes:[],target:null,sourceCommit:current,renderCount:counts.renders,quota:{table:256,ancestor:256,scalar:1024}};if(!cleanupRecognize(s,node))return null;scopes.push(s);return s;},
 endCleanup(instance,s,normal){if(!s){if(!normal)fail('original-failure');return;}if(scopes.at(-1)!==s||instance!==s.instance||s.kind!==5){fail('node','n-clean-end');if(!normal)fail('original-failure');return;}if(!normal)fail('original-failure');const funded=consumeScope(s,'table',16)&&consumeScope(s,'scalar',128),fresh=funded&&cleanupPhase(s)&&cleanupOwner(s,s.target)&&cleanupCapture(s,s.target);if(!fresh)fail('node','n-clean-context');const empty=s.node===null&&s.index===null&&s.edge===null&&s.resize===null&&s.writes.length===0;if(!empty)fail('node','n-clean-credit');if(normal&&fresh&&empty&&!reason&&!cleanupRescan(s))fail('node','n-clean-context');scopes.pop();},
 begin(instance,kind,refArg){if(reason)return null;if((kind===1&&++refs>3200)||(kind===2&&++roEntries>3200)||(kind===3&&++batches>32)){fail('limit','l-begin-count');return null;}if(scopes.length>=8){fail('limit','l-begin-depth');return null;}if(!admitActive()||!admit('scopes',4096))return null;const s={id:id(),instance,kind,node:null,index:null,edge:null,resize:null,writes:[],target:null,sourceCommit:current,renderCount:counts.renders,quota:{table:256,ancestor:256,scalar:1024}};if(!recognizeScope(s,kind,refArg))return null;scopes.push(s);return s;},
 bind(instance,s,node,index){if(!s||!node||!Number.isInteger(index)||index<0||index>100)return;if(!scopeContext(s))return;if(s.kind===5){fail('node','n-clean-measure');return;}const r=ancestor(instance,s);if(!owner&&(!r||r.count!==100||!r.scroller)){s.ignored=true;return;}if(!consumeScope(s,'table',8)||!consumeScope(s,'scalar',64))return;const existing=bindings[index];if(!r){if(s.kind!==2||!existing||existing.node!==node||!existing.commit||instance!==owner){fail('node','n-bind-existing');return;}s.node=existing;s.index=index;return;}if(r.seen.get(r.rows[index])!==r.messages[index].id){fail('mapping','m-bind-key');return;}if(nodeRows.has(node)&&nodeRows.get(node)!==index){fail('node','n-bind-row');return;}if(epochs.length>=3200||pendingPopulation()>=2048){fail('limit','l-bind-pop');return;}if(!admit('nodes',0))return;if(!owner){if(provisionalNodeOwner&&provisionalNodeOwner!==instance){fail('generation');return;}provisionalNodeOwner=instance;}const e={id:id(),node,row:index,render:r.id,commit:null,connected:false,measured:false,layout};epochs.push(e);nodeRows.set(node,index);s.node=e;s.index=index;current.nodes.push(e);},
 edge(instance,s,node,index){if(s?.ignored){scopeContext(s);return null;}if(!s||!consumeScope(s,'table',4)||!consumeScope(s,'scalar',32))return null;if(s.edge||s.instance!==instance||s.node?.node!==node||s.index!==index){fail('node','n-edge-state');return null;}if(!scopeContext(s)||!admitActive())return null;if(s.kind===5){fail('node','n-clean-measure');return null;}const e={id:id(),s,size:null,returned:false};s.edge=e;return e;},
 measuredResult(e,size){if(e&&scopeContext(e.s)&&consumeScope(e.s,'scalar',16)){if(!Number.isFinite(size)||size<=0||size>1e7)fail('node','n-measured-size');e.size=size;e.s.node.measured=true;e.s.node.connected=true;}return size;},
 resizeEnter(instance,index,size){const s=scopes.at(-1);if(s?.ignored){scopeContext(s);return null;}if(!s||s.instance!==instance||s.index!==index||s.edge?.size!==size){fail('node','n-resize-enter');return null;}if(!consumeScope(s,'scalar',16)||!scopeContext(s))return null;if(s.kind===5){fail('node','n-clean-measure');return null;}if(scopes.length>=8){fail('limit','l-resize-depth');return null;}if(!admitActive()||!admit('scopes',4096))return null;const r={id:id(),instance,index,edge:s.edge,node:s.node,parent:s,kind:4,writes:[],target:s.target,sourceCommit:s.sourceCommit,renderCount:s.renderCount,quota:{table:256,ancestor:256,scalar:1024}};if(!consumeScope(r,'table',4)||!consumeScope(r,'scalar',32))return null;s.resize=r.id;scopes.push(r);return r;},
 write(instance,key,size){const s=scopes.at(-1);if(s?.ignored){scopeContext(s);return;}if(!s||s.kind!==4||s.instance!==instance||s.index!==key||s.edge?.size!==size||!s.parent?.resize){fail('node','n-write-context');return;}if(!scopeContext(s))return;if(!consumeScope(s,'table',32)||!consumeScope(s,'scalar',64))return;if(s.writes.length){fail('node','n-write-once');return;}if(pendingPopulation()>=2048){fail('limit','l-write-pop');return;}if(!admit('writes',0))return;s.writes.push({row:key,node:s.node.id,size,layout,eligible,commit:null,measure:s.parent.id,edge:s.edge.id,resize:s.id,seq:counts.writes});},
 resizeExit(instance,token,normal){if(!token){if(!normal)fail('original-failure');return;}if(token!==scopes.at(-1)||token.instance!==instance){fail('node','n-resize-exit');if(!normal)fail('original-failure');return;}if(!normal)fail('original-failure');const fresh=scopeContext(token);scopes.pop();if(normal&&fresh&&!reason)token.parent.writes.push(...token.writes);},
 edgeReturn(e){if(e&&scopeContext(e.s))e.returned=true;},
 end(instance,s,normal){if(!s){if(!normal)fail('original-failure');return;}if(scopes.at(-1)!==s||instance!==s.instance){fail('node','n-end-lifo');if(!normal)fail('original-failure');return;}if(!normal)fail('original-failure');const fresh=scopeContext(s);if(s.kind===5){fail('node','n-clean-measure');return;}if(!s.ignored&&s.edge&&!s.edge.returned)fail('node','n-end-edge');scopes.pop();if(normal&&fresh&&!reason){const parent=scopes.at(-1);if(parent)parent.writes.push(...s.writes);else for(const o of s.writes)pendingWrite(o);}},
 reset(instance,site){fail('generation',site===1?'reset-disabled':site===2?'reset-lanes':site===3?'reset-measure':site===4?'reset-initial-seed':'unknown');},failure(){fail('original-failure');},
 detach(instance,node){if(!admit('detach',256))return;if(instance!==owner)return;const row=nodeRows.get(node),b=bindings[row];if(b?.node===node)b.connected=false;},
 options(instance,merged,key){if(!admit('options',256))return;const prior=owner||render?.optionsOwner,facts={call:counts.options,hadOwner:!!prior,sameOwner:prior?prior===instance:null,selected:!!owner,lanesOne:null,enabledTrue:null,initialEmpty:null};if(prior&&prior!==instance){fail('generation','options-owner',facts);return;}if(!liveRender(render)){fail('source-gap');return;}if((baselineOwner&&baselineOwner!==instance)||(provisionalNodeOwner&&provisionalNodeOwner!==instance)){fail('generation','options-owner',facts);return;}render.optionsOK=false;if(merged.getItemKey!==key||typeof key!=='function'){fail('mapping','m-options-key');return;}if(!(facts.lanesOne=merged.lanes===1)){fail('generation','options-lanes',facts);return;}if(!(facts.enabledTrue=merged.enabled===true)){fail('generation','options-enabled',facts);return;}if(!(facts.initialEmpty=merged.initialMeasurementsCache.length===0)){fail('generation','options-initial-cache',facts);return;}if(merged.count!==100&&!(merged.count===0&&!owner)){fail('mapping','m-options-count');return;}render.optionsOwner=instance;render.optionsKey=key;render.optionsOK=true;},cache(instance,value){return value;},resizeFn(instance,value){return value;},resetDone(){},
 census(instance){if(!admit('exports',32768))throw refusal;if(!admit('censuses',8192))throw refusal;if(instance!==owner||owner?.itemSizeCache!==cache)fail('generation');if(current||scopes.length)fail('commit','c-census-active');if(cache&&cache.size>128)fail('limit','l-cache-census');else if(cache)for(const [key,value]of cache){if(!Number.isInteger(key)||key<0||key>100||!Number.isFinite(value)||value<=0||value>1e7)fail('mapping','m-census-cache');}return exportResult();},
 dispose(){disposed=true;closed=true;fail('disposal');for(const e of epochs)e.node=null;for(const r of renders){r.work=null;r.root=null;r.rootWork=null;r.Component=null;r.rows=null;r.messages=null;r.keys=null;r.store=null;r.owner=null;r.cacheRef=null;r.scroller=null;r.optionsOwner=null;r.optionsKey=null;r.parent=null;r.seen?.clear();}nodeRows.clear();renderByWork.clear();carry=null;mapping=null;render=null;owner=null;cache=null;scroller=null;selectedRoot=null;component=null;baselineOwner=null;baselineCache=null;baselineScroller=null;baselineLayout=null;provisionalNodeOwner=null;nativeCandidateBaseline=null;},timeout(){closed=true;fail('timeout');},layoutChanged(){if(!admit('layoutEvents',256))return;layout++;fail('layout');}
};
// Fault containment is prepaid by setup; no tap changes an original throw or return.
export const adapter=Object.freeze(Object.fromEntries(Object.entries(hooks).map(([name,fn])=>[name,function(...args){try{if(closed&&!['census','partial','dispose','timeout','bindingReceipt'].includes(name))late=true;return fn(...args);}catch(error){if(name==='census'||name==='partial')throw refusal;fail('source-gap');if(name==='measuredResult')return args[1];if(name==='key')return args[1];if(name==='cache'||name==='resizeFn')return args[1];return null;}}])));
// Explicit source entry installation only. No application launch or listener at import.
export function installC(originalLaunch){
 if(typeof window==='undefined'||typeof originalLaunch!=='function'||window.__liveHistoryC!==undefined)throw Error('C-install');
 let installed=true,fontEvents=0,frameCount=0,observations=0,launched=false,loaded=false,base=false,style=null,fontReady=false;document.fonts.ready.then(()=>{fontReady=true;},()=>fontFailure());
 const establish=(instance,scroll,r)=>{if(reason||eligible||!fontReady||document.fonts.status!=='loaded'||!scroll||instance.options.count!==100)return;if(baselineOwner){fail('layout');return;}if(owner){if(instance!==owner||instance.itemSizeCache!==cache||scroll!==scroller){fail('generation');return;}}else{if(!liveRender(r)||r!==render||!r.optionsOK||r.optionsOwner!==instance||r.owner!==instance||r.cacheRef!==instance.itemSizeCache||r.scroller!==scroll||r.count!==100||r.layout!==layout){fail('source-gap');return;}const valid=verify(r,r,'l-rverify','l-rverify-tail')&&r.agentId==='benchmark'&&r.threadId==='C-thread-1';if(!valid){fail('mapping','m-establish-verify');return;}}const cs=getComputedStyle(scroll),width=scroll.clientWidth;if(!Number.isFinite(width)||width<=0)return;style={width,fontFamily:cs.fontFamily,fontSize:cs.fontSize,display:cs.display};baselineOwner=instance;baselineCache=instance.itemSizeCache;baselineScroller=scroll;baselineLayout=layout;baselineWidth=width;eligible=true;observer.observe(scroll);};nativeCandidateBaseline=establish;
 const view=()=>({diagnostic:diagnostic(),hostReady:!!window.__copilotkitBenchHost,phase:owner?'selected':'preselection',reason,eligible,fontFailed,counts:{...counts},fonts:document.fonts.status,binding:adapter.bindingReceipt()});
 const onFont=event=>{if(event?.type==='loadingerror')fontFailure();if(document.fonts.status==='loading'){fontReady=false;document.fonts.ready.then(()=>{fontReady=true;},()=>fontFailure());}if(++fontEvents>4){fail('limit','l-font');return;}if(event?.type==='loadingerror')return;adapter.guard(scroller?.clientWidth??0,true);};
 document.fonts.addEventListener('loading',onFont);document.fonts.addEventListener('loadingdone',onFont);document.fonts.addEventListener('loadingerror',onFont);
 const observer=new ResizeObserver(()=>{adapter.guard(scroller?.clientWidth??0,false);});observer.observe(document.documentElement);
 async function command(name,arg){
  if(!installed&&name!=='observe')throw Error('C-closed');
  if(name==='launch'){if(launched)throw Error('C-once');launched=true;await originalLaunch();return view();}
  if(name==='observe'){if(++observations>8)throw Error('C-observation');for(let i=0;i<1;i++){if(++frameCount>16)throw Error('C-raf');await new Promise(resolve=>requestAnimationFrame(resolve));}return view();}
  if(name==='load-history'){if(loaded||!window.__copilotkitBenchHost)throw Error('C-once');loaded=true;await window.__copilotkitBenchHost.loadHistory(arg);return view();}
  if(name==='baseline'){if(base||!loaded||!owner||!scroller)throw Error('C-baseline');base=true;let timer;try{await Promise.race([document.fonts.ready,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('C-font-timeout')),10000);})]);}finally{clearTimeout(timer);}fontReady=true;if(!eligible)establish(owner,scroller);if(!eligible||baselineOwner!==owner||baselineCache!==cache||baselineScroller!==scroller||baselineLayout!==layout)throw Error('C-baseline');const cs=getComputedStyle(scroller);if(scroller.clientWidth!==style.width||cs.fontFamily!==style.fontFamily||cs.fontSize!==style.fontSize||cs.display!==style.display)adapter.guard(scroller.clientWidth,true);return {view:view(),style};}
  if(name==='snapshot'){if(base&&scroller){const cs=getComputedStyle(scroller);if(cs.fontFamily!==style.fontFamily||cs.fontSize!==style.fontSize||cs.display!==style.display)adapter.guard(scroller.clientWidth,true);else adapter.guard(scroller.clientWidth,false);}if(++frameCount>16)throw Error('C-raf');await new Promise(resolve=>requestAnimationFrame(resolve));return adapter.partial();}
  if(name==='close-admission'){if(!window.__copilotkitBenchHost)throw Error('C-host');await window.__copilotkitBenchHost.closeAdmission();return {closed:true};}
  if(name==='dispose'){if(window.__copilotkitBenchHost)await window.__copilotkitBenchHost.dispose();observer.disconnect();document.fonts.removeEventListener('loading',onFont);document.fonts.removeEventListener('loadingdone',onFont);document.fonts.removeEventListener('loadingerror',onFont);installed=false;nativeCandidateBaseline=null;adapter.dispose();return {closed:true,originalFailed,fontFailed};}
  throw Error('C-command');
 }
 Object.defineProperty(window,'__liveHistoryC',{value:Object.freeze({command}),writable:false,configurable:false});
}

// WARM_SOURCE_CAPABILITY_BEGIN
let warmSourceCapability=null;
// A source-supplied owned helper capability, never a caller readiness record.
// The default adapter/installC paths above do not instantiate or invoke it.
export function createWarmSourceIngress(runtime,baselineFactory,selectorFactory){
 if(warmSourceCapability){if(warmSourceCapability.runtime!==runtime||warmSourceCapability.baselineFactory!==baselineFactory||warmSourceCapability.selectorFactory!==selectorFactory)throw Error('warm-source-identity');return warmSourceCapability.ingress;}
 if((baselineFactory!==undefined||selectorFactory!==undefined)&&(typeof baselineFactory!=='function'||typeof selectorFactory!=='function'))throw Error('warm-source-identity');
 let target=null,pair=null,dependency=null,calculation=null,extracting=null,dependencyBusy=null,calculateDependency=null,frameRequests=0,frameCallbacks=0,sourceFault=false,rangeEntries=0,geometry=null,rangeKernel=null,rangeExtractor=null;
 let preparationStarted=false,preparationAccepted=false,failedPlan=null,typedCapabilities=null,partialBusy=false,partialTicket=null,fenceBusy=false,fenceCalls=0,anchor=null,classifierEntries=0,coreEntries=0;
 if(baselineFactory){const p=continuityNative.prototype(Float64Array.prototype);typedCapabilities={length:continuityNative.descriptor(p,'length').get,buffer:continuityNative.descriptor(p,'buffer').get,tag:continuityNative.descriptor(p,Symbol.toStringTag).get,byteLength:continuityNative.descriptor(ArrayBuffer.prototype,'byteLength').get,resizable:continuityNative.descriptor(ArrayBuffer.prototype,'resizable')?.get??null,float64Prototype:Float64Array.prototype,arrayBufferPrototype:ArrayBuffer.prototype};}
 let indexOwner=null,indexCallable=null,sealStarted=false,probe=null,scrollCallable=null,motionCalls=0;
 const controllerWindow=typeof window==='undefined'?null:window,controllerRAF=controllerWindow?.requestAnimationFrame;
 function captureScroll(instance,fn){if(instance!==indexOwner||typeof fn!=='function'||scrollCallable&&scrollCallable!==fn)sourceError('01');else scrollCallable=fn;return fn;}
 function motionOptions(){const o=ownData(owner,'options');return ownData(o,'horizontal')===false&&ownData(o,'paddingStart')===0&&ownData(o,'paddingEnd')===0&&ownData(o,'scrollPaddingStart')===0&&ownData(o,'scrollPaddingEnd')===0&&ownData(o,'scrollMargin')===0&&ownData(o,'gap')===0;}
 function moveTo(index){
  let entered=false;try{
   if(!healthy()||!preparationAccepted||motionCalls===12||!Number.isSafeInteger(index)||index<0||index>99||ownData(owner,'scrollToIndex')!==scrollCallable||!preparationOwned(counts.work)||!emptyLive(committedTarget)||!motionOptions()){sourceError('02');return false;}
   motionCalls++;entered=true;continuityNative.apply(scrollCallable,owner,[index,{align:'start',behavior:'auto'}]);return healthy();
  }catch(error){sourceError('03');if(entered)throw error;return false;}
 }
 function controllerFrame(){
  if(!healthy()){sourceError('04');throw Error('C-warm-raf-'+runtime.diagnostic());}
  if(typeof controllerRAF!=='function'){sourceError('05');throw Error('C-warm-raf-'+runtime.diagnostic());}
  if(frameRequests===32){sourceError('06');throw Error('C-warm-raf-'+runtime.diagnostic());}frameRequests++;
  return new Promise((resolve,reject)=>{try{continuityNative.apply(controllerRAF,controllerWindow,[()=>{if(!healthy()){sourceError('07');reject(Error('C-warm-raf-'+runtime.diagnostic()));return;}if(frameCallbacks>=frameRequests){sourceError('08');reject(Error('C-warm-raf-'+runtime.diagnostic()));return;}frameCallbacks++;resolve();}]);}catch(error){sourceError('09');reject(error);}});
 }
 function captureIndexes(instance,fn){if(typeof fn!=='function'||indexCallable&&(indexOwner!==instance||indexCallable!==fn))sourceError('10');else{indexOwner=instance;indexCallable=fn;}return fn;}
 function kernel(calculate,extractor){if(typeof calculate!=='function'||typeof extractor!=='function'||rangeKernel&&(rangeKernel!==calculate||rangeExtractor!==extractor)){sourceError('11');return false;}rangeKernel=calculate;rangeExtractor=extractor;return true;}
 function chosen(instance){if(!runtime.active())return false;if(reason||closed)return runtime.fail('source-fault','12');return target===instance;}
 function rangeAdmission(instance){
  if(!target||instance!==target||!healthy())return false;
  if(rangeEntries===256){sourceError('13');return false;}rangeEntries++;
  return runtime.active();
 }
 function rangeBegin(instance,outer,offset,lanes,measurements){
  if(!rangeAdmission(instance))return null;if(calculation||extracting)return runtime.fail('pair-reentrant','14');
  const token={instance,outer,offset,lanes,measurements,result:null,flat:null};calculation=token;pair=null;dependency=null;geometry=null;return token;
 }
 function calculateDepsBegin(instance){if(!rangeAdmission(instance))return null;if(calculateDependency||calculation||extracting)return runtime.fail('pair-reentrant','15');const token={instance};calculateDependency=token;return token;}
 function calculateDepsEnd(instance,token,normal,value){if(probe&&instance===target){if(!token||!normal||probe.calculate)sourceError('16');else probe.calculate=value;}if(!normal&&instance===target)sourceError('17');if(token&&calculateDependency===token){if(!normal){pair=null;dependency=null;}calculateDependency=null;}}
 function rangeInput(instance,token,value){if(token&&calculation===token&&instance===target)token.flat=value;return value;}
 function rangeCalculated(instance,token,value){
  if(token&&calculation===token&&chosen(instance)){
   // Only the pinned calculateRangeImpl result reaches this source seam.
   const start=value.startIndex,end=value.endIndex;
   if(typeof start!=='number'||typeof end!=='number'||!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<start||end>99||token.lanes!==1)runtime.fail('pair-stale','18');
   else{token.result=value;pair={instance,result:value,outer:token.outer,offset:token.offset,start,end,flat:token.flat,measurements:token.measurements};}
  }return value;
 }
 function rangeNull(instance,token){if(token&&calculation===token){pair=null;dependency=null;}}
 function rangeReturned(instance,token,value){if(token&&calculation===token&&runtime.active()&&value!==token.result)runtime.fail('pair-null','19');return value;}
 function rangeEnd(instance,token,normal){if(!normal&&instance===target)sourceError('20');if(token&&calculation===token){if(!normal){pair=null;dependency=null;}calculation=null;}}
 function depsBegin(instance){if(!rangeAdmission(instance))return null;if(dependencyBusy||extracting)return runtime.fail('pair-reentrant','21');const token={instance};dependencyBusy=token;return token;}
 function rangeDeps(instance,token,value,start,end){
  if(!token||dependencyBusy!==token||!chosen(instance))return;
  if(value===null){if(pair)runtime.fail('pair-null','22');dependency=null;return;}
  if(!pair||pair.instance!==instance||pair.result!==value||pair.start!==start||pair.end!==end){runtime.fail('pair-stale','23');dependency=null;return;}dependency=pair;
 }
 function depsEnd(instance,token,normal,value){if(probe&&instance===target){if(!token||!normal||probe.index)sourceError('24');else probe.index=value;}if(!normal&&instance===target)sourceError('25');if(token&&dependencyBusy===token){if(!normal){pair=null;dependency=null;}dependencyBusy=null;}}
 function indexBegin(instance,extractor,overscan,count,start,end,lanes,pinnedExtractor){
  if(!rangeAdmission(instance))return null;if(extracting||calculation||dependencyBusy)return runtime.fail('pair-reentrant','26');
  if(start===null&&end===null){dependency=null;return null;}
  if(count===0){pair=null;dependency=null;return null;}
  if(extractor!==pinnedExtractor){runtime.fail('pair-extractor','27');return null;}
  if(count!==100||lanes!==1||typeof overscan!=='number'||!Number.isInteger(overscan)||overscan<0||overscan>10||!pair||dependency!==pair||pair.instance!==instance||start!==pair.start||end!==pair.end){runtime.fail('pair-stale','28');return null;}
  geometry={flat:pair.flat,viewport:pair.outer,overscan};const token={instance,pair};extracting=token;return token;
 }
 function indexResult(instance,token,value){
  if(token&&extracting===token&&chosen(instance)){
   const p=token.pair,r=render||current?.renders[0];
   runtime.range([runtime.ordinal(),current?.id??0,r?.id??0,owner?1:0,cache?1:0,layout],p.outer,p.offset,p.start,p.end,value);
  }return value;
 }
 function indexEnd(instance,token,normal){if(!normal&&instance===target)sourceError('29');if(token&&extracting===token){if(!normal){pair=null;dependency=null;}extracting=null;}}
 function event(t,i,n,v,d,z,r=render||current?.renders[0],c=current){
  if(!runtime.active())return false;
  if(reason||closed)return runtime.fail('source-fault','30');
  if(!target&&t!==0&&t!==1)return false;
  return runtime.event([runtime.ordinal(),c?.id??0,r?.id??0,owner?1:0,cache?1:0,layout],t,i,n,v,d,z);
 }
 function emit(t,i,n,v,d,z,r,c){try{return event(t,i,n,v,d,z,r,c);}catch{runtime.fail('source-fault','31');return false;}}
 function coreAdmission(){if(!target||!healthy())return false;if(runtime.active())return true;if(coreEntries===512){sourceError('32');return false;}coreEntries++;return false;}
 function estimate(total,first){if(probe)sourceError('33');if(!coreAdmission())return;try{event(21,-1,0,0,total,first);}catch{runtime.fail('source-fault','34');}}
 function measureReturn(height,total,index){
  const s=scopes.at(-1);if(s?s.instance===target:!!render){const e=s?.node,matched=e&&s.index===index;emit(8,matched?index:-1,matched?e.id:0,height,total,0);}
  return height;
 }
 function coreEvent(instance,t,value,z){if(probe&&instance===target)sourceError('35');if(instance===target&&coreAdmission())emit(t,-1,0,t===18?value:0,0,z);}
 function scrollValue(instance,value){coreEvent(instance,18,value,0);return value;}
 function deltaFacts(instance,index,size,itemSize){if(!chosen(instance))return;const s=scopes.at(-1),e=s?.node;if(!s||s.instance!==instance||s.index!==index||!e){runtime.fail('source-fault','36');return;}emit(9,index,e.id,size,itemSize,0);}
 function deltaBranch(instance,index,delta,branch){if(chosen(instance)){const s=scopes.at(-1),e=s?.node;if(!s||s.instance!==instance||s.index!==index||!e)runtime.fail('source-fault','37');else emit(10,index,e.id,delta,0,branch?1:0);}return branch;}
 function sourceError(site='75'){sourceFault=true;runtime.fail('source-fault',site);}
 function healthy(){return !sourceFault&&!reason&&!originalFailed&&!closed&&runtime.healthy();}
 function preparationOwned(start){const p=committedTarget;return healthy()&&!runtime.active()&&runtime.retained()===0&&!current&&!render&&!commits.length&&!scopes.length&&!fiberFrames.length&&target===owner&&!!owner&&!!mapping&&!!p&&p.mapping===mapping&&p.commit===sealed&&p.layout===layout&&mapping.owner===owner&&mapping.cacheRef===cache&&mapping.scroller===scroller&&mapping.layout===layout&&mapping.root===selectedRoot&&eligible&&baselineOwner===owner&&baselineCache===cache&&baselineScroller===scroller&&baselineLayout===layout&&counts.work===start;}
 function sealOwned(start){const p=committedTarget;return healthy()&&runtime.active()&&!current&&!render&&!commits.length&&!scopes.length&&!fiberFrames.length&&target===owner&&!!owner&&!!mapping&&!!p&&p.mapping===mapping&&p.commit===sealed&&p.layout===layout&&mapping.owner===owner&&mapping.cacheRef===cache&&mapping.scroller===scroller&&mapping.layout===layout&&mapping.root===selectedRoot&&eligible&&baselineOwner===owner&&baselineCache===cache&&baselineScroller===scroller&&baselineLayout===layout&&counts.work===start;}
 function preparationCanonical(keys){
  const rows=mapping.rows,messages=mapping.messages,map=mapping.keys;
  if(ownData(rows,'length')!==100||ownData(messages,'length')!==100||continuityNative.apply(continuityNative.mapSize,map,[])!==100||continuityNative.prototype(map)!==continuityNative.mapPrototype||mapping.agentId!=='benchmark'||mapping.threadId!=='C-thread-1')return false;
  for(let i=0;i<100;i++){
   const row=ownData(rows,i),message=ownData(messages,i),id=ownData(message,'id');
   if(ownData(row,'type')!=='message'||ownData(row,'message')!==message||id!==(keys?keys[i]:'history-'+i)||ownData(message,'role')!==(i%2?'user':'assistant')||ownData(message,'content')!==expected[i]||continuityNative.apply(continuityNative.mapGet,map,[id])!==id)return false;
  }return true;
 }
 function unavailablePreparation(){sourceError('38');return failedPlan??=Object.freeze({status:'unavailable',reason:'invalid-input',gapStart:null,gapEnd:null,partition:null,targets:'',finalLow:null,finalHigh:null,steps:0,rangeCalls:0});}
 function prepare(){
  if(preparationStarted)return unavailablePreparation();preparationStarted=true;
  const start=counts.work;let inputs=null;
  try{
   if(!preparationOwned(start)||calculateDependency||calculation||dependencyBusy||extracting||!geometry||!typedCapabilities||typeof baselineFactory!=='function'||typeof selectorFactory!=='function'||!rangeKernel||!rangeExtractor||!emptyLive(committedTarget))return unavailablePreparation();
   {
    const builder=baselineFactory(continuityNative,typedCapabilities),built=builder.build(geometry.flat,geometry.viewport,geometry.overscan,cache,origins,bindings,layout,sealed);
    typedCapabilities=null;geometry=null;
    if(built.status!=='prepared-input')return unavailablePreparation();inputs=built.inputs;
   }
   const plan=selectorFactory({calculateRangeImpl:rangeKernel,defaultRangeExtractor:rangeExtractor}).prepare(inputs);
   const valid=preparationCanonical(inputs.keys)&&emptyLive(committedTarget)&&preparationOwned(start);inputs=null;
   if(valid){preparationAccepted=true;return plan;}return unavailablePreparation();
  }catch{return unavailablePreparation();}finally{typedCapabilities=null;geometry=null;inputs=null;}
 }
 function fenceResult(historicalComplete,liveSubsetValid,fullWarmReady,connectedRows,why){return {historicalComplete,liveSubsetValid,fullWarmReady,connectedRows,reason:why,nativeGO:false,qualified:false,fps:null};}
 function sealPreparation(){
  if(sealStarted){partialTicket=null;anchor=null;probe=null;indexCallable=null;indexOwner=null;sourceError('39');return {chronology:null,plan:unavailablePreparation()};}sealStarted=true;
  probe={calculate:null,index:null};let chronology=null,invoking=false;const refused={},start=counts.work;
  try{
   if(!sealOwned(start)||indexOwner!==target||!indexCallable||ownData(indexOwner,'getVirtualIndexes')!==indexCallable||!emptyLive(committedTarget)||calculateDependency||calculation||dependencyBusy||extracting||partialBusy||partialTicket||fenceBusy)throw refused;
   invoking=true;continuityNative.apply(indexCallable,indexOwner,[]);invoking=false;
   {const d=probe.calculate,x=probe.index,p=pair;
   if(!sealOwned(start)||!emptyLive(committedTarget)||!d||!x||!p||dependency!==p||p.instance!==target||d.length!==4||x.length!==6||p.measurements!==d[0]||p.outer!==d[1]||p.offset!==d[2]||d[3]!==1||x[0]!==rangeExtractor||x[2]!==100||x[3]!==p.start||x[4]!==p.end||x[5]!==1||typeof x[1]!=='number'||!Number.isInteger(x[1])||x[1]<0||x[1]>10||!p.flat||current||render||commits.length||scopes.length||fiberFrames.length||calculateDependency||calculation||dependencyBusy||extracting||partialBusy||partialTicket||fenceBusy)throw refused;
   geometry={flat:p.flat,viewport:p.outer,overscan:x[1]};}probe=null;indexCallable=null;indexOwner=null;
   chronology=close();return {chronology,plan:prepare()};
  }catch(error){sourceError('40');if(invoking)throw error;return {chronology,plan:unavailablePreparation()};}
  finally{partialTicket=null;anchor=null;probe=null;indexCallable=null;indexOwner=null;}
 }
 function partialFence(){try{const partial=sourceAdapter.partial();return {partial,fence:fence(partial)};}finally{partialTicket=null;}}
 function fence(partial){
  if(fenceBusy){partialTicket=null;anchor=null;sourceError('41');return fenceResult(false,false,false,0,'reentrant');}
  fenceBusy=true;const ticket=partialTicket;partialTicket=null;const start=counts.work;let next=null;
  try{
   if(partial!==ticket||!ticket||!preparationAccepted||fenceCalls===2||!preparationOwned(start)||partialBusy||calculateDependency||calculation||dependencyBusy||extracting||!emptyLive(committedTarget))throw 'warm-fence-closed';
   const second=fenceCalls++===1,prior=anchor;anchor=null;
   if(!preparationCanonical())throw 'warm-fence-shape';
   let historical=true,live=true,connectedRows=0,identical=!!prior&&prior.owner===owner&&prior.cache===cache&&prior.scroller===scroller&&prior.mapping===mapping&&prior.layout===layout;
   if(!second)next=[];
   const rows=ownData(ticket,'rows');if(ownData(rows,'length')!==100)throw 'warm-fence-shape';
   for(let i=0;i<101;i++){
    const b=bindings[i],o=origins[i];let credit=false;
    if(i<100){
     credit=!!o&&o.layout===layout&&o.eligible===true&&o.commit!==null&&o.commit<=sealed&&continuityNative.apply(continuityNative.mapGet,cache,[i])===o.size;
     if(!credit)historical=false;
     const a=o?.node??0,v=o?.size??0,c=o?.commit??0,m=o?o.measure*32769+o.edge:0,r=o?o.resize*6401+o.seq:0,k=i*5;
     if(second){if(!prior||prior.values[k]!==a||prior.values[k+1]!==v||prior.values[k+2]!==c||prior.values[k+3]!==m||prior.values[k+4]!==r)identical=false;}
     else next.push(a,v,c,m,r);
    }
    if(b){const connected=continuityNative.apply(continuityNative.nodeConnected,b.node,[]);if(typeof connected!=='boolean')throw 'warm-fence-shape';if(connected){
     connectedRows++;
     if(i===100||!credit||o.node!==b.id||b.commit===null||b.commit>o.commit||b.layout!==layout||!b.measured||!b.connected)live=false;
     else{const row=ownData(rows,i);if(ownData(row,0)!==i||ownData(row,2)!==b.id||ownData(row,3)!==o.node||ownData(row,4)!==o.size||ownData(row,7)!==layout||ownData(row,8)!==o.commit||ownData(row,9)!==o.measure||ownData(row,10)!==o.edge||ownData(row,11)!==o.resize||ownData(row,12)!==o.seq||ownData(row,14)!==true||ownData(row,15)!==true)live=false;}
    }}
   }
   if(!connectedRows)live=false;
   if(!emptyLive(committedTarget)||!preparationOwned(start))throw 'warm-fence-closed';
   if(!second){anchor={owner,cache,scroller,mapping,layout,values:next,historical,live};next=null;return fenceResult(historical,live,false,connectedRows,!historical?'historical-gap':!live?'live-binding-gap':'first-fence');}
   const ready=historical&&live&&!!prior&&prior.historical&&prior.live&&identical;
   return fenceResult(historical,live,ready,connectedRows,ready?null:!historical?'historical-gap':!live?'live-binding-gap':'fence-drift');
  }catch{anchor=null;sourceError('42');return fenceResult(false,false,false,0,'source-shape');}finally{partialTicket=null;next=null;fenceBusy=false;}
 }
 function frameRequest(instance){
  if(probe&&instance===target)sourceError('43');  if(target&&instance!==target)return false;
  if(!healthy()){sourceError('44');return false;}if(frameRequests===32){sourceError('45');return false;}frameRequests++;
  if(target&&runtime.active())emit(19,-1,0,0,0,0);return true;
 }
 function frameEnter(instance){
  if(probe&&instance===target)sourceError('46');  if(target&&instance!==target)return false;
  if(!healthy()){sourceError('47');return false;}if(frameCallbacks>=frameRequests){sourceError('48');return false;}frameCallbacks++;
  if(target&&runtime.active())emit(20,-1,0,0,0,0);return true;
 }
 function frameEnd(instance,normal){if(!normal&&instance===target)sourceError('49');}
 function runFrameRequest(instance,call){try{return call();}catch(error){if(target===instance)sourceError('50');throw error;}}
 const sourceAdapter=Object.freeze({...adapter,
 renderStart(work,Component,root,rootWork){if(probe)sourceError('51');const r=adapter.renderStart(work,Component,root,rootWork);if(r)emit(0,-1,0,0,0,0,r,current);else if(reason)runtime.fail('source-fault','52');return r;},
 renderEnd(r,normal){if(r)emit(1,-1,0,0,0,normal?1:0,r,current);return adapter.renderEnd(r,normal);},
 commitStart(root,work){if(probe)sourceError('53');if(calculateDependency||calculation||dependencyBusy||extracting||partialBusy||partialTicket||fenceBusy){partialTicket=null;sourceError('54');}const c=adapter.commitStart(root,work);if(c)emit(2,-1,0,0,0,c.previousCommit?.id??0,render,c);else if(reason)runtime.fail('source-fault','55');return c;},
 fiberStart(root,currentFiber,finished){if(!sourceFault&&runtime.healthy()){if(classifierEntries===30880)sourceError('56');else classifierEntries++;}return adapter.fiberStart(root,currentFiber,finished);},
 commitMutationEnd(c,normal){if(c)emit(3,-1,0,0,0,normal?1:0,render||c.renders[0],c);return adapter.commitMutationEnd(c,normal);},
 commitLayoutEnd(root,work,normal){const c=current;const value=adapter.commitLayoutEnd(root,work,normal);if(c)emit(4,-1,0,0,0,normal?1:0,render||c.renders[0],c);return value;},
 commitSpawnedEnd(root,work,normal){const c=current;const value=adapter.commitSpawnedEnd(root,work,normal);if(c)emit(5,-1,0,0,0,normal?1:0,render||c.renders[0],c);return value;},
 begin(instance,kind,refArg){if(probe&&instance===target)sourceError('57');const s=adapter.begin(instance,kind,refArg);if(s&&chosen(instance)){if(kind===1)emit(6,-1,0,0,0,1);else if(kind===3)emit(11,-1,0,0,0,0);}else if(reason)runtime.fail('source-fault','58');return s;},
 end(instance,s,normal){if(s&&chosen(instance)){if(s.kind===1)emit(7,-1,0,0,0,normal?1:0);else if(s.kind===3)emit(13,-1,0,0,0,normal?1:0);}return adapter.end(instance,s,normal);},
 beginCleanup(instance,node){if(probe&&instance===target)sourceError('59');const s=adapter.beginCleanup(instance,node);if(s&&chosen(instance))emit(16,-1,0,0,0,0);else if(reason)runtime.fail('source-fault','60');return s;},
 endCleanup(instance,s,normal){if(s&&chosen(instance))emit(17,-1,0,0,0,normal?1:0);return adapter.endCleanup(instance,s,normal);},
 bind(instance,s,node,index){const value=adapter.bind(instance,s,node,index);if(s?.kind===2&&chosen(instance)){const e=s.node;emit(12,e?index:-1,e?.id??0,0,0,0);}return value;},
 partial(){if(probe)sourceError('61');const busy=partialBusy;partialTicket=null;if(busy||fenceBusy)sourceError('62');partialBusy=true;const start=counts.work;try{const value=adapter.partial();if(healthy()&&counts.work===start+270336)partialTicket=value;else sourceError('63');return value;}catch(error){sourceError('64');throw error;}finally{partialBusy=busy;}},
 dispose(){partialTicket=null;anchor=null;geometry=null;typedCapabilities=null;pair=null;dependency=null;return adapter.dispose();},
 options(instance,merged,key){
  if(probe)sourceError('65');const value=adapter.options(instance,merged,key);
  if(runtime.active()){
   if(reason)runtime.fail('source-fault','66');
   else if(render?.optionsOwner===instance&&render.optionsOK){if(target&&target!==instance)runtime.fail('pair-owner','67');else target=instance;}
  }
  return value;
 }});
 function close(){if(calculateDependency||calculation||dependencyBusy||extracting)sourceError('68');if(sourceFault||reason||originalFailed||closed)runtime.fail('source-fault','69');pair=null;dependency=null;return runtime.close();}
 const ingress=Object.freeze({adapter:sourceAdapter,kernel,captureIndexes,captureScroll,moveTo,controllerFrame,abort:sourceError,sealPreparation,prepare,fence,partialFence,estimate,measureReturn,coreEvent,scrollValue,deltaFacts,deltaBranch,frameRequest,frameEnter,frameEnd,runFrameRequest,healthy,calculateDepsBegin,calculateDepsEnd,rangeBegin,rangeInput,rangeCalculated,rangeNull,rangeReturned,rangeEnd,depsBegin,depsEnd,rangeDeps,indexBegin,indexResult,indexEnd,close});
 warmSourceCapability={runtime,baselineFactory,selectorFactory,ingress};return ingress;
}
// WARM_SOURCE_CAPABILITY_END
