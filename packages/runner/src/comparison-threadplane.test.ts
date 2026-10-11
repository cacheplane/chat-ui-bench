import {test, expect} from 'vitest';
const api = await import('./comparison-threadplane.js').catch(() => ({})) as typeof import('./comparison-threadplane.js');
test('profile resolver requires a genuine completed session', async () => {
  expect(typeof api.resolveComparisonThreadplaneProfile).toBe('function');
  await expect(api.resolveComparisonThreadplaneProfile({} as never)).rejects.toThrow('genuine');
  await expect(api.recheckComparisonThreadplaneProfile({} as never)).rejects.toThrow('genuine');
});
