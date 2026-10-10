import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { createCalibrationFixture, validateFixture, PRESENTATION_CONTRACT_VERSION, type Fixture } from '@chat-ui-bench/contract';
import { createReplayServer } from '@chat-ui-bench/producer';
import { calibrationOrder, closeBrowserWithPage, runOwnedCapture, withDeadline, type Variant } from './calibrate.js';
import { createArtifactInvocation, ArtifactWriter } from './artifacts.js';
import { serveAssets } from './server.js';
import { captureRepetition } from './capture.js';
export interface CalibrationOptions { mode: 'headless' | 'headed'; repetitions: number; out: string; fixture?: Fixture; selectedVariants?: readonly Variant[] }
export async function runCalibration(options: CalibrationOptions): Promise<string> {
  const fixture = validateFixture(options.fixture ?? createCalibrationFixture());
  const order = calibrationOrder(options.repetitions).filter(run => !options.selectedVariants || options.selectedVariants.includes(run.variant));
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const assetDirectory = join(root, 'apps/reference/dist');
  const directory = await createArtifactInvocation(options.out); const invocation = await ArtifactWriter.create(directory);
  await invocation.json('invocation.json', { schemaVersion: 1, collectorVersion: PRESENTATION_CONTRACT_VERSION, directory, mode: options.mode, order, status: 'running', repetitions: options.repetitions });
  const assets = await withDeadline(serveAssets(assetDirectory), 10000, 'asset server setup');
  const results = [];
  try {
    for (const run of order) {
      const path = join(directory, 'repetitions', run.id);
      let setupStarted = Date.now();
      const result = await runOwnedCapture(path, {
        createServer: () => { setupStarted = Date.now(); return createReplayServer({ fixture, repetition: run.id }); },
        createBrowser: async () => {
          const handle = await chromium.launch({ headless: options.mode === 'headless', args: ['--enable-automation'], timeout: 10000 });
          const owned = { handle, disposePage: undefined as (() => Promise<void>) | undefined, close: () => closeBrowserWithPage(handle, owned.disposePage) };
          return owned;
        },
        capture: (browser, server, writer) => captureRepetition({ browser: browser.handle, isolatedBrowserProcess: true, server, writer, fixture, run, mode: options.mode, root, assetDirectory, assetURL: assets.url, setupRemainingMs: Math.max(1, 10000 - (Date.now() - setupStarted)), registerDisposal: callback => { browser.disposePage = callback; } }),
      });
      results.push({ ...run, status: result.status });
      await invocation.json('invocation.json', { schemaVersion: 1, collectorVersion: PRESENTATION_CONTRACT_VERSION, directory, mode: options.mode, order, status: 'running', repetitions: options.repetitions, results });
    }
  } finally { await withDeadline(assets.close(), 10000, 'asset server disposal'); }
  await invocation.json('invocation.json', { schemaVersion: 1, collectorVersion: PRESENTATION_CONTRACT_VERSION, directory, mode: options.mode, order, status: results.some(result => result.status === 'failed') ? 'failed' : 'complete', repetitions: options.repetitions, results });
  return directory;
}
