import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
// Every fixture below is prospective source grammar, never an observed export.
const policy = 'streamed-tracker-json-a-v1';
const bytes = (text:string) => new Uint8Array(Buffer.from(text));
const wrapper = (events:unknown[]) => JSON.stringify({traceEvents:events});
const begin = (patch:Record<string,unknown> = {}) => ({name:'FrameSequenceTrackerV3',cat:'cc,benchmark',ph:'b',ts:1,pid:10,tid:11,id2:{local:'0x1'},args:{name:'WheelScroll',args:{data:{expected:10,dropped_v3:0,dropped_v4:2,quality:'all raw quality'}},data:{values:{expected:90,sequence_number:123}}},...patch});
const end = (patch:Record<string,unknown> = {}) => ({name:'FrameSequenceTrackerV3',cat:'cc,benchmark',ph:'e',ts:4,pid:10,tid:11,id2:{local:'0x1'},args:{},...patch});
import {projectTrackerJsonACapability} from './comparison-tracker-json-a.js';
function project(input:unknown, selectedPolicy:unknown):any { return projectTrackerJsonACapability(input, selectedPolicy); }
const tuple = (text=wrapper([begin(),end()])) => project(bytes(text),policy);
describe('whole bytes tracker JSON A capability',()=>{
  it('owns exact whole wrapper reference, original diagnostics and raw tuple without runtime authority',()=>{
    const text=wrapper([begin(),end()]), result=tuple(text);
    expect(result.status).toBe('available'); expect(result.rawJson).toBe(text);
    expect(result.inputReference).toEqual({byteLength:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex'),meaning:'supplied-wrapper-bytes'});
    expect(result.records).toHaveLength(2); expect(result.records[0].event.args.args.data.quality).toBe('all raw quality');
    expect(result.records[0].event.args.data.values.expected).toBe(90);
    expect(result.rawTupleStatus).toBe('available');expect(result.rawTuple.expected.lexeme).toBe('10');expect(result.rawTuple.dropped_v3.lexeme).toBe('0');expect(result.rawTuple.dropped_v4.lexeme).toBe('2');
    expect(result.rawTuple.window).toMatchObject({unit:'microseconds',windowMeaning:'exported-tracker-window',externalPhaseAlignment:'unestablished',start:{lexeme:'1'},end:{lexeme:'4'}});
    expect(result.qualification).toEqual({source:false,capture:false,coverage:false,target:false,clock:false,runtime:false,evaluation:false,scoring:false,ranking:false,externalOriginalProvenance:'unestablished'});
    expect(result.statistics.physicalClosure).toBe('unverified');
  });
  it.each([undefined,'streamed-renderer-events-v1',{},()=>true])('requires explicit finite policy %s',value=>{
    const result=project(bytes(wrapper([])),value);expect(result.status).toBe('unavailable');expect(result).not.toHaveProperty('records');
  });
  it.each([{},[],Buffer.from('{}'),'{}',new DataView(new ArrayBuffer(2)),new Uint16Array(2)])('requires ordinary byte view %s',input=>{
    expect(project(input,policy).status).toBe('unavailable');
  });
  it('admits the inclusive complete wrapper byte cap and atomically refuses +1',()=>{
    const head='{"traceEvents":[],"padding":"', tail='"}';
    const text=head+'x'.repeat(262144-Buffer.byteLength(head+tail))+tail;
    expect(tuple(text).status).toBe('available');const result=tuple(text+' ');expect(result.status).toBe('unavailable');expect(result).not.toHaveProperty('rawJson');
  });
  it.each([' garbage',',"bad":0,}',',"dup":1,"\\u0064up":2}',',"bad":1e309}',',"bad":"'])('refuses malformed/duplicate/nonfinite/incomplete tails atomically %s',tail=>{
    const valid=wrapper([begin(),end()]);const text=tail===' garbage'?valid+tail:valid.slice(0,-1)+tail;
    const result=tuple(text);expect(result.status).toBe('unavailable');for(const key of ['records','segments','rawTuple','rawJson'])expect(result).not.toHaveProperty(key);
    expect(result.statistics.completeTotals).toBeNull();
  });
  it('refuses invalid UTF8 tail without selected data',()=>{const input=new Uint8Array([...bytes(wrapper([begin(),end()])),0xff]);const result=project(input,policy);expect(result.status).toBe('unavailable');expect(result).not.toHaveProperty('records');});
  it.each(['1.0000000000000001','1e0','1.0','2147483648','-2147483649','true','false','null','"1"','0','-1'])('retains ineligible expected token/value %s without a tuple',token=>{
    const text=wrapper([begin(),end()]).replace('"expected":10','"expected":'+token);const result=tuple(text);expect(result.status).toBe('available');expect(result.rawTupleStatus).toBe('unavailable');expect(result.records[0].rawJson).toContain('"expected":'+token);
  });
  it.each([['10','-0','0'],['10','0','20'],['2147483647','2147483647','2147483647']])('preserves raw eligible E/D3/D4 %s %s %s',(e,d3,d4)=>{
    const text=wrapper([begin(),end()]).replace('"expected":10','"expected":'+e).replace('"dropped_v3":0','"dropped_v3":'+d3).replace('"dropped_v4":2','"dropped_v4":'+d4);const result=tuple(text);
    expect(result.rawTupleStatus).toBe('available');expect([result.rawTuple.expected.lexeme,result.rawTuple.dropped_v3.lexeme,result.rawTuple.dropped_v4.lexeme]).toEqual([e,d3,d4]);
  });
  it('does not substitute nested values for absent terminal counters',()=>{const b=begin();delete (b.args.args.data as Partial<typeof b.args.args.data>).expected;const result=tuple(wrapper([b,end()]));expect(result.rawTupleStatus).toBe('unavailable');expect(result.records[0].event.args.data.values.expected).toBe(90);});
  it.each(['dropped_v3','dropped_v4'])('requires present nonnegative int32 %s',field=>{for(const token of ['-1','2147483648','1e0','null','"0"']){const result=tuple(wrapper([begin(),end()]).replace('"'+field+'":'+(field==='dropped_v3'?'0':'2'),'"'+field+'":'+token));expect(result.rawTupleStatus).toBe('unavailable');}});
  it('requires D3 <= E',()=>{const result=tuple(wrapper([begin(),end()]).replace('"dropped_v3":0','"dropped_v3":11'));expect(result.rawTupleStatus).toBe('unavailable');});
  it('admits escaped decoded numeric keys and refuses duplicate aliases',()=>{const text=wrapper([begin(),end()]).replace('"expected":10','"exp\\u0065cted":10');expect(tuple(text).rawTupleStatus).toBe('available');expect(tuple(text.replace('"exp\\u0065cted":10','"expected":10,"exp\\u0065cted":10')).status).toBe('unavailable');});
  it('accepts caller crafted selected-only syntax while declaring provenance unestablished',()=>{expect(tuple().qualification.externalOriginalProvenance).toBe('unestablished');});
});
describe('conservative exported tracker association',()=>{
  it('diagnoses concurrent WheelScroll and non-WheelScroll tracker identity reuse',()=>{
    const events=[begin(),begin({ts:2,args:{name:'TouchScroll'}}),end({ts:3}),end({ts:4})];
    const result=tuple(wrapper(events));
    expect(result.status).toBe('available');expect(result.records.map((r:any)=>r.event)).toEqual(events);
    expect(result.associationStatus).toBe('unavailable');expect(result.rawTupleStatus).toBe('unavailable');expect(result.rawTuple).toBeNull();
    expect(result.segments).toContainEqual({status:'ambiguous',beginEventIndex:1,endEventIndex:null,reason:'concurrent-tracker-identity-reuse'});
    expect(result.segments.filter((segment:any)=>segment.status==='complete')).toEqual([]);
  });
  it('preserves pending open diagnostics after concurrent tracker reuse',()=>{
    const events=[begin(),begin({ts:2,args:{name:'TouchScroll'}}),end({ts:3})];
    const result=tuple(wrapper(events));expect(result.records.map((r:any)=>r.event)).toEqual(events);expect(result.rawTuple).toBeNull();
    expect(result.segments).toContainEqual({status:'open',beginEventIndex:0,endEventIndex:null,reason:'unclosed-exported-begin'});
    expect(result.segments).toContainEqual({status:'ambiguous',beginEventIndex:1,endEventIndex:2,reason:'concurrent-tracker-identity-reuse'});
    expect(result.segments.some((segment:any)=>segment.status==='complete')).toBe(false);
  });
  it('does not restore confident association after a reused identity stack becomes empty',()=>{
    const events=[begin(),begin({ts:2,args:{name:'TouchScroll'}}),end({ts:3}),end({ts:4}),begin({ts:5}),end({ts:6})];
    const result=tuple(wrapper(events));expect(result.records.map((r:any)=>r.event)).toEqual(events);expect(result.associationStatus).toBe('unavailable');expect(result.rawTuple).toBeNull();
    expect(result.segments).toContainEqual({status:'ambiguous',beginEventIndex:4,endEventIndex:5,reason:'concurrent-tracker-identity-reuse'});
    expect(result.segments.some((segment:any)=>segment.status==='complete')).toBe(false);
  });
  it('uses the same identity stack for nested exact Frame names',()=>{
    const frames=['Frame','Frame ','Frame   '];let ts=2;const nested=frames.flatMap(name=>[{...begin({name,ts:ts++}),args:{data:{values:{expected:500}}}},{...end({name,ts:ts++})}]);
    const result=tuple(wrapper([begin(),...nested,end({ts:9})]));expect(result.rawTupleStatus).toBe('available');expect(result.segments.filter((s:any)=>s.status==='complete')).toHaveLength(4);
  });
  it.each(['benchmark,cc','cc,benchmark'])('accepts exact category %s',cat=>{expect(tuple(wrapper([begin({cat}),end({cat})])).rawTupleStatus).toBe('available');});
  it('accepts global identity and exact present empty scope',()=>{const b=begin({id:'ABC',scope:''}),e=end({id:'ABC',scope:''});delete (b as any).id2;delete (e as any).id2;expect(tuple(wrapper([b,e])).rawTupleStatus).toBe('available');});
  it.each([
    [begin()], [end()], [begin(),end(),end()], [begin(),end(),begin({ts:5})], [begin(),end(),begin({ts:5}),end({ts:6})],
    [begin(),end({ts:1})],[begin(),end({ts:0})],[begin({ph:'n'})],[begin({ph:'B'}),end()],
    [begin({name:'FrameSequenceTrackerV4'}),end({name:'FrameSequenceTrackerV4'})],
    [begin(),end({name:'FrameSequenceTrackerOther'})], [begin(),end({cat:'benchmark,cc'})],
    [begin({cat:'cc,cc,benchmark'}),end({cat:'cc,cc,benchmark'})],[begin({cat:' cc,benchmark'}),end({cat:' cc,benchmark'})],
    [begin({id:'extra'}),end()],[begin({id2:{global:'x'}}),end()],[begin({id2:{local:''}}),end()],
    [begin(),end({pid:12})],[begin(),end({tid:12})],[begin(),end({scope:''})],
    [begin(),end({args:null})],[begin(),end({args:{expected:10}})],
    [begin({args:{args:{data:{expected:10,dropped_v3:0,dropped_v4:0}}}}),end()],
    [begin(),begin({name:'Frame',ts:2}),end({ts:3}),end({name:'Frame',ts:4})]
  ].map(events=>({events})))('retains ambiguous, open or unsupported observations without choosing a tuple %#',({events})=>{
    const result=tuple(wrapper(events));expect(result.status).toBe('available');expect(result.records).toHaveLength(events.length);expect(result.rawTupleStatus).toBe('unavailable');expect(result.rawTuple).toBeNull();
  });
  it.each(['1e0','1.0','1.0000000000000001','9223372036854775808','-9223372036854775809','null','"1"'])('rejects unsupported exact timestamp %s',token=>{const result=tuple(wrapper([begin(),end()]).replace('"ts":1','"ts":'+token));expect(result.rawTupleStatus).toBe('unavailable');});
  it('compares timestamps outside Number safe range exactly',()=>{const text=wrapper([begin(),end()]).replace('"ts":1','"ts":9223372036854775806').replace('"ts":4','"ts":9223372036854775807');expect(tuple(text).rawTupleStatus).toBe('available');});
  it.each(['1e0','2147483648','"10"','null'])('requires int32 lexical pid/tid %s',token=>{for(const field of ['pid','tid'])expect(tuple(wrapper([begin(),end()]).replace('"'+field+'":'+(field==='pid'?'10':'11'),'"'+field+'":'+token)).rawTupleStatus).toBe('unavailable');});
  it('does not split a global identity collision by pid/tid',()=>{const events=[begin({id:'x'}),end({id:'x'}),begin({id:'x',pid:20,ts:5}),end({id:'x',pid:20,ts:6})];for(const event of events)delete (event as any).id2;expect(tuple(wrapper(events)).rawTupleStatus).toBe('unavailable');});
  it('enforces UTF8 identity and optional scope boundaries',()=>{for(const patch of [{id2:{local:'é'.repeat(129)}},{scope:'é'.repeat(2049)},{scope:null},{id:1},{id2:{local:'x',global:'y'}}])expect(tuple(wrapper([begin(patch),end(patch)])).rawTupleStatus).toBe('unavailable');});
});

describe('tracker bounded output and retained diagnostics',()=>{
  it('refuses repeated output representations atomically under the wrapper input cap',()=>{
    const text=wrapper([begin({opaque:'x'.repeat(180000)}),end()]);expect(Buffer.byteLength(text)).toBeLessThan(262144);
    const result=tuple(text);expect(result.status).toBe('unavailable');expect(result.failure).toBe('output-string-capacity');
    for(const key of ['records','segments','rawTuple','rawJson'])expect(result).not.toHaveProperty(key);
    expect(result.inputReference.byteLength).toBe(Buffer.byteLength(text));expect(result.statistics.physicalClosure).toBe('unverified');
  });
  it('retains all selected families, qualities and competing open records',()=>{
    const events=[{name:'ignored',ph:'I'},begin(),end(),begin({name:'FrameSequenceTrackerFuture',ts:5,args:{name:'Other',quality:{newField:true}}}),{name:'bench:comparison:mark',ph:'I'}];
    const result=tuple(wrapper(events));expect(result.status).toBe('available');expect(result.rawTuple).toBeNull();expect(result.records.map((r:any)=>r.eventIndex)).toEqual([1,2,3,4]);expect(result.records[2].event.args.quality.newField).toBe(true);
  });
  it('keeps absent counters distinct from zero and exact negative zero tokens',()=>{
    const result=tuple(wrapper([begin(),end()]).replace('"dropped_v3":0','"dropped_v3":-0'));expect(result.rawTuple.dropped_v3.lexeme).toBe('-0');
    const missing=tuple(wrapper([begin(),end()]).replace(',"dropped_v3":0',''));expect(missing.rawTuple).toBeNull();expect(missing.records[0].numberTokens.some((t:any)=>t.slot==='dropped_v3')).toBe(false);
  });
  it('admits exact maximum identity/scope UTF8 widths',()=>{
    const patch={id2:{local:'é'.repeat(128)},scope:'é'.repeat(2048)};expect(tuple(wrapper([begin(patch),end(patch)])).rawTupleStatus).toBe('available');
  });
  it('withholds a tuple for conflicting reuse without repairing order',()=>{
    const result=tuple(wrapper([begin(),begin({ts:2}),end({ts:3}),end({ts:4})]));expect(result.rawTuple).toBeNull();expect(result.records).toHaveLength(4);
  });
});

describe('whole wrapper inherited scanner admission',()=>{
  it('atomically refuses reachable per-event work overflow after an eligible pair',()=>{
    const overflow='{"name":"FrameSequenceTrackerOther","ph":"n","a":['+'0,'.repeat(65536)+'0]}';
    const text=wrapper([begin(),end()]).slice(0,-2)+','+overflow+']}';expect(Buffer.byteLength(text)).toBeLessThan(262144);
    const result=tuple(text);expect(result.status).toBe('unavailable');expect(result.failure).toBe('eventWorkUnits');expect(result.statistics.completeTotals).toBeNull();expect(result).not.toHaveProperty('records');expect(result).not.toHaveProperty('rawTuple');
  });
  it('refuses a reachable number token overflow in a discarded tail',()=>{
    const text=wrapper([begin(),end()]).slice(0,-1)+',"tail":0.'+'0'.repeat(255)+'}';
    const result=tuple(text);expect(result.status).toBe('unavailable');expect(result.failure).toBe('numberTokenBytes');expect(result).not.toHaveProperty('records');
  });
  it('preserves whole wrapper bytes around ignored events rather than manufacturing selected wrappers',()=>{
    const text=' {"before":"é😀","traceEvents":[{"name":"ignore","ph":"I","unknown":{"raw":true}},'+JSON.stringify(begin())+','+JSON.stringify(end())+'],"after":{"unknown":true}}\n';
    const result=tuple(text);expect(result.rawJson).toBe(text);expect(result.records.map((r:any)=>r.eventIndex)).toEqual([1,2]);
    for(const record of result.records)expect(Buffer.from(text).subarray(record.startUtf8,record.endUtf8).toString()).toBe(record.rawJson);
  });
});
