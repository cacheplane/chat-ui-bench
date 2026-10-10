import {describe, expect, it} from 'vitest';
import {parseLongThreadArgs,validateLongThreadConfiguration} from './long-thread-cli.js';
describe('long thread CLI configuration seam', () => {
  it('rejects programmatic profile, matrix and purpose changes through the shared pure validator',()=>{
    const base=parseLongThreadArgs(['--out','/tmp/x','--mode','headless','--rounds','1']); if(base.help) throw new Error('unexpected help');
    for(const patch of [{purpose:'publication'},{configuration:{...base.configuration,adapterProfiles:['threadplane-langgraph-custom-transport','other']}},{configuration:{...base.configuration,adapterProfiles:['other']}},{configuration:{...base.configuration,caseOrder:base.configuration.caseOrder.slice(1)}},{configuration:{...base.configuration,caseOrder:[...base.configuration.caseOrder].reverse()}},{configuration:{...base.configuration,rounds:4}}]) expect(()=>validateLongThreadConfiguration({...base,...patch} as typeof base)).toThrow();
  });
  it('rejects a fourth headless round and unsupported adapters', () => {
    expect(() => parseLongThreadArgs(['--out', '/tmp/x', '--mode', 'headless', '--rounds', '4'])).toThrow();
    expect(() => parseLongThreadArgs(['--out', '/tmp/x', '--adapter', 'other'])).toThrow();
  });
  it('derives the complete publication order and fixed budgets', () => {
    const result = parseLongThreadArgs(['--adapter', 'threadplane-langgraph-custom-transport', '--mode', 'headed', '--rounds', '3', '--seed', '1', '--out', '/tmp/evidence']);
    expect(result).toMatchObject({help: false, purpose: 'publication', out: '/tmp/evidence', configuration: {rounds: 3, seed: 1, adapterProfiles: ['threadplane-langgraph-custom-transport'], deadlinesMs: {historySetup: 60000, replay: 30000, disposal: 10000}}});
    if (!result.help) expect(result.configuration.caseOrder).toHaveLength(12);
  });
  it('headless is explicit conformance and may run a complete single round', () => {
    expect(parseLongThreadArgs(['--out', 'relative/root', '--mode', 'headless', '--rounds', '1'])).toMatchObject({purpose: 'conformance', configuration: {rounds: 1}});
  });
  it('help is pure and does not require an output directory', () => {expect(parseLongThreadArgs(['--help'])).toEqual({help: true});});
  it.each([['--seed', '-1'], ['--seed', '1.5'], ['--seed', '1e2'], ['--rounds', '0'], ['--rounds', '1'], ['--mode', 'other'], ['--cases', '0'], ['--seed', '1', '--seed', '2'], ['--out'], ['--seed', '9007199254740992']])('rejects noncanonical arguments %j', args => {
    expect(() => parseLongThreadArgs([...args, '--out', '/tmp/result'])).toThrow();
  });
});
