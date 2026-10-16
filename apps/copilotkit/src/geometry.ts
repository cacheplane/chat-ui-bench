import type { CaseContext } from './context.js';
import type { GeometryPhase, GeometryRect, GeometryEvaluation, MountedGeometryInput } from './geometry-policy.js';
import { GEOMETRY_LIMITS as L, evaluateMountedGeometry, type GeometryClip, type GeometryObservation } from './geometry-policy.js';
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
export type GeometryFailure = 'disposed' | 'dom-unavailable' | 'selector' | 'work-cap' | 'geometry-cap' | 'unsupported-style' | 'heterogeneous-clips' | 'policy' | 'identity';
export type GeometrySnapshot = Readonly<{status:'available';frame:MountedGeometryInput;evaluation:GeometryEvaluation;visibleMessages:readonly VisibleMessage[];scroll:Readonly<{scrollTop:number;scrollHeight:number;clientHeight:number}>}> | Readonly<{status:'unavailable'|'invalid';reason:GeometryFailure}>;
export type GeometryContext = Pick<CaseContext,'history'|'response'|'ids'>;
export interface GeometryLocators { scroller:string; messageHost(id:string):string; messageContent(id:string):string }
export interface GeometryCollector { read(phase:GeometryPhase,progress:Readonly<{active:boolean;prefix:string}>):GeometrySnapshot; dispose():void }
class CollectionFailure extends Error { constructor(readonly reason:GeometryFailure){super(reason);} }
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
/** Explicit unscored H100 observation only. Never call from scored readProgress. */
export function createGeometryCollector(context:GeometryContext,locators:GeometryLocators,ports:GeometryPorts):GeometryCollector {
  let ownedPorts:GeometryPorts|null=ports;
  let owners=new WeakMap<GeometryNode,{id:string;role:string;token:number}>(),token=0;
  const expectedHistory=context.history.map(m=>({id:m.id,role:m.role,text:m.content}));
  const expectedResponse={id:context.response.id,role:context.response.role,text:context.response.content};
  const scopeId=context.ids.threadId;
  return {
    dispose(){ownedPorts=null;owners=new WeakMap();},
    read(phase,progress){
      const p=ownedPorts;if(!p)return {status:'unavailable',reason:'disposed'};
      try {
        let visits=0,totalRects=0,totalClips=0,totalText=0;
        const visit=()=>{if(++visits>GEOMETRY_NODE_VISITS)deny('work-cap');};
        const matches=p.find(locators.scroller);
        if(matches.length!==1)deny('selector');
        const scroller=matches[0]!;
        if(!p.connected(scroller))deny('selector');
        const sb=p.box(scroller),bounds=new Map<string,GeometryRect>(),seen=new Set<GeometryNode>();
        const rows:GeometryObservation[]=[];
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
          let observedText='',common:GeometryNode[]|undefined,clips:GeometryClip[]=[];
          const textRects:GeometryRect[]=[];
          // Walk siblings incrementally: no descendant array or recursive JS stack.
          let n:GeometryNode|null=content;
          while(n){
            visit();const text=p.text(n);
            if(text!==null){
              if(text.length>L.observedTextPerRow-observedText.length||text.length>L.observedText-totalText)deny('geometry-cap');
              observedText+=text;totalText+=text.length;
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
              if(!common){common=chain;clips=nodeClips;totalClips+=clips.length;if(totalClips>L.ancestorClips)deny('geometry-cap');}
              const rects=p.textRects(n);
              if(rects.length>L.textRectsPerRow-textRects.length||rects.length>L.textRects-totalRects)deny('geometry-cap');
              totalRects+=rects.length;
              for(let i=0;i<rects.length;i++)textRects.push(copyRect(rects[i]!));
              if(totalRects+totalClips+2>L.rectangles)deny('geometry-cap');
            }
            const child=p.firstChild(n);
            if(child){n=child;continue;}
            while(n!==content&&!p.nextSibling(n)){visit();n=p.parent(n);if(!n)deny('selector');}
            n=n===content?null:p.nextSibling(n);
          }
          rows.push({id:known.id,role:known.role,presence:'mounted',ownerToken:owner.token,observedText,textRects,ancestorClips:clips});
        }
        const frame:MountedGeometryInput={schemaVersion:1,scopeId,clockDomain:'page-performance-ms',observedAtPageMs:p.now(),phase,
          expectedHistory:expectedHistory.map(m=>({...m})),expectedResponse:{...expectedResponse},responseProgress:{...progress},
          viewport:clientBox(sb),nativeViewport:copyRect(p.viewport()),rows};
        const evaluation=evaluateMountedGeometry(frame);
        if(evaluation.status!=='evaluated')return {status:evaluation.status==='invalid'?'invalid':'unavailable',reason:'policy'};
        const visibleMessages:VisibleMessage[]=[];
        for(let i=0;i<evaluation.rows.length;i++){
          const r=evaluation.rows[i]!;
          if(r.presence==='unmounted'||(r.presence==='mounted'&&r.reason==='fully-clipped'))continue;
          if(r.geometryEligibility!=='eligible')return {status:'unavailable',reason:'policy'};
          const b=bounds.get(r.id)!;
          if(![b.x,b.y,b.width,b.height].every(Number.isFinite)||Math.abs(b.x)>L.coordinate||Math.abs(b.y)>L.coordinate||
            b.width<=0||b.height<=0||b.width>L.coordinate||b.height>L.coordinate||!Number.isFinite(b.x+b.width)||!Number.isFinite(b.y+b.height))deny('policy');
          visibleMessages.push({id:r.id,text:rows[i]!.observedText,topCssPx:b.y,bottomCssPx:b.y+b.height});
        }
        // Stable sort retains canonical ordering for ties.
        visibleMessages.sort((a,b)=>a.topCssPx-b.topCssPx);
        if(!Number.isFinite(sb.scrollTop)||!Number.isFinite(sb.scrollHeight)||sb.scrollHeight<0||!Number.isFinite(sb.clientHeight)||sb.clientHeight<0)deny('policy');
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
