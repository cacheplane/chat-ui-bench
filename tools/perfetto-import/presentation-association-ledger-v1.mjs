// Pure original-core association evidence. Native execution is not established here.
import {types} from 'node:util';
import {inspectPresentationCoverageCoreV2} from './presentation-coverage-core-v2.mjs';

function freezeContract(v){if(v&&typeof v==='object'){for(const x of Object.values(v))freezeContract(x);Object.freeze(v);}return v;}
export const PRESENTATION_ASSOCIATION_CONTRACT_V1=freezeContract({
  schema:'presentation-association-ledger-contract-v1',policy:'source-evidence-presentation-association-ledger-v1',
  inputSchema:'browser-presentation-coverage-inventory-v2',inputPolicy:'whole-selected-presentation-coverage-v2',
  originalCore:{path:'presentation-coverage-core-v2.mjs',bytes:40209,sha256:'49f9f01a6e2b4e3e416f37fdc04127addf347afeaa4268d503c87c6d28a03eb6'},
  producerRevision:'f842f52ef39fd97b449eb27cff414bf05a98ddce',producerProfile:'classic-non-TreesInViz',sourceCorrespondence:'vendor-assumed',
  authority:'original-core-brand-only; no-native-origin-or-measurement-authority',
  limits:{work:67108864,resultBytes:4194304,nodes:524288,edges:1048575,entries:65536,depth:64},
  entryAdmission:'new-ledger-index-and-reference-slots-only; inherited-evidence-bounded-by-parent-and-result-seal',
  reporterStates:['STATE_NO_UPDATE_DESIRED','STATE_PRESENTED_ALL','STATE_PRESENTED_PARTIAL','STATE_DROPPED'],
  sendRules:[
    {step:'STEP_SEND_ON_BEGIN_FRAME_MOJO_MESSAGE',role:'begin-frame-send',source:'components/viz/service/frame_sinks/compositor_frame_sink_support.cc',bytes:74735,sha256:'6f939ec77186878c96a82ad6ea835531992b909ab2eb77dd1953cb627de68259',lines:'1188-1255',meaning:'adjusted-args-surface-id-send; not-production-or-success'},
    {step:'STEP_SEND_SUBMIT_COMPOSITOR_FRAME_MOJO_MESSAGE',role:'compositor-frame-metadata-send',source:'cc/mojo_embedder/async_layer_tree_frame_sink.cc',bytes:19654,sha256:'1af9f4da9b8e0b54f63a2fedda2851d2a7e1915d75e2c6c80a1ad463d3231e36',lines:'247-267',meaning:'actual-metadata-ack-surface-id-send; not-acceptance-or-success'}
  ],
  idAssociation:'exact-typed-values-in-one-original-core; process-groups-remain-separate; observed-aliases-remain-unqualified',
  targetHint:'same-upid-and-tree-value-only; frame-loader-source-lifetime-unproved',
  populationAndClosure:'all-source-groups-retained; no-exhaustive-population-or-emission-closure-proof'
});
const C=PRESENTATION_ASSOCIATION_CONTRACT_V1,L=C.limits,attempted=new WeakSet(),originals=new WeakMap();
const need=(v,reason)=>{if(!v)throw Error(reason);};
const authority=()=>({fps:null,rate:null,duration:null,exhaustivePopulation:false,nativeSupported:false,qualification:false,captureQualified:false,fpsEligibility:false,evaluationEligibility:false,scoringEligibility:false,rankingEligibility:false});
function pay(a,n){if(a.failed||!Number.isSafeInteger(n)||n<0||n>a.left){a.failed=true;throw Error('ledger-work-limit');}a.left-=n;}
function reserve(a,n=1){pay(a,n+1);need(Number.isSafeInteger(n)&&n>=0&&n<=L.entries-a.entries,'ledger-entry-limit');a.entries+=n;}
function push(a,array,value){reserve(a);pay(a,2);array.push(value);}
function seal(value,a){
  let nodes=0,edges=0,bound=0;
  const walk=(v,depth)=>{
    pay(a,1);need(++nodes<=L.nodes&&depth<=L.depth,'ledger-result-node-limit');
    if(typeof v==='string'){pay(a,v.length*2+1);bound+=6*v.length+2;}
    else if(v===null||typeof v!=='object'){pay(a,1);need(v===null||typeof v==='boolean'||typeof v==='number'&&Number.isSafeInteger(v),'ledger-result-value');bound+=32;}
    else{
      const width=Array.isArray(v)?v.length:32;
      pay(a,width+1);const keys=Object.keys(v);need(keys.length<=width,'ledger-result-width');
      pay(a,keys.length+1);bound+=2+keys.length;
      for(const k of keys){pay(a,k.length+1);need(++edges<=L.edges,'ledger-result-edge-limit');if(!Array.isArray(v))bound+=6*k.length+3;walk(v[k],depth+1);}
      pay(a,keys.length+2);Object.freeze(v);
    }
    need(bound<=L.resultBytes*6,'ledger-result-capacity');
  };
  walk(value,0);pay(a,bound+1);const text=JSON.stringify(value);pay(a,text.length*3+1);need(Buffer.byteLength(text)<=L.resultBytes,'ledger-result-byte-limit');return value;
}
function unavailable(stage,error){const reason=typeof error?.message==='string'&&/^[a-z][a-z0-9-]{0,95}$/.test(error.message)?error.message:'ledger-operation-failed';return Object.freeze({schema:'browser-presentation-association-ledger-v1',policy:C.policy,status:'unavailable',stage,reason,inputAuthority:'original-core-brand-only',authorities:Object.freeze(authority()),FPS:null});}

export function buildPresentationAssociationLedgerV1(originalCore){
  let stage='original-core',a;
  try{
    need(arguments.length===1&&originalCore&&!types.isProxy(originalCore),'original-core-required');
    const core=inspectPresentationCoverageCoreV2(originalCore);
    need(!attempted.has(core),'original-core-already-attempted');attempted.add(core);
    a={left:L.work,entries:0,failed:false};pay(a,64);
    need(core.schema===C.inputSchema&&core.policy===C.inputPolicy&&core.status==='diagnostic','ledger-input-contract');
    stage='associations';
    const groups=core.candidates,reporters=core.reconciliation.reporterEvidence,graphics=core.reconciliation.graphicEvidence,mappings=core.target.mappings;
    for(const list of [groups,reporters,graphics,mappings]){pay(a,1);need(list.length<=L.entries,'ledger-input-entry-limit');}
    pay(a,32);const byDisplay=new Map(),displayAssociations=[],unassociatedGroupRefs=[];
    for(let i=0;i<groups.length;i++){
      pay(a,8);const group=groups[i],id=group.displayTraceId;
      if(id===null)continue;
      pay(a,id.length+32);let entry=byDisplay.get(id);
      if(!entry){reserve(a);pay(a,32);entry={displayTraceId:id,groupRefs:[],upids:new Set()};pay(a,id.length+16);byDisplay.set(id,entry);}
      push(a,entry.groupRefs,i);pay(a,(group.upid?.length??0)+16);entry.upids.add(group.upid);
    }
    pay(a,16);const associated=new Set();
    pay(a,1);
    for(const entry of byDisplay.values()){
      pay(a,4);
      if(entry.upids.size<2)continue;
      pay(a,2);const upids=[];for(const upid of entry.upids)push(a,upids,upid);
      pay(a,2);const unknown=entry.upids.has(null);
      push(a,displayAssociations,{displayTraceId:entry.displayTraceId,association:unknown?'unresolved-process-identity':'unqualified-raw-display-id-association',processIdentity:unknown?'includes-unknown-process':'distinct-known-processes',groupRefs:entry.groupRefs,upids});
      for(const ref of entry.groupRefs){pay(a,2);associated.add(ref);}
    }
    for(let i=0;i<groups.length;i++){pay(a,2);if(!associated.has(i))push(a,unassociatedGroupRefs,i);}
    // Nested maps avoid delimiter/string coercion and retain repeated mapping refs.
    pay(a,32);const tupleIndex=new Map(),mappingTuples=[],unusableMappingRefs=[];
    for(let i=0;i<mappings.length;i++){
      pay(a,8);const m=mappings[i];
      if(m.malformed||m.upid===null||m.treeId===null){push(a,unusableMappingRefs,i);continue;}
      pay(a,m.upid.length+m.treeId.length+32);let trees=tupleIndex.get(m.upid);
      if(!trees){pay(a,16);trees=new Map();pay(a,m.upid.length+16);tupleIndex.set(m.upid,trees);}
      let index=trees.get(m.treeId);
      if(index===undefined){index=mappingTuples.length;pay(a,32);push(a,mappingTuples,{upid:m.upid,treeId:m.treeId,association:'same-process-tree-value-hint-only',mappingRefs:[]});pay(a,16);trees.set(m.treeId,index);}
      push(a,mappingTuples[index].mappingRefs,i);
    }
    pay(a,4);const reporterMappingHints=[];
    for(let i=0;i<reporters.length;i++){
      pay(a,8);const r=reporters[i],tree=r.fields.tree;let index;
      if(tree.status==='unique'&&r.upid!==null){pay(a,r.upid.length+tree.value.length+16);index=tupleIndex.get(r.upid)?.get(tree.value);}
      push(a,reporterMappingHints,{reporterEvidenceRef:i,sliceId:r.sliceId,mappingTupleRef:index??null,association:index===undefined?'unresolved-mapping-hint':'same-process-tree-value-hint-only',targetAssociation:'unknown'});
    }
    pay(a,4);const sourceStepAnnotations=[];let recognized=0,unusable=0;
    for(let i=0;i<graphics.length;i++){
      pay(a,8);const graphic=graphics[i];let rule;
      for(const candidate of C.sendRules){pay(a,(graphic.step?.length??0)+1);if(graphic.step===candidate.step){rule=candidate;break;}}
      if(!rule)continue;
      const valid=graphic.surface.status==='unique';valid?recognized++:unusable++;
      push(a,sourceStepAnnotations,{graphicEvidenceRef:i,sliceId:graphic.sliceId,step:graphic.step,role:rule.role,surfaceId:valid?graphic.surface.value:null,surfaceStatus:graphic.surface.status,classification:valid?'source-recognized-send':'known-send-unusable-surface',originalKind:graphic.kind,acceptanceAndOutcome:'unproved',targetAssociation:'unknown'});
    }
    let duplicateReporterTerminalGroups=0,unknownProcessGroups=0;
    pay(a,16);const rawReporterRecordsByState={STATE_NO_UPDATE_DESIRED:0,STATE_PRESENTED_ALL:0,STATE_PRESENTED_PARTIAL:0,STATE_DROPPED:0,unclassified:0};
    for(const group of groups){
      pay(a,4);duplicateReporterTerminalGroups+=group.duplicateReporterTerminals.length;if(group.upid===null)unknownProcessGroups++;
      for(const record of group.reporterStates){
        pay(a,4);const argument=record.arguments.length===1?record.arguments[0]:null;
        if(argument?.type==='string'){pay(a,(argument.value?.length??0)*4+4);if(C.reporterStates.includes(argument.value)){rawReporterRecordsByState[argument.value]++;continue;}}
        rawReporterRecordsByState.unclassified++;
      }
    }
    pay(a,128);
    const counts={groups:groups.length,displayAssociations:displayAssociations.length,unassociatedGroups:unassociatedGroupRefs.length,unknownProcessGroups,reporters:reporters.length,rawReporterRecordsByState,graphicEvidence:graphics.length,mappings:mappings.length,mappingTuples:mappingTuples.length,sourceRecognizedSends:recognized,unusableKnownSends:unusable,duplicateReporterTerminalGroups};
    const result={schema:'browser-presentation-association-ledger-v1',policy:C.policy,status:'diagnostic',stage:null,reason:null,input:{schema:core.schema,policy:core.policy,inputAuthority:'original-core-brand-only',sourceCorrespondence:C.sourceCorrespondence},groups,displayAssociations,unassociatedGroupRefs,reporterEvidence:reporters,graphicEvidence:graphics,mappingTuples,unusableMappingRefs,reporterMappingHints,sourceStepAnnotations,selectedGraph:core.selectedGraph,target:core.target,phase:core.phase,reconciliation:{matched:core.reconciliation.matched,unmatched:core.reconciliation.unmatched,ambiguous:core.reconciliation.ambiguous,foreign:core.reconciliation.foreign,malformed:core.reconciliation.malformed,frameDisplayedEvidence:core.reconciliation.frameDisplayedEvidence,crossProcessDisplayIds:core.reconciliation.crossProcessDisplayIds},closure:core.closure,gates:core.gates,stats:core.stats,counts,authorities:authority(),FPS:null};
    stage='seal';seal(result,a);
    pay(a,64);const summary=seal({schema:result.schema,policy:result.policy,status:'diagnostic',input:result.input,counts:result.counts,authorities:authority(),FPS:null},a);
    inspectPresentationCoverageCoreV2(core);pay(a,8);originals.set(result,{core,account:a,summary});return result;
  }catch(error){if(a)a.failed=true;return unavailable(stage,error);}
}
export function inspectPresentationAssociationLedgerV1(originalLedger){
  need(arguments.length===1&&originalLedger&&!types.isProxy(originalLedger),'original-ledger-required');
  const owned=originals.get(originalLedger);need(owned,'original-ledger-required');
  try{pay(owned.account,1);inspectPresentationCoverageCoreV2(owned.core);return owned.summary;}
  catch(error){owned.account.failed=true;originals.delete(originalLedger);throw error;}
}
