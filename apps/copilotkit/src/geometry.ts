import type { CaseContext } from './context.js';
import type { GeometryPhase, GeometryRect, GeometryEvaluation, MountedGeometryInput } from './geometry-policy.js';
import { GEOMETRY_LIMITS as L, evaluateMountedGeometry, evaluateSelectedGeometryRow, projectGeometryText, type GeometryClip, type GeometryObservation } from './geometry-policy.ts';
import type { VisibleMessage } from '../../../packages/contract/src/comparison.js';
export const GEOMETRY_NODE_VISITS = 4096;
export type GeometryNode = object;
export interface GeometryBox { rect: GeometryRect; clientLeft: number; clientTop: number; clientWidth: number; clientHeight: number; scrollTop: number; scrollHeight: number }
export interface GeometryStyle { overflowX: string; overflowY: string; display: string; visibility: string; opacity: string; transform: string; clipPath: string; maskImage: string; contentVisibility: string; zoom:string; scale:string; rotate:string; translate:string; clip:string }
export interface GeometryPorts {
  find(selector: string): ArrayLike<GeometryNode>;
  firstChild(node: GeometryNode): GeometryNode | null;
  nextSibling(node: GeometryNode): GeometryNode | null;
  parent(node: GeometryNode): GeometryNode | null;
  text(node: GeometryNode): string | null;
  connected(node: GeometryNode): boolean;
  contains(parent: GeometryNode, child: GeometryNode): boolean;
  box(node: GeometryNode): GeometryBox;
  style(node: GeometryNode): GeometryStyle;
  textRects(node: GeometryNode): ArrayLike<GeometryRect>;
  now(): number;
  viewport(): GeometryRect;
}
export type GeometryFailure = 'disposed' | 'dom-unavailable' | 'selector' | 'work-cap' | 'geometry-cap' | 'unsupported-style' | 'heterogeneous-clips' | 'policy' | 'identity' | 'policy-unavailable-viewport' | 'policy-empty-text' | 'policy-text-mismatch' | 'policy-no-positive-text-rects' | 'policy-host-bounds' | 'policy-scroll-scalars';
export type GeometrySnapshot = Readonly<{status:'available';frame:MountedGeometryInput;evaluation:GeometryEvaluation;visibleMessages:readonly VisibleMessage[];scroll:Readonly<{scrollTop:number;scrollHeight:number;clientHeight:number}>}> | Readonly<{status:'unavailable'|'invalid';reason:GeometryFailure}>;
export type GeometryContext = Pick<CaseContext,'history'|'response'|'ids'>;
export interface GeometryLocators { scroller:string; messageHost(id:string):string; messageContent(id:string):string }
export type AnchorPurpose='tracker-a-G1-anchor-diagnostic-v1';
export type AnchorIdentity=Readonly<{sameHostObject:boolean|null;sameOwner:boolean|null;sameScroller:boolean|null;sameScope:boolean|null;sameUrl:boolean|null;connected:boolean|null;uniqueSelectors:boolean|null;contained:boolean|null;parentMatched:boolean|null}>;
export type AnchorReason='admission'|'selection'|'owner'|'host'|'scroller'|'scope'|'url'|'disconnected'|'selector'|'text'|'style'|'clip'|'work'|'rect'|'geometry'|'no-positive'|'fully-clipped'|'source-error';
export interface AnchorProbe {status:'available'|'unavailable';reason:AnchorReason|null;identity:AnchorIdentity;ownerToken:number|null;contentTopCssPx:number|null;relativeTopCssPx:number|null;nativeViewportY:number|null;textRectCount:number;eligible:boolean|null;scrollTopAfterProbe:number|null;nodesVisited:number;rectangleUnits:number;textChars:number}
export interface GeometryCollector { read(phase:GeometryPhase,progress:Readonly<{active:boolean;prefix:string}>,purpose?:AnchorPurpose):GeometrySnapshot;probeAnchor(selection:Readonly<{id:string;ownerToken:number}>):AnchorProbe;releaseAnchor(reason:'host'|'url'):void;dispose():void }
export type HistoryContentStatus='ready'|'pending'|'unavailable'|'invalid';
export type HistoryContentReason='content-ready'|'empty-text'|'no-mounted-history'|'selector'|'ownership'|'unknown-id'|'text-mismatch'|'node-cap'|'text-cap'|'identity-cap'|'invalid-data'|'public-history'|'public-active'|'source-error'|'admission-closed';
export interface RestoredHistoryContentScalar {readonly status:HistoryContentStatus;readonly reason:HistoryContentReason;readonly mountedRows:number;readonly emptyRows:number;readonly firstRowId:string|null;readonly firstRowRole:'assistant'|'user'|null}
export type HistoryReadinessOutcome='ready'|'unavailable'|'invalid';
export type HistoryReadinessReason=HistoryContentReason|'attempt-limit'|'deadline'|'observation-rejected'|'scalar-contract';
export interface HistoryReadinessContext {readonly caseNumber:1|2;readonly journey:'follow'|'history-reading';readonly threadId:string;readonly history:readonly Readonly<{id:string;role:'assistant'|'user'}>[]}
export interface RestoredHistoryReadinessDiagnostic {readonly kind:'copilot-mounted-history-readiness-v1';readonly caseNumber:1|2;readonly journey:'follow'|'history-reading';readonly threadId:string;readonly attemptCount:number;readonly outcome:HistoryReadinessOutcome;readonly reason:HistoryReadinessReason;readonly first:RestoredHistoryContentScalar|null;readonly last:RestoredHistoryContentScalar|null;readonly qualification:false}
export interface RestoredHistoryDiagnosticPort {emitReadinessSummary(record:RestoredHistoryReadinessDiagnostic):Promise<void>}
const historyInvalidReasons=['selector','ownership','unknown-id','text-mismatch','invalid-data','public-history'] as const;
const historyUnavailableReasons=['node-cap','text-cap','identity-cap','public-active','source-error','admission-closed'] as const;
const historyId=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=L.identityLength&&/^[\x20-\x7e]+$/.test(v);
function historyData(value:unknown,keys:readonly string[]):Record<string,unknown>{
 if(typeof value!=='object'||value===null||Array.isArray(value)||(Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null))throw Error('Invalid readiness data');
 const names=Reflect.ownKeys(value);if(names.length!==keys.length||names.some(k=>typeof k!=='string'||!keys.includes(k)))throw Error('Invalid readiness keys');
 const result:Record<string,unknown>={};for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!('value'in d))throw Error('Readiness data property required');result[key]=d.value;}return result;
}
/** Copy the fixed scalar; no caller flags or foreign error properties are read. */
export function copyHistoryContentScalar(value:unknown,history:HistoryReadinessContext['history']):RestoredHistoryContentScalar {
 const r=historyData(value,['status','reason','mountedRows','emptyRows','firstRowId','firstRowRole']);
 if(!Number.isSafeInteger(r.mountedRows)||!Number.isSafeInteger(r.emptyRows)||typeof r.mountedRows!=='number'||typeof r.emptyRows!=='number'||r.mountedRows<0||r.mountedRows>100||r.emptyRows<0||r.emptyRows>r.mountedRows)throw Error('Invalid readiness counts');
 if(r.firstRowId===null?r.firstRowRole!==null:!historyId(r.firstRowId)||!history.some(m=>m.id===r.firstRowId&&m.role===r.firstRowRole))throw Error('Unknown readiness identity');
 const matched=r.status==='ready'?r.reason==='content-ready'&&r.emptyRows===0&&r.mountedRows>0&&r.firstRowId===null:
 r.status==='pending'?r.reason==='empty-text'?r.emptyRows>0&&r.firstRowId!==null:r.reason==='no-mounted-history'&&r.mountedRows===0&&r.emptyRows===0&&r.firstRowId===null:
 r.status==='invalid'?historyInvalidReasons.some(v=>v===r.reason):r.status==='unavailable'&&historyUnavailableReasons.some(v=>v===r.reason);
 if(!matched)throw Error('Invalid readiness status');return Object.freeze(r) as unknown as RestoredHistoryContentScalar;
}
export function copyHistoryReadinessDiagnostic(value:unknown,context:HistoryReadinessContext):RestoredHistoryReadinessDiagnostic {
 const r=historyData(value,['kind','caseNumber','journey','threadId','attemptCount','outcome','reason','first','last','qualification']);
 if(r.kind!=='copilot-mounted-history-readiness-v1'||r.caseNumber!==context.caseNumber||r.journey!==context.journey||r.threadId!==context.threadId||!historyId(r.threadId)||r.qualification!==false||typeof r.attemptCount!=='number'||!Number.isSafeInteger(r.attemptCount)||r.attemptCount<1||r.attemptCount>120)throw Error('Invalid readiness diagnostic');
 if((r.first===null)!==(r.last===null))throw Error('Missing readiness observation');
 const first=r.first===null?null:copyHistoryContentScalar(r.first,context.history),last=r.last===null?null:copyHistoryContentScalar(r.last,context.history);
 if(r.attemptCount>1&&first!==null&&first.status!=='pending')throw Error('Readiness stopped at first observation');
 if(r.attemptCount===1&&['observation-rejected','scalar-contract'].some(v=>v===r.reason)&&(first!==null||last!==null))throw Error('Failed first observation cannot retain a scalar');
 if(r.attemptCount===120&&last?.status==='pending'&&!['attempt-limit','observation-rejected','scalar-contract'].some(v=>v===r.reason))throw Error('No operation follows final pending observation');
 if(first===null&&(r.attemptCount!==1||!['observation-rejected','scalar-contract'].some(v=>v===r.reason)))throw Error('Impossible absent readiness observation');
 if(first&&last&&r.attemptCount===1&&Object.keys(first).some(k=>first[k as keyof RestoredHistoryContentScalar]!==last[k as keyof RestoredHistoryContentScalar]))throw Error('One original readiness observation differs');
 if(r.reason==='attempt-limit'&&(r.attemptCount!==120||last?.status!=='pending'))throw Error('Impossible readiness attempt limit');
 if(last?.status==='ready'&&r.outcome!=='ready')throw Error('Ready readiness outcome differs');
 if(last&&(last.status==='invalid'||last.status==='unavailable')&&(r.outcome!==last.status||r.reason!==last.reason))throw Error('Terminal readiness outcome differs');
 const matched=r.outcome==='ready'?r.reason==='content-ready'&&last?.status==='ready':r.outcome==='invalid'?historyInvalidReasons.some(v=>v===r.reason)||r.reason==='scalar-contract':r.outcome==='unavailable'&&(historyUnavailableReasons.some(v=>v===r.reason)||['attempt-limit','deadline','observation-rejected'].some(v=>v===r.reason));
 if(!matched)throw Error('Invalid readiness outcome');return Object.freeze({...r,first,last}) as unknown as RestoredHistoryReadinessDiagnostic;
}
/** Content only. Uses original selectors/text nodes; never boxes/styles/ranges. */
export function readRestoredHistoryContent(context:GeometryContext,locators:GeometryLocators,p:GeometryPorts):RestoredHistoryContentScalar {
 let mountedRows=0,emptyRows=0,firstRowId:string|null=null,firstRowRole:'assistant'|'user'|null=null;
 let current:Readonly<{id:string;role:'assistant'|'user'}>|null=null;
 const result=(status:HistoryContentStatus,reason:HistoryContentReason):RestoredHistoryContentScalar=>{
  if((status==='invalid'||status==='unavailable')&&firstRowId===null&&current){firstRowId=current.id;firstRowRole=current.role;}
  return {status,reason,mountedRows,emptyRows,firstRowId,firstRowRole};
 };
 try{
  if(context.history.length!==L.history||context.history.some(m=>!historyId(m.id)||(m.role!=='assistant'&&m.role!=='user')||typeof m.content!=='string'||m.content.length>L.historyText||!/^[\x20-\x7e]*$/.test(m.content))||new Set(context.history.map(m=>m.id)).size!==L.history)return result('invalid','invalid-data');
  const matches=p.find(locators.scroller);if(matches.length!==1||!p.connected(matches[0]!))return result('invalid','selector');const scroller=matches[0]!,seen=new Set<GeometryNode>();let visits=0,totalText=0;
  const visit=()=>++visits<=GEOMETRY_NODE_VISITS;
  for(const known of context.history){
   current=known;
   const hosts=p.find(locators.messageHost(known.id)),found=p.find(locators.messageContent(known.id));
   if(hosts.length===0&&found.length===0)continue;
   if(hosts.length!==1||found.length!==1)return result('invalid','selector');
   const content=found[0]!,host=hosts[0]!;
   if(seen.has(content))return result('invalid','ownership');seen.add(content);
   if(p.parent(content)!==host||!p.connected(host)||!p.connected(content)||!p.contains(scroller,content)||host===scroller||content===scroller)return result('invalid','ownership');
   mountedRows++;let text='',n:GeometryNode|null=content;
   while(n){
    if(!visit())return result('unavailable','node-cap');const part=p.text(n);
    if(part!==null){if(typeof part!=='string')return result('invalid','invalid-data');if(part.length>L.observedTextPerRow-text.length||part.length>L.observedText-totalText)return result('unavailable','text-cap');if(!/^[\x09-\x0d\x20-\x7e]*$/.test(part))return result('invalid','invalid-data');text+=part;totalText+=part.length;}
    const child=p.firstChild(n);if(child){if(p.parent(child)!==n)return result('invalid','ownership');n=child;continue;}
    while(n!==content&&!p.nextSibling(n)){if(!visit())return result('unavailable','node-cap');n=p.parent(n);if(!n)return result('invalid','ownership');}
    n=n===content?null:p.nextSibling(n);
   }
   const projected=projectGeometryText(text);
   if(projected===''){emptyRows++;if(firstRowId===null){firstRowId=known.id;firstRowRole=known.role;}}
   else if(projected!==projectGeometryText(known.content)){firstRowId=known.id;firstRowRole=known.role;return result('invalid','text-mismatch');}
  }
  return emptyRows?result('pending','empty-text'):mountedRows?result('ready','content-ready'):result('pending','no-mounted-history');
 }catch{return result('unavailable','source-error');}
}
class CollectionFailure extends Error { readonly reason:GeometryFailure;constructor(reason:GeometryFailure){super(reason);this.reason=reason;} }
function deny(reason:GeometryFailure):never { throw new CollectionFailure(reason); }
const copyRect=(r:GeometryRect):GeometryRect=>({x:r.x,y:r.y,width:r.width,height:r.height});
function clientBox(b:GeometryBox):GeometryRect {return {x:b.rect.x+b.clientLeft,y:b.rect.y+b.clientTop,width:b.clientWidth,height:b.clientHeight};}
/** Computed 2D translation only. BCR already includes this displacement; do not
 * transform its coordinates again. Bounded lexemes precede numeric conversion. */
function translationOnly(value:string):boolean {
  if(value==='none')return true;
  if(typeof value!=='string'||value.length>256||!value.startsWith('matrix(')||!value.endsWith(')'))return false;
  const lexemes=value.slice(7,-1).split(',');if(lexemes.length!==6)return false;
  const numbers:number[]=[];
  for(const part of lexemes){const s=part.trim();if(s.length>32||!s.length||!/^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/.test(s))return false;const n=Number(s);if(!Number.isFinite(n))return false;numbers.push(n);}
  return numbers[0]===1&&numbers[1]===0&&numbers[2]===0&&numbers[3]===1&&Math.abs(numbers[4]!)<=L.coordinate&&Math.abs(numbers[5]!)<=L.coordinate;
}
type RowBudget={text:number;clips:number;rects:number};
function collectRow(p:GeometryPorts,content:GeometryNode,visit:()=>void,budget:RowBudget){
let observedText='',common:GeometryNode[]|undefined,clips:GeometryClip[]=[];
const textRects:GeometryRect[]=[];
// Walk siblings incrementally: no descendant array or recursive JS stack.
let n:GeometryNode|null=content;
while(n){
  visit();const text=p.text(n);
  if(text!==null){
    if(text.length>L.observedTextPerRow-observedText.length||text.length>L.observedText-budget.text)deny('geometry-cap');
    observedText+=text;budget.text+=text.length;
    const chain:GeometryNode[]=[],nodeClips:GeometryClip[]=[];
    let ancestor=p.parent(n);
    while(ancestor){
      visit();const s=p.style(ancestor);
      // Only none/pure 2D translation preserves this client-box math.
      if(s.display==='none'||s.visibility!=='visible'||s.opacity!=='1'||!translationOnly(s.transform)||s.clipPath!=='none'||s.maskImage!=='none'||s.contentVisibility!=='visible'||
        (s.zoom!=='1'&&s.zoom!=='normal')||s.scale!=='none'||s.rotate!=='none'||s.translate!=='none'||s.clip!=='auto')deny('unsupported-style');
      const clipX=['hidden','clip','scroll','auto'].includes(s.overflowX),clipY=['hidden','clip','scroll','auto'].includes(s.overflowY);
      if(clipX||clipY){
        if(nodeClips.length===L.ancestorClipsPerRow)deny('geometry-cap');
        chain.push(ancestor);nodeClips.push({rect:clientBox(p.box(ancestor)),clipX,clipY});
      }
      ancestor=p.parent(ancestor);
    }
    if(common&&(common.length!==chain.length||common.some((a,i)=>a!==chain[i])))deny('heterogeneous-clips');
    if(!common){common=chain;clips=nodeClips;budget.clips+=clips.length;if(budget.clips>L.ancestorClips)deny('geometry-cap');}
    const rects=p.textRects(n);
    if(rects.length>L.textRectsPerRow-textRects.length||rects.length>L.textRects-budget.rects)deny('geometry-cap');
    budget.rects+=rects.length;
    for(let i=0;i<rects.length;i++)textRects.push(copyRect(rects[i]!));
    if(budget.rects+budget.clips+2>L.rectangles)deny('geometry-cap');
  }
  const child=p.firstChild(n);
  if(child){n=child;continue;}
  while(n!==content&&!p.nextSibling(n)){visit();n=p.parent(n);if(!n)deny('selector');}
  n=n===content?null:p.nextSibling(n);
}
 return {observedText,textRects,ancestorClips:clips};
}
/** Explicit unscored H100 observation only. Never call from scored readProgress. */
export function createGeometryCollector(context:GeometryContext,locators:GeometryLocators,ports:GeometryPorts):GeometryCollector {
  let ownedPorts:GeometryPorts|null=ports;
  let owners=new WeakMap<GeometryNode,{id:string;role:string;token:number}>(),token=0;
  const expectedHistory=context.history.map(m=>({id:m.id,role:m.role,text:m.content}));
  const expectedResponse={id:context.response.id,role:context.response.role,text:context.response.content};
  const scopeId=context.ids.threadId;
  type Lease={content:GeometryNode;host:GeometryNode;scroller:GeometryNode;known:typeof expectedHistory[number];ownerToken:number};
  let lease:Lease|null=null,terminal:AnchorReason|null=null;
  return {
    releaseAnchor(reason){lease=null;terminal=reason;},
    dispose(){ownedPorts=null;owners=new WeakMap();lease=null;terminal='admission';},
    probeAnchor(selection){
      const identity:Record<keyof AnchorIdentity,boolean|null>={sameHostObject:null,sameOwner:null,sameScroller:null,sameScope:null,sameUrl:null,connected:null,uniqueSelectors:null,contained:null,parentMatched:null};
      let nodesVisited=0,geometryAccesses=0,viewportUnits=0,eligible:boolean|null=null;const budget:RowBudget={text:0,clips:0,rects:0};
      const no=(reason:AnchorReason):AnchorProbe=>({status:'unavailable',reason,identity,ownerToken:null,contentTopCssPx:null,relativeTopCssPx:null,nativeViewportY:null,textRectCount:budget.rects,eligible:eligible===false?false:null,scrollTopAfterProbe:null,nodesVisited,rectangleUnits:budget.rects+budget.clips+viewportUnits,textChars:budget.text});
      const stop=(reason:AnchorReason)=>{terminal=reason;lease=null;return no(reason);};
      const p=ownedPorts,l=lease;if(!p)return no('admission');if(terminal)return no(terminal);if(!l)return no('selection');
      try{
        let selected:Record<string,unknown>;try{selected=historyData(selection,['id','ownerToken']);}catch{return stop('selection');}if(selected.id!==l.known.id||selected.ownerToken!==l.ownerToken)return stop('selection');
        identity.sameScope=context.ids.threadId===scopeId;if(!identity.sameScope)return stop('scope');
        const scrollers=p.find(locators.scroller);identity.sameScroller=scrollers.length===1&&scrollers[0]===l.scroller;if(!identity.sameScroller)return stop('scroller');
        const hosts=p.find(locators.messageHost(l.known.id)),contents=p.find(locators.messageContent(l.known.id));
        identity.uniqueSelectors=hosts.length===1&&contents.length===1;if(!identity.uniqueSelectors)return stop('selector');
        identity.sameHostObject=hosts[0]===l.host;if(!identity.sameHostObject)return stop('host');
        const owner=owners.get(l.content);identity.sameOwner=contents[0]===l.content&&owner?.id===l.known.id&&owner.role===l.known.role&&owner.token===l.ownerToken;if(!identity.sameOwner)return stop('owner');
        identity.connected=p.connected(l.content)&&p.connected(l.host)&&p.connected(l.scroller);if(!identity.connected)return stop('disconnected');
        identity.contained=p.contains(l.scroller,l.content);if(!identity.contained)return stop('owner');
        identity.parentMatched=p.parent(l.content)===l.host;if(!identity.parentMatched)return stop('owner');
        const geometryRead=()=>{if(geometryAccesses===8194)deny('geometry-cap');geometryAccesses++;};
        const q:GeometryPorts={...p,box:n=>{geometryRead();return p.box(n);},style:n=>{geometryRead();return p.style(n);},textRects:n=>{geometryRead();return p.textRects(n);},viewport:()=>{geometryRead();return p.viewport();}};
        const sb=q.box(l.scroller);viewportUnits++;const native=q.viewport();viewportUnits++;
        const hostBounds=q.box(l.host).rect;
        if(![hostBounds.x,hostBounds.y,hostBounds.width,hostBounds.height].every(Number.isFinite)||Math.abs(hostBounds.x)>L.coordinate||Math.abs(hostBounds.y)>L.coordinate||hostBounds.width<=0||hostBounds.height<=0||hostBounds.width>L.coordinate||hostBounds.height>L.coordinate||!Number.isFinite(hostBounds.x+hostBounds.width)||!Number.isFinite(hostBounds.y+hostBounds.height))return no('geometry');
        const measured=collectRow(q,l.content,()=>{if(nodesVisited===GEOMETRY_NODE_VISITS)deny('work-cap');nodesVisited++;},budget);
        const row=evaluateSelectedGeometryRow({id:l.known.id,role:l.known.role,presence:'mounted',ownerToken:l.ownerToken,...measured},l.known,clientBox(sb),native);
        eligible=row.geometryEligibility==='eligible';if(!eligible)return no(row.reason==='fully-clipped'?'fully-clipped':row.reason==='no-positive-text-rects'?'no-positive':'text');
        const scrollTop=q.box(l.scroller).scrollTop;if(!Number.isFinite(scrollTop)||scrollTop<0||scrollTop>L.coordinate)return no('geometry');
        return {status:'available',reason:null,identity,ownerToken:l.ownerToken,contentTopCssPx:row.contentTopCssPx,relativeTopCssPx:row.relativeTopCssPx,nativeViewportY:native.y,textRectCount:budget.rects,eligible:true,scrollTopAfterProbe:scrollTop,nodesVisited,rectangleUnits:budget.rects+budget.clips+viewportUnits,textChars:budget.text};
      }catch(error){return no(error instanceof CollectionFailure?error.reason==='work-cap'?'work':error.reason==='unsupported-style'?'style':error.reason==='heterogeneous-clips'?'clip':'geometry':'source-error');}
    },
    read(phase,progress,purpose){
      const p=ownedPorts;if(!p)return {status:'unavailable',reason:'disposed'};
      try {
        let visits=0;const budget:RowBudget={text:0,clips:0,rects:0};
        const visit=()=>{if(++visits>GEOMETRY_NODE_VISITS)deny('work-cap');};
        const matches=p.find(locators.scroller);
        if(matches.length!==1)deny('selector');
        const scroller=matches[0]!;
        if(!p.connected(scroller))deny('selector');
        const sb=p.box(scroller),bounds=new Map<string,GeometryRect>(),seen=new Set<GeometryNode>();
        const rows:GeometryObservation[]=[],retained=new Map<string,{content:GeometryNode;host:GeometryNode}>();
        for(const known of phase==='restored-history'?expectedHistory:[...expectedHistory,expectedResponse]){
          // Role-independent identity query prevents wrong-role/duplicate hosts
          // from masquerading as legitimately virtualized, unmounted content.
          const hosts=p.find(locators.messageHost(known.id));
          const found=p.find(locators.messageContent(known.id));
          if(hosts.length>1||found.length>1)deny('selector');
          const content=found[0];
          if(hosts.length===0&&found.length===0){rows.push({id:known.id,role:known.role,presence:'unmounted',ownerToken:null,observedText:'',textRects:[],ancestorClips:[]});continue;}
          if(!content||hosts.length!==1)deny('selector');
          if(seen.has(content))deny('identity');seen.add(content);
          const host=p.parent(content);
          if(!host||host!==hosts[0]||!p.connected(content)||!p.contains(scroller,content)||content===scroller||host===scroller)deny('selector');
          let owner=owners.get(content);
          if(!owner||owner.id!==known.id||owner.role!==known.role){if(token===L.ownerToken)deny('geometry-cap');owner={id:known.id,role:known.role,token:++token};owners.set(content,owner);}
          bounds.set(known.id,copyRect(p.box(host).rect));
          if(purpose==='tracker-a-G1-anchor-diagnostic-v1')retained.set(known.id,{content,host});
          const {observedText,textRects,ancestorClips}=collectRow(p,content,visit,budget);
          rows.push({id:known.id,role:known.role,presence:'mounted',ownerToken:owner.token,observedText,textRects,ancestorClips});
        }
        const frame:MountedGeometryInput={schemaVersion:1,scopeId,clockDomain:'page-performance-ms',observedAtPageMs:p.now(),phase,
          expectedHistory:expectedHistory.map(m=>({...m})),expectedResponse:{...expectedResponse},responseProgress:{...progress},
          viewport:clientBox(sb),nativeViewport:copyRect(p.viewport()),rows};
        const evaluation=evaluateMountedGeometry(frame);
        if(evaluation.status!=='evaluated')return {status:evaluation.status==='invalid'?'invalid':'unavailable',reason:evaluation.status==='invalid'?'policy':'policy-unavailable-viewport'};
        const visibleMessages:VisibleMessage[]=[];
        for(let i=0;i<evaluation.rows.length;i++){
          const r=evaluation.rows[i]!;
          if(r.presence==='unmounted'||(r.presence==='mounted'&&r.reason==='fully-clipped'))continue;
          if(r.geometryEligibility!=='eligible')return {status:'unavailable',reason:r.reason==='empty-text'?'policy-empty-text':r.reason==='text-mismatch'?'policy-text-mismatch':r.reason==='no-positive-text-rects'?'policy-no-positive-text-rects':'policy'};
          const b=bounds.get(r.id)!;
          if(![b.x,b.y,b.width,b.height].every(Number.isFinite)||Math.abs(b.x)>L.coordinate||Math.abs(b.y)>L.coordinate||
            b.width<=0||b.height<=0||b.width>L.coordinate||b.height>L.coordinate||!Number.isFinite(b.x+b.width)||!Number.isFinite(b.y+b.height))deny('policy-host-bounds');
          visibleMessages.push({id:r.id,text:rows[i]!.observedText,topCssPx:b.y,bottomCssPx:b.y+b.height});
        }
        // Stable sort retains canonical ordering for ties.
        visibleMessages.sort((a,b)=>a.topCssPx-b.topCssPx);
        if(!Number.isFinite(sb.scrollTop)||!Number.isFinite(sb.scrollHeight)||sb.scrollHeight<0||!Number.isFinite(sb.clientHeight)||sb.clientHeight<0)deny('policy-scroll-scalars');
        if(purpose==='tracker-a-G1-anchor-diagnostic-v1'&&!terminal&&!lease&&phase==='streaming'){
          const selected=evaluation.rows.find(r=>r.id!==expectedResponse.id&&r.geometryEligibility==='eligible');
          if(selected){const objects=retained.get(selected.id),known=expectedHistory.find(m=>m.id===selected.id);if(objects&&known&&selected.ownerToken!==null)lease={...objects,scroller,known,ownerToken:selected.ownerToken};}
        }
        return {status:'available',frame,evaluation,visibleMessages,scroll:{scrollTop:sb.scrollTop,scrollHeight:sb.scrollHeight,clientHeight:sb.clientHeight}};
      }catch(error){return {status:'unavailable',reason:error instanceof CollectionFailure?error.reason:'dom-unavailable'};}
    }
  };
}
/** No DOM reads occur at construction. Browser collection APIs can materialize
 * native lists before retention checks; these are not native allocation caps. */
export function createNativeGeometryPorts(document:Document,view:Window):GeometryPorts {
  const asNode=(n:GeometryNode)=>n as Node,asElement=(n:GeometryNode)=>n as Element;
  return {
    find:selector=>document.querySelectorAll(selector),
    firstChild:n=>asNode(n).firstChild,nextSibling:n=>asNode(n).nextSibling,parent:n=>asNode(n).parentElement,
    text:n=>asNode(n).nodeType===3?asNode(n).nodeValue:null,
    connected:n=>asNode(n).isConnected,contains:(a,b)=>asNode(a).contains(asNode(b)),
    box(n){const e=asElement(n),r=e.getBoundingClientRect();return {rect:copyRect({x:r.x,y:r.y,width:r.width,height:r.height}),clientLeft:e.clientLeft,clientTop:e.clientTop,clientWidth:e.clientWidth,clientHeight:e.clientHeight,scrollTop:e.scrollTop,scrollHeight:e.scrollHeight};},
    style:n=>view.getComputedStyle(asElement(n)),
    textRects(n){const range=document.createRange();try{range.selectNodeContents(asNode(n));return range.getClientRects();}finally{range.detach();}},
    now:()=>view.performance.now(),viewport:()=>{
      const v=view.visualViewport;
      if(v&&(v.scale!==1||v.offsetLeft!==0||v.offsetTop!==0||v.width!==view.innerWidth||v.height!==view.innerHeight))deny('unsupported-style');
      return {x:0,y:0,width:view.innerWidth,height:view.innerHeight};
    }
  };
}
