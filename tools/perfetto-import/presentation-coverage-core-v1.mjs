// Whole-selected-graph diagnostic. Imported accounting is never FPS authority.
import {
  types
}
from 'node:util';
import model from './presentation-coverage-source-model-v1.json' with {
  type:'json'
};
import {
  createPresentationCoverageAccountV1,chargePresentationCoverageWorkV1,parsePresentationCoverageCSVV1,inspectPresentationCoverageWireV1
}
from './presentation-coverage-wire-v1.mjs';
const originals=new WeakMap(),L=model.limits;
const reporterStates = new Set(model.semanticPolicies.reporterStates);
const graphicsSteps = new Set(model.semanticPolicies.graphicsSteps);
const need=(ok,reason)=>{
  if(!ok)throw Error(reason);
};
const authority=()=>({
  fps:null,rate:null,duration:null,exhaustivePopulation:false,nativeSupported:false,qualification:false,captureQualified:false,fpsEligibility:false,evaluationEligibility:false,scoringEligibility:false,rankingEligibility:false
});
const base=()=>({
  schema:model.schema,policy:model.policy,wireFormat:model.wireFormat,status:'unavailable',stage:null,reason:null,inputOrigin:'caller-supplied-csv',traceOrigin:'unestablished',browserSourceCorrespondence:'vendor-assumed',clockContract:'supplied-imported-nanoseconds'
});
function seal(value,pay){
  let bound=0,nodes=0;
  const stack=[value];
  while(stack.length){
    pay(1);
    const v=stack.pop();
    need(++nodes<=L.nodes,'result-node-limit');
    if(typeof v==='string'){
      pay(v.length+1);
      bound+=6*v.length+2;
    }
    else if(v===null||typeof v!=='object')bound+=32;
    else{
      pay(Array.isArray(v)?v.length+1:32);
      const keys=Object.keys(v);
      pay(keys.length+1);
      bound+=2+keys.length;
      for(const k of keys){
        pay(k.length+1);
        if(!Array.isArray(v))bound+=6*k.length+3;
        stack.push(v[k]);
      }
      pay(keys.length+2);
      Object.freeze(v);
    }
    need(bound<=L.resultBytes*6,'result-capacity');
  }
  pay(bound);
  const text=JSON.stringify(value);
  pay(text.length*3+1);
  const bytes=Buffer.byteLength(text);
  need(bytes<=L.resultBytes,'result-byte-limit');
  return value;
}
function selector(raw,pay){
  need(typeof raw==='string'&&raw.length<=16384,'selector-bytes');
  pay(raw.length*8+1);
  need(Buffer.byteLength(raw)<=16384,'selector-bytes');
  const s=JSON.parse(raw),canonical={
    target:{
      frameId:s?.target?.frameId,loaderId:s?.target?.loaderId
    },phaseNames:{
      start:s?.phaseNames?.start,end:s?.phaseNames?.end
    }
  };
  need(JSON.stringify(canonical)===raw,'selector-canonical');
  for(const v of [...Object.values(canonical.target),...Object.values(canonical.phaseNames)])need(typeof v==='string'&&v.length>0&&Buffer.byteLength(v)<=256&&v.isWellFormed()&&!/[\x00-\x1f\x7f-\x9f]/.test(v),'selector-name');
  need(canonical.phaseNames.start!==canonical.phaseNames.end,'selector-phase-names');
  return canonical;
}
export function inspectPresentationCoverageCoreV1(original){
  need(original&&!types.isProxy(original)&&originals.has(original),'original-core-required');
  const owned=originals.get(original);
  chargePresentationCoverageWorkV1(owned.account,1);
  return original;
}
export function evaluatePresentationCoverageV1(csvBytes,selectorJSON,account=createPresentationCoverageAccountV1()){
  const pay=n=>chargePresentationCoverageWorkV1(account,n);
  let stage='input';
  try{
    const s=selector(selectorJSON,pay),wire=parsePresentationCoverageCSVV1(csvBytes,account),{
      tables:t
    }
    =inspectPresentationCoverageWireV1(wire);
    stage='graph';
    const unique=(rows,key,label)=>{
      const m=new Map();
      for(const r of rows){
        pay(2);
        need(r[key]!==null&&!m.has(r[key]),'duplicate-'+label);
        m.set(r[key],r);
      }
      return m;
    };
    const slices=unique(t[2],'id','slice'),tracks=unique(t[5],'id','track'),procs=unique(t[9],'upid','process'),threads=unique(t[10],'utid','thread');
    const incompleteness=[];
    let diagnosticEntries = 0;
    function reserveDiagnosticEntries(count) {
      // Reserve object/key/reference construction independently of later
      // serialization; adaptive string/regexp/BigInt passes are paid below.
      pay(count * 64 + 1);
      need(Number.isSafeInteger(count) && count >= 0 && diagnosticEntries + count <= L.diagnosticEntries, 'diagnostic-entry-limit');
      diagnosticEntries += count;
    }
    function noteIncomplete(value) {
      reserveDiagnosticEntries(1);
      incompleteness.push(value);
    }
    const process=(upid,pid,ref)=>{
      if(upid===null){
        if(pid!==null)throw Error('process-context-conflict');
        noteIncomplete({
          kind:'missing-process-context',ref
        });
        return;
      }
      const p=procs.get(upid);
      need(p,'missing-process');
      if(pid!==null)need(p.pid===pid,'process-context-conflict');
    };
    for(const th of threads.values()){
      need(th.tid!==null,'thread-identity');
      if(th.upid!==null)need(procs.has(th.upid),'missing-thread-process');
    }
    const ancestryMemo = new Map();
    let ancestryEntries = 0;
    const chain=(row,map,key,kind)=>{
      const memoKey = kind + ':' + row.id;
      const cached = ancestryMemo.get(memoKey);
      if (cached) { pay(cached.length + 1); return cached; }
      let current=row;
      const seen=new Set();
      while(current){
        pay(256);
        need(!seen.has(current.id),'cycle-'+kind);
        need(seen.size<L.depth,'ancestry-depth');
        seen.add(current.id);
        if(current[key]===null)break;
        const p=map.get(current[key]);
        if(!p){
          noteIncomplete({
            kind:'missing-'+kind+'-ancestor',ref:current.id,parent:current[key]
          });
          break;
        }
        if(kind==='slice'){
          need(current.track_id===p.track_id&&BigInt(current.depth)===BigInt(p.depth)+1n,'parent-context-conflict');
          if(BigInt(current.dur)>=0n&&BigInt(p.dur)>=0n)need(BigInt(current.ts)>=BigInt(p.ts)&&BigInt(current.ts)+BigInt(current.dur)<=BigInt(p.ts)+BigInt(p.dur),'parent-time-conflict');
        }
        current=p;
      }
      ancestryEntries += seen.size;
      need(ancestryEntries <= L.edges, 'ancestry-cache-limit');
      pay(seen.size + 1);
      const result = Object.freeze([...seen]);
      ancestryMemo.set(memoKey, result);
      return result;
    };
    for(const tr of tracks.values()){
      pay(256);
      chain(tr,tracks,'parent_id','track');
      if(tr.upid!==null)process(tr.upid,null,tr.id);
      if(tr.utid!==null){
        const th=threads.get(tr.utid);
        need(th,'missing-track-thread');
        if(tr.upid!==null&&th.upid!==null)need(tr.upid===th.upid,'track-thread-process-conflict');
      }
    }
    const bounds=t[12][0];
    for(const n of slices.values()){
      pay(256+(n.name?.length??0)*18+(n.track_name?.length??0)*2+(n.process_name?.length??0)*2+(n.thread_name?.length??0)*2);
      need(n.ts!==null&&n.dur!==null&&n.depth!==null&&n.track_id!==null&&['0','1'].includes(n.is_seed),'slice-required-field');
      const tr=tracks.get(n.track_id);
      need(tr,'missing-track');
      need(n.track_name === tr.name, 'slice-track-name-conflict');
      const expectedSeed = model.sql.families.includes(n.name) || Object.values(s.phaseNames).includes(n.name) || ['FrameSequenceTrackerV3','FrameSequenceTracker'].includes(tr.name);
      need(n.is_seed === (expectedSeed ? '1' : '0'), 'seed-membership');
      need(BigInt(n.dur) >= -1n, 'duration-sentinel');
      if(BigInt(n.dur)>=0n) {
        const endpoint=BigInt(n.ts)+BigInt(n.dur);
        need(endpoint<=9223372036854775807n,'endpoint-overflow');
        need(endpoint<=BigInt(bounds.end_ts),'slice-end-outside-bounds');
      }
      if (n.parent_id === null) need(n.depth === '0', 'root-depth');
      process(n.upid,n.pid,n.id);
      if (n.upid !== null) need(n.process_name === procs.get(n.upid).name, 'slice-process-name-conflict');
      if (n.upid === null && tr.upid !== null) noteIncomplete({kind:'missing-slice-process-association',ref:n.id,trackId:tr.id});
      if(n.utid!==null){
        const th=threads.get(n.utid);
        need(th&&th.tid===n.tid,'slice-thread-conflict');
        need(n.thread_name === th.name, 'slice-thread-name-conflict');
        if(n.upid!==null&&th.upid!==null)need(th.upid===n.upid,'slice-thread-process-conflict');
      }
      else need(n.tid===null,'slice-thread-conflict');
      if (n.utid === null && tr.utid !== null) noteIncomplete({kind:'missing-slice-thread-association',ref:n.id,trackId:tr.id});
      if(tr.upid!==null&&n.upid!==null)need(tr.upid===n.upid,'slice-track-process-conflict');
      if(tr.utid!==null&&n.utid!==null)need(tr.utid===n.utid,'slice-track-thread-conflict');
      need(BigInt(n.ts)>=BigInt(bounds.start_ts)&&BigInt(n.ts)<=BigInt(bounds.end_ts),'slice-outside-bounds');
      chain(n,slices,'parent_id','slice');
    }
    const seedIds = new Set(t[2].filter(n=>{pay(1);return n.is_seed==='1';}).map(n=>n.id));
    const seedAncestors = new Set();
    for (const n of t[2]) if(seedIds.has(n.id)) {
      for(const id of chain(n,slices,'parent_id','slice')) {pay(1);seedAncestors.add(id);}
    }
    for (const n of t[2]) {
      pay(1);
      if(seedAncestors.has(n.id)) continue;
      need(chain(n,slices,'parent_id','slice').some(id=>{pay(1);return seedIds.has(id);}), 'selection-extraneous');
    }
    const registry=(rows,args,refs,countKey,kind)=>{
      // Fresh reservation for each physical registry pass: typed numeric
      // validation, registry indexing, reference counting and array entries.
      pay(args.length*128+rows.length*32+refs.length*32+1);
      const sets=unique(rows,'arg_set_id',kind+'-set'),raw=new Map();
      for(const a of args){
        pay(2);
        need(a.arg_set_id!==null&&sets.has(a.arg_set_id),'argument-set-reference');
        need(a.value_type!==null,'argument-type');
        const values=[a.int_value,a.string_value,a.real_value].filter(v=>v!==null);
        need(values.length<=1,'argument-value-conflict');
        const expected=a.value_type==='string'?a.string_value:['int','uint','bool','pointer'].includes(a.value_type)?a.int_value:a.value_type==='real'?a.real_value:undefined;
        if(expected===undefined)noteIncomplete({
          kind:'unknown-argument-type',ref:a.arg_set_id,type:a.value_type
        });
        else need(expected!==null,'argument-value-type');
        if(a.value_type==='bool')need(a.int_value==='0'||a.int_value==='1','argument-bool');
        if(a.value_type==='int'&&a.int_value!==null)need(BigInt(a.int_value)<=9223372036854775807n,'argument-int-range');
        if(a.value_type==='uint'&&a.int_value!==null)need(BigInt(a.int_value)>=0n,'argument-uint');
        const list=raw.get(a.arg_set_id)??[];
        list.push(a);
        raw.set(a.arg_set_id,list);
      }
      const counts=new Map();
      for(const id of refs)if(id!==null){
        need(sets.has(id),'missing-argument-set');
        counts.set(id,(counts.get(id)??0)+1);
      }
      for(const[id,r]of sets){
        pay(1);
        need(BigInt(r.arg_count??'-1')===BigInt(raw.get(id)?.length??0)&&BigInt(r[countKey]??'-1')===BigInt(counts.get(id)??0)&&(counts.get(id)??0)>0,'argument-registry-count');
      }
      return raw;
    };
    const args=registry(t[3],t[4],t[2].map(n=>n.arg_set_id),'slice_count','slice');
    const trackRefs=new Map();
    for(const r of t[6]){
      need(tracks.has(r.track_id)&&['source','dimension'].includes(r.namespace),'track-set-reference');
      const key=r.track_id+'/'+r.namespace;
      need(!trackRefs.has(key),'duplicate-track-set-reference');
      trackRefs.set(key,r);
      need(tracks.get(r.track_id)[r.namespace+'_arg_set_id']===r.arg_set_id,'track-set-conflict');
    }
    for(const tr of tracks.values())for(const ns of ['source','dimension'])need(trackRefs.has(tr.id+'/'+ns),'missing-track-set-reference');
    registry(t[7],t[8],t[6].map(r=>r.arg_set_id),'reference_count','track');
    const getArgs=n=>args.get(n.arg_set_id)??[],values=(n,key)=>{
      const out=[];
      for(const a of getArgs(n)){
        pay(1);
        if(a.key===key||a.flat_key===key)out.push(a.int_value??a.string_value??a.real_value);
      }
      return out;
    },one=(n,key)=>{
      const v=values(n,key);
      return v.length===1?v[0]:null;
    };
    function typedField(n, key, types, domain = null) {
      const found = [];
      for (const a of getArgs(n)) {
        pay(1 + (a.key?.length ?? 0));
        if (a.key === key || a.flat_key === key) found.push(a);
      }
      reserveDiagnosticEntries(found.length + 1);
      const occurrences = found.map(a => ({key:a.key,flatKey:a.flat_key,type:a.value_type,intValue:a.int_value,stringValue:a.string_value,realValue:a.real_value}));
      let status = found.length === 0 ? 'missing' : found.length !== 1 ? 'duplicate' : 'unique';
      let value = null;
      if (status === 'unique') {
        const a = found[0];
        value = a.int_value ?? a.string_value ?? a.real_value;
        if (a.key!==key || a.flat_key!==key) status='wrong-key';
        else if (!types.includes(a.value_type)) status = 'wrong-type';
        else if (domain !== null) {
          pay((value?.length ?? 0) * 2 + 1);
          if (value === null || !/^(?:0|-?[1-9][0-9]*)$/.test(value)) status = 'out-of-domain';
          else {
            const numeric = BigInt(value);
            if (domain === 'trace' && (value === '-1' || numeric < -9223372036854775808n || numeric > 9223372036854775807n)) status = 'out-of-domain';
            if (domain === 'unsigned' && (numeric < 0n || numeric > 18446744073709551615n)) status = 'out-of-domain';
            if (domain === 'tree' && (numeric <= 0n || numeric > 2147483647n)) status = 'out-of-domain';
          }
        }
      }
      return {key,status,value:status === 'unique' ? value : null,occurrences};
    }
    const expectedNames=[...model.sql.families,s.phaseNames.start,s.phaseNames.end];
    need(t[1].length===new Set(expectedNames).size,'family-census-size');
    const census=new Map();
    for(const r of t[1]){
      need(expectedNames.includes(r.name)&&!census.has(r.name),'family-census-name');
      census.set(r.name,r);
      const ss=t[2].filter(n=>{
        pay(1);
        return n.name===r.name;
      });
      need(BigInt(r.event_count??'-1')===BigInt(ss.length)&&BigInt(r.arg_set_count??'-1')===BigInt(new Set(ss.map(n=>n.arg_set_id).filter(x=>x!==null)).size),'family-census-count');
    }
    stage='diagnostics';
    const phaseRows=Object.values(s.phaseNames).map(name=>t[2].filter(n=>{
      pay(1);
      return n.name===name;
    }));
    let phaseStatus=phaseRows.some(a=>a.length===0)?'missing':phaseRows.some(a=>a.length!==1)?'ambiguous':'unique';
    let interval=null;
    if(phaseStatus==='unique'){
      const[a,b]=phaseRows.map(v=>v[0]);
      if(a.category!=='blink.user_timing'||b.category!=='blink.user_timing'||a.upid===null||a.upid!==b.upid||a.utid!==b.utid||a.dur!=='0'||b.dur!=='0'||BigInt(a.ts)>=BigInt(b.ts)||one(a,'debug.data.navigationId')!==s.target.loaderId||one(b,'debug.data.navigationId')!==s.target.loaderId)phaseStatus='invalid';
      else interval={
        startTs:a.ts,endTs:b.ts
      };
    }
    const mappings=t[2].filter(n=>{
      pay(1);
      return n.name==='SetLayerTreeId'&&values(n,'debug.data.frame').includes(s.target.frameId);
    }).map(n=>{
      const frame = typedField(n,'debug.data.frame',['string']);
      const tree = typedField(n,'debug.data.layerTreeId',['int'],'tree');
      return {sliceId:n.id,treeId:tree.value,upid:n.upid,frameId:frame.value,fields:{frame,tree},malformed:frame.status!=='unique'||tree.status!=='unique',identityReason:'frame-loader-source-lifetime-unproved'};
    });
    const treeKeys = new Set(mappings.map(m => m.upid + '/' + m.treeId));
    // A consistent imported mapping is useful evidence, but this first inventory
    // does not prove the complete frame/loader/source/lifetime identity chain.
    const targetStatus = !mappings.length ? 'missing'
      : treeKeys.size > 1 ? 'conflicting' : 'ambiguous';
    function trackerAccounting(root, members) {
      const counters = [];
      const groups = new Map();
      const counterDiagnostics = [];
      function diagnostic(kind, sliceId, field, extra = {}) {
        reserveDiagnosticEntries(1);
        counterDiagnostics.push({kind,sliceId,field,...extra});
      }
      for (const n of members) {
        for (const a of getArgs(n)) {
          pay(1 + (a.key?.length ?? 0));
          const field = a.key?.match(/(?:^|\.)(frame_source|source_id|frame_sequence|sequence_number|last_sequence|expected|dropped_v3|dropped_v4)$/)?.[1];
          if (!field) continue;
          reserveDiagnosticEntries(1);
          const value = a.int_value ?? a.string_value ?? a.real_value;
          const canonical = ['frame_source','source_id'].includes(field) ? 'source' : ['frame_sequence','sequence_number'].includes(field) ? 'sequence' : field;
          const valid = ['int','uint'].includes(a.value_type) && value !== null && /^(?:0|[1-9][0-9]*)$/.test(value);
          const counter = {sliceId:n.id,key:a.key,field:canonical,type:a.value_type,value,valid};
          counters.push(counter);
          const groupKey = n.id + '/' + canonical;
          const group = groups.get(groupKey) ?? [];
          group.push(counter);
          groups.set(groupKey, group);
          if (!valid) diagnostic('wrong-type-counter',n.id,canonical,{type:a.value_type,value});
        }
      }
      const valid = new Map();
      for (const [key, group] of groups) {
        pay(group.length + 1);
        if (group.length !== 1) diagnostic('duplicate-counter',group[0].sliceId,group[0].field,{values:group.map(c=>c.value)});
        else if (group[0].valid) valid.set(key,group[0]);
      }
      const resets = [], sourceChanges = [], previous = new Map();
      for (const n of members) {
        pay(1);
        const expected = valid.get(n.id + '/expected');
        for (const drop of ['dropped_v3','dropped_v4']) {
          const dropped = valid.get(n.id + '/' + drop);
          if (expected && dropped && BigInt(dropped.value) > BigInt(expected.value)) diagnostic('drop-exceeds-expected',n.id,drop,{expected:expected.value,dropped:dropped.value});
        }
        if (root && n.id === root.id) continue; // Outer totals are not a chronological sample.
        for (const field of ['source','expected','dropped_v3','dropped_v4']) {
          const c = valid.get(n.id + '/' + field);
          if (!c) continue;
          const old = previous.get(field);
          if (old && field === 'source' && c.value !== old.value) {
            reserveDiagnosticEntries(1);
            sourceChanges.push(c.sliceId);
            diagnostic('source-change',c.sliceId,field,{previous:old.value,current:c.value});
          } else if (old && field !== 'source' && BigInt(c.value) < BigInt(old.value)) {
            reserveDiagnosticEntries(1);
            resets.push(c.sliceId);
            diagnostic('counter-reset',c.sliceId,field,{previous:old.value,current:c.value});
          }
          previous.set(field,c);
        }
      }
      if (root) {
        for (const field of ['expected','dropped_v3','dropped_v4']) {
          const total = valid.get(root.id + '/' + field), last = previous.get(field);
          if (total && last && total.value !== last.value) diagnostic('outer-total-mismatch',root.id,field,{outer:total.value,lastNested:last.value});
        }
      }
      return {counters,counterDiagnostics,counterResetSliceIds:resets,sourceChangeSliceIds:sourceChanges,accountingTransition:counterDiagnostics.length?'unsupported':'unproved'};
    }
    const trackerRoots = t[2].filter(n => {
      pay(1);
      return n.name === 'FrameSequenceTrackerV3' || n.name === 'FrameSequenceTracker';
    });
    const trackerRootIds = new Map();
    for (const root of trackerRoots) {
      pay(1);
      const ids = trackerRootIds.get(root.track_id) ?? [];
      ids.push(root.id);
      trackerRootIds.set(root.track_id,ids);
    }
    const trackers = trackerRoots.map(root => {
      const members = t[2].filter(n => {
        pay(1);
        return n.track_id === root.track_id && chain(n,slices,'parent_id','slice').includes(root.id);
      });
      reserveDiagnosticEntries(members.length + 1);
      const accounting = trackerAccounting(root,members);
      const sameTrackRootSliceIds = trackerRootIds.get(root.track_id);
      pay(sameTrackRootSliceIds.length);
      return {sliceId:root.id,trackId:root.track_id,upid:root.upid,typeName:one(root,'debug.name'),nestedSliceIds:members.map(n=>n.id),...accounting,rootStatus:'observed',sameTrackRootSliceIds:[...sameTrackRootSliceIds],mergeEvidence:sameTrackRootSliceIds.length>1?'multiple-roots-require-adoption-review':'unproved',observedTermination:BigInt(root.dur)>=0n,terminationMeaning:'unproved',targetAssociation:'unknown'};
    });
    for (const tr of tracks.values()) {
      pay(1);
      if (!['FrameSequenceTrackerV3','FrameSequenceTracker'].includes(tr.name) || trackerRootIds.has(tr.id)) continue;
      const members = t[2].filter(n => {pay(1);return n.track_id === tr.id;});
      reserveDiagnosticEntries(members.length + 1);
      trackers.push({sliceId:null,trackId:tr.id,upid:tr.upid,typeName:null,rootStatus:'missing',nestedSliceIds:members.map(n=>n.id),...trackerAccounting(null,members),sameTrackRootSliceIds:[],mergeEvidence:'unproved',observedTermination:false,terminationMeaning:'unproved',targetAssociation:'unknown'});
    }
    const events = new Map();
    const frameDisplayed = [];
    const frameDisplayedEvidence = [];
    const aliasProcesses = new Map();
    const reporterEvidence = [];
    const graphicEvidence = [];
    const malformedEvidence = mappings.filter(m=>m.malformed).map(m=>({stream:'mapping',sliceId:m.sliceId,fields:m.fields,reason:'malformed-frame-tree-mapping'}));
    const foreignEvidence = [];
    const displaySteps = new Set(model.semanticPolicies.displaySteps);
    function event(key, id, upid) {
      pay(1);
      if (!events.has(key)) {
        reserveDiagnosticEntries(1);
        events.set(key, {
          displayTraceId: id,
          upid,
          candidateSliceIds: [],
          kinds: [],
          unclosedCandidateSliceIds: [],
          reporterSliceIds: [],
          successfulReporterSliceIds: [],
          failedReporterSliceIds: [],
          nonPresentedReporterSliceIds: [],
          terminalTimes: [],
          malformedSliceIds: [],
          reporterStates: [],
          pipelineSteps: [],
          targetContribution: 'unknown',
        });
      }
      return events.get(key);
    }
    function matchingArguments(n, key) {
      const found = [];
      for (const a of getArgs(n)) {
        pay(1);
        if (a.key === key || a.flat_key === key) found.push(a);
      }
      return found;
    }
    function displayIdentity(n, key) {
      const found = matchingArguments(n, key);
      if (found.length !== 1 || found[0].value_type !== 'int' || found[0].key!==key || found[0].flat_key!==key) return null;
      const id = found[0].int_value;
      if (id === null || !/^(?:0|-?[1-9][0-9]*)$/.test(id) || id === '-1') return null;
      if (BigInt(id) < -9223372036854775808n || BigInt(id) > 9223372036854775807n) return null;
      return id;
    }
    for (const n of t[2]) {
      pay(1);
      reserveDiagnosticEntries(1);
      if (n.name === 'Display::FrameDisplayed') {
        frameDisplayed.push(n.id);
        frameDisplayedEvidence.push({sliceId:n.id,ts:n.ts,upid:n.upid,utid:n.utid,trackId:n.track_id,successMeaning:'unproved',displayIdentity:'absent-from-modeled-event'});
        continue;
      }
      const reporter = n.name === 'PipelineReporter';
      const graphics = n.name === 'Graphics.Pipeline' || n.name === 'Graphics.Pipeline.DrawAndSwap';
      if (!reporter && !graphics) continue;
      const key = reporter ? 'frame_reporter.display_trace_id' : 'chrome_graphics_pipeline.display_trace_id';
      const id = displayIdentity(n, key);
      // Equal raw IDs across processes are aliases requiring contribution proof.
      // Do not invent that proof by joining reporter and GPU rows on ID alone.
      const identityKey = id === null ? 'slice:' + n.id : 'process:' + (n.upid ?? 'unknown:' + n.id) + '/display:' + id;
      const e = event(identityKey, id, n.upid);
      if (id !== null) {
        const processes = aliasProcesses.get(id) ?? new Set();
        processes.add(n.upid ?? 'unknown:' + n.id);
        aliasProcesses.set(id, processes);
      }
      if (id === null && reporter) e.malformedSliceIds.push(n.id);
      if (reporter) {
        e.kinds.push('reporter');
        e.reporterSliceIds.push(n.id);
        const fields = {
          display:typedField(n,'frame_reporter.display_trace_id',['int'],'trace'),
          source:typedField(n,'frame_reporter.frame_source',['uint'],'unsigned'),
          sequence:typedField(n,'frame_reporter.frame_sequence',['uint'],'unsigned'),
          tree:typedField(n,'frame_reporter.layer_tree_host_id',['uint'],'tree'),
          surface:typedField(n,'frame_reporter.surface_frame_trace_id',['int'],'trace'),
        };
        const reasons = ['target-lifetime-loader-source-unproved'];
        for (const [field, evidence] of Object.entries(fields)) {
          pay(1);
          if (evidence.status !== 'unique') reasons.push(field + '-' + evidence.status);
          if (!['unique','missing'].includes(evidence.status)) {
            reserveDiagnosticEntries(1);
            malformedEvidence.push({stream:'reporter',sliceId:n.id,field,status:evidence.status,evidence});
          }
        }
        const matchingTrackerCounterSliceIds = [];
        if (fields.sequence.status === 'unique') {
          for (const tracker of trackers) for (const counter of tracker.counters) {
            pay(2);
            if (counter.field === 'sequence' && counter.valid && counter.value === fields.sequence.value) {
              reserveDiagnosticEntries(1);
              matchingTrackerCounterSliceIds.push(counter.sliceId);
            }
          }
        }
        if (!matchingTrackerCounterSliceIds.length) reasons.push('no-tracker-sequence-match');
        else reasons.push('sequence-match-lacks-source-and-target-proof');
        const treeHints = mappings.filter(mapping=>{pay(1);return mapping.upid===n.upid&&mapping.treeId!==null;});
        if (fields.tree.status==='unique' && treeHints.length && treeHints.every(mapping=>mapping.treeId!==fields.tree.value)) {
          reserveDiagnosticEntries(1);
          foreignEvidence.push({stream:'reporter',sliceId:n.id,reason:'tree-mapping-mismatch-hint',mappingSliceIds:treeHints.map(m=>m.sliceId),authority:'unproved'});
        }
        reporterEvidence.push({sliceId:n.id,upid:n.upid,fields,matchingTrackerCounterSliceIds,targetAssociation:'unknown',reasons});
        const states = matchingArguments(n, 'frame_reporter.state');
        reserveDiagnosticEntries(states.length);
        e.reporterStates.push({
          sliceId: n.id, arguments: states.map(a => ({
            type:a.value_type, value:a.string_value ?? a.int_value ?? a.real_value
          }))
        });
        const state = states.length === 1 && states[0].value_type === 'string' && states[0].key==='frame_reporter.state' && states[0].flat_key==='frame_reporter.state' ? states[0].string_value : null;
        if (!reporterStates.has(state) && !e.malformedSliceIds.includes(n.id)) e.malformedSliceIds.push(n.id);
        if (state === 'STATE_DROPPED') e.failedReporterSliceIds.push(n.id);
        if (state === 'STATE_DROPPED' || state === 'STATE_NO_UPDATE_DESIRED') e.nonPresentedReporterSliceIds.push(n.id);
        if (id !== null && ['STATE_PRESENTED_ALL','STATE_PRESENTED_PARTIAL'].includes(state) && BigInt(n.dur) >= 0n) {
          e.successfulReporterSliceIds.push(n.id);
          e.terminalTimes.push((BigInt(n.ts) + BigInt(n.dur)).toString());
        }
      }
      else {
        // Retain every raw Graphics.Pipeline family member, including missing
        // or wrong-typed IDs/steps. Surface steps do not imply display success.
        e.candidateSliceIds.push(n.id);
        if (BigInt(n.dur)<0n) e.unclosedCandidateSliceIds.push(n.id);
        const steps = matchingArguments(n, 'chrome_graphics_pipeline.step');
        reserveDiagnosticEntries(steps.length);
        e.pipelineSteps.push({
          sliceId:n.id, arguments:steps.map(a => ({
            type:a.value_type,value:a.string_value ?? a.int_value ?? a.real_value
          }))
        });
        const step = steps.length===1 && steps[0].value_type==='string' && steps[0].key==='chrome_graphics_pipeline.step' && steps[0].flat_key==='chrome_graphics_pipeline.step' ? steps[0].string_value : null;
        const kind = displaySteps.has(step) || n.name==='Graphics.Pipeline.DrawAndSwap' ? 'display-work' : graphicsSteps.has(step) ? 'surface-work' : 'unsupported-work';
        e.kinds.push(kind);
        if (id===null && kind!=='surface-work') e.malformedSliceIds.push(n.id);
        const surface = typedField(n,'chrome_graphics_pipeline.surface_frame_trace_id',['int'],'trace');
        const aggregateMembers=[];
        const prefix='chrome_graphics_pipeline.aggregated_surface_frame_trace_ids';
        for(const a of getArgs(n)) {
          pay(1+(a.key?.length??0));
          if(a.flat_key!==prefix&&!a.key?.startsWith(prefix+'['))continue;
          reserveDiagnosticEntries(1);
          const index=a.key?.match(/\[(0|[1-9][0-9]*)\]$/)?.[1]??null;
          const valid=a.flat_key===prefix&&index!==null&&a.key===prefix+'['+index+']'&&BigInt(index)<=4095n&&a.value_type==='int'&&a.int_value!==null&&a.int_value!=='-1'&&BigInt(a.int_value)<=9223372036854775807n;
          aggregateMembers.push({key:a.key,flatKey:a.flat_key,type:a.value_type,index,value:a.int_value??a.string_value??a.real_value,status:valid?'unique':'malformed'});
        }
        pay(aggregateMembers.length*16+1);
        aggregateMembers.sort((a,b)=>Number(a.index??4096)-Number(b.index??4096));
        const indexedMembership=aggregateMembers.every((member,index)=>{pay(1);return member.status==='unique'&&member.index===String(index);});
        if(!indexedMembership) {
          reserveDiagnosticEntries(1);
          malformedEvidence.push({stream:'graphics',sliceId:n.id,reason:'indexed-membership',memberKeys:aggregateMembers.map(a=>a.key)});
          if(!e.malformedSliceIds.includes(n.id))e.malformedSliceIds.push(n.id);
          for(const member of aggregateMembers)member.status='unproved-index-membership';
        }
        graphicEvidence.push({sliceId:n.id,upid:n.upid,step,kind,displayTraceId:id,surface,aggregateMembers,targetAssociation:'unknown',reason:'contribution-lifetime-loader-source-unproved'});
        if(kind==='unsupported-work'||!['unique','missing'].includes(surface.status)||aggregateMembers.some(a=>a.status!=='unique')) {
          reserveDiagnosticEntries(1);
          malformedEvidence.push({stream:'graphics',sliceId:n.id,reason:kind==='unsupported-work'?'unknown-or-malformed-step':'malformed-surface-fields',surface});
          if(!e.malformedSliceIds.includes(n.id))e.malformedSliceIds.push(n.id);
        }
        if (!graphicsSteps.has(step) && !e.malformedSliceIds.includes(n.id)) e.malformedSliceIds.push(n.id);
      }
    }
    const crossProcessDisplayIds = [...aliasProcesses].filter(([, processes]) => processes.size > 1).map(([displayTraceId, processes]) => ({
      displayTraceId, upids:[...processes], association:'unproved'
    }));
    const candidates = [...events.values()].map(e => {
      pay(e.terminalTimes.length + e.reporterSliceIds.length + 2);
      const terminals = new Map();
      for (let i=0;i<e.terminalTimes.length;i++) {
        const ids=terminals.get(e.terminalTimes[i])??[];
        ids.push(e.successfulReporterSliceIds[i]);
        terminals.set(e.terminalTimes[i],ids);
      }
      const duplicateReporterTerminals=[...terminals].filter(([,ids])=>ids.length>1).map(([terminalTs,ids])=>({terminalTs,reporterSliceIds:ids}));
      const kind=e.kinds.includes('unsupported-work')?'unsupported-work':e.kinds.includes('display-work')?'display-work':e.kinds.includes('surface-work')?'surface-work':'reporter-only';
      return {...e,kind,duplicateReporterTerminals,
      state: new Set(e.terminalTimes).size > 1 || (e.successfulReporterSliceIds.length && e.nonPresentedReporterSliceIds.length) ? 'conflicting'
      : e.malformedSliceIds.length || e.unclosedCandidateSliceIds.length ? 'unresolved'
      : e.failedReporterSliceIds.length ? 'failed-outcome-observed'
      : kind==='surface-work' ? 'surface-evidence-observed'
      : e.successfulReporterSliceIds.length > 0
      ? e.candidateSliceIds.length ? 'successful-reporter-observed' : 'reporter-without-candidate'
      : e.candidateSliceIds.length ? 'candidate-without-successful-reporter' : 'unresolved',
    };});
    const matched = [], unmatched = [], ambiguous = [];
    const bySurface = new Map();
    for (const graphic of graphicEvidence) {
      pay(1);
      if (graphic.surface.status==='unique') {
        const group=bySurface.get(graphic.surface.value)??[];
        group.push(graphic);
        bySurface.set(graphic.surface.value,group);
      }
    }
    for (const graphic of graphicEvidence) {
      for (const member of graphic.aggregateMembers) {
        pay(1);
        if (member.status!=='unique') continue;
        const producers=bySurface.get(member.value)??[];
        reserveDiagnosticEntries(producers.length+1);
        if (!producers.length) unmatched.push({stream:'graphics',sliceId:graphic.sliceId,surfaceFrameTraceId:member.value,reason:'no-raw-surface-producer-observed'});
        else matched.push({surfaceFrameTraceId:member.value,producerSliceIds:producers.map(p=>p.sliceId),aggregateSliceId:graphic.sliceId,displayTraceId:graphic.displayTraceId,association:'raw-id-only-unproved'});
      }
      if(graphic.kind==='surface-work'&&graphic.surface.status!=='unique') {
        reserveDiagnosticEntries(1);
        unmatched.push({stream:'graphics',sliceId:graphic.sliceId,reason:'surface-identity-'+graphic.surface.status});
      }
    }
    for (const reporter of reporterEvidence) {
      pay(reporter.reasons.length+1);
      reserveDiagnosticEntries(2);
      if (!reporter.matchingTrackerCounterSliceIds.length || Object.values(reporter.fields).some(field=>field.status!=='unique')) unmatched.push({stream:'reporter',sliceId:reporter.sliceId,reasons:reporter.reasons});
      ambiguous.push({stream:'reporter',sliceId:reporter.sliceId,reason:reporter.matchingTrackerCounterSliceIds.length?'raw-sequence-match-lacks-source-target-proof':'target-lifetime-loader-source-unproved'});
    }
    for (const mapping of mappings) if(mapping.malformed) {
      reserveDiagnosticEntries(1);
      ambiguous.push({stream:'mapping',sliceId:mapping.sliceId,reason:'malformed-frame-tree-mapping'});
    }
    const stats=t[11].map(r=>{
      pay(1);
      reserveDiagnosticEntries(1);
      need(r.value!==null&&r.value!=='0','nonzero-stat');
      const known = Object.hasOwn(model.stats.knownNameClassifications,r.name) ? model.stats.knownNameClassifications[r.name] : null;
      const severityClassification = Object.hasOwn(model.stats.severityClassification,r.severity) ? model.stats.severityClassification[r.severity] : 'unknown';
      return {
        name:r.name,idx:r.idx,severity:r.severity,source:r.source,value:r.value,classification:known?.classification??severityClassification,
        nameContract:known===null?'unknown':known.severity===r.severity&&known.source===r.source?'matches-pinned-contract':'mismatched-pinned-contract'
      };
    });
    const unclosed=t[2].filter(n=>BigInt(n.dur)<0n).map(n=>n.id),unresolved=candidates.filter(e=>e.state!=='successful-reporter-observed').map(e=>({
      displayTraceId:e.displayTraceId,sliceIds:[...e.candidateSliceIds,...e.reporterSliceIds]
    }));
    const references = ids => {pay(ids.length*32+1);return ids.map(id=>'slice:'+id);};
    const gate=(status,ids,reason)=>({status,evidenceRefs:references(ids),reason});
    const timestampStats=stats.flatMap((stat,index)=>{pay(1);return stat.classification==='known-timestamp-corruption'?[index]:[];});
    const lossStats=stats.flatMap((stat,index)=>{pay(1);return ['known-timestamp-corruption','known-data-loss','known-import-error'].includes(stat.classification)?[index]:[];});
    const conflictingCandidates=candidates.filter(c=>{pay(1);return c.state==='conflicting';});
    const sourceChangeObservations=trackers.filter(tracker=>{pay(1);return tracker.sourceChangeSliceIds.length>0;}).map(tracker=>({trackId:tracker.trackId,sliceIds:tracker.sourceChangeSliceIds}));
    const gateEvidence={
      targetIdentity:gate(targetStatus==='conflicting'?'conflicting':'unknown',mappings.map(m=>m.sliceId),'complete-frame-loader-source-lifetime-chain-unproved'),
      intervalIdentity:gate(phaseStatus==='unique'?'unknown':'incomplete',phaseRows.flatMap(rows=>rows.map(n=>n.id)),'candidate-phase-pair-without-target-ownership-proof'),
      independentCandidateCensus:gate('observed',graphicEvidence.map(g=>g.sliceId),'fixed-selected-imported-families-only-not-exhaustive-population'),
      trackerAssociation:gate('unknown',trackers.flatMap(tracker=>tracker.nestedSliceIds),'sequence-equality-alone-does-not-bind-source-and-target'),
      outcomeReconciliation:gate(conflictingCandidates.length?'conflicting':unresolved.length?'incomplete':'unknown',unresolved.flatMap(u=>u.sliceIds),'raw-outcomes-and-unclosed-work-require-complete-source-reconciliation'),
      observedTrackerClosure:gate(trackers.length&&trackers.every(tracker=>tracker.observedTermination)?sourceChangeObservations.length?'unknown':'observed':'incomplete',trackers.flatMap(tracker=>tracker.sliceId===null?tracker.nestedSliceIds:[tracker.sliceId]),'observed-track-termination-is-not-producer-emission-completeness'),
      sourceEmissionCompleteness:gate('unknown',unclosed,'producer-emission-closure-not-established-by-trace-end-or-timer'),
      relevantLoss:{status:lossStats.length?'incomplete':'unknown',evidenceRefs:lossStats.map(index=>'stats:'+index),reason:lossStats.length?'known-loss-or-import-corruption-observed':'absence-of-reported-loss-is-not-proof-of-completeness'},
      timestampProvenance:{status:timestampStats.length?'conflicting':'unknown',evidenceRefs:timestampStats.map(index=>'stats:'+index),reason:timestampStats.length?'known-timestamp-corruption-observed':'feedback-timestamp-origin-not-exported'},
      physicalPresentation:gate('unknown',frameDisplayed,'no-physical-presentation-claim-in-this-software-capable-diagnostic'),
    };
    const result={
      ...base(),status:'diagnostic',selectedGraph:{
        tableRows:t.map(rows=>rows.length),slices:t[2].length,arguments:t[4].length+t[8].length,tracks:t[5].length,incompleteness
      },phase:{
        names:s.phaseNames,matchingSliceIds:phaseRows.map(ns=>ns.map(n=>n.id)),status:phaseStatus,interval:null,candidateInterval:interval,targetAssociation:'unknown'
      },target:{
        requested:s.target,status:targetStatus,mappings
      },trackers,candidates,reconciliation:{
        unresolved,crossProcessDisplayIds,frameDisplayedSliceIds:frameDisplayed,frameDisplayedEvidence,reporterEvidence,graphicEvidence,matched,unmatched,ambiguous,foreign:foreignEvidence,malformed:malformedEvidence,trackerTargetAssociation:'unproved'
      },closure:{
        openTrackerSliceIds:trackers.filter(x=>!x.observedTermination).flatMap(x=>x.sliceId===null?x.nestedSliceIds:[x.sliceId]),sourceChangeObservations,unclosedSliceIds:unclosed,candidateWithoutOutcome:unresolved,producerEmissionCompleteness:'unproved'
      },stats,gates:gateEvidence,authorities:authority()
    };
    seal(result,pay);
    originals.set(result,{
      account,wire
    });
    return result;
  }
  catch(error){
    const reason=typeof error?.message==='string'&&/^[a-z][a-z0-9-]{0,95}$/.test(error.message)?error.message:'unsupported-input';
    return Object.freeze({
      ...base(),stage,reason,selectedGraph:null,phase:null,target:null,trackers:[],candidates:[],reconciliation:null,closure:null,stats:[],gates:null,authorities:Object.freeze(authority())
    });
  }
}
