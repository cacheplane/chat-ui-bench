import { expect, it } from 'vitest';
import { parseRendererPresentation } from './presentation.js';
import { loadPresentationFixture, presentationFixtures } from './presentation-fixtures.test-helper.js';
it('preserves legacy topology-before-phase error precedence', () => {
  const trace = loadPresentationFixture(presentationFixtures[0]!);
  const result = parseRendererPresentation({trace, target: {appURL: 'wrong', frameId: 'wrong'}, phases: [{phase: 'composer-input', instanceId: 'bad', startMark: 'missing', endMark: 'missing'}]});
  expect(result).toEqual({presentation: {status: 'unavailable', reason: 'Unsupported renderer presentation trace: Target URL/frame does not resolve to the primary root document'}});
});

for (const golden of presentationFixtures) it.each(['streaming-auto-follow', 'composer-input', 'gesture-scroll', 'return-to-bottom'] as const)(`${golden.name}: legacy own phase %s`, phase => {
  const trace = loadPresentationFixture(golden);
  const result = parseRendererPresentation({trace, target: {appURL: 'file:///private/tmp/chat-ui-bench-presentation-spike/v3-calibration/fixture.html', frameId: golden.expectedFromActualBundledHandler.mainFrameId}, phases: [{phase, instanceId: '0', startMark: 'spike:start', endMark: 'spike:end'}]});
  expect(result.presentation.status).toBe('available');
});
it.each(['', 'unknown', 'setup', 'validation', 'disposal', 'streaming-follow', 'history-reading', 'return-to-response'])('legacy wrapper rejects foreign phase %s', phase => {
  const golden = presentationFixtures[0]!, trace = loadPresentationFixture(golden);
  const input = {trace, target: {appURL: 'file:///private/tmp/chat-ui-bench-presentation-spike/v3-calibration/fixture.html', frameId: golden.expectedFromActualBundledHandler.mainFrameId}, phases: [{phase: 'composer-input' as const, instanceId: '0', startMark: 'spike:start', endMark: 'spike:end'}]};
  Object.assign(input.phases[0]!, {phase});
  expect(parseRendererPresentation(input)).toEqual({presentation: {status: 'unavailable', reason: expect.any(String)}});
});
