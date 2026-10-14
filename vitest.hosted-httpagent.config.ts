import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { readHostedAdmission } from './tests/support/hosted-httpagent-context.ts';

// Denial precedes discovery. The module independently repeats this admission.
readHostedAdmission();
export default defineConfig({
  resolve: { alias: [{ find: /^vitest$/, replacement: fileURLToPath(new URL('./node_modules/vitest/dist/index.js', import.meta.url)) }] },
  test: {
    include: ['tests/hosted/httpagent-aimock.hosted-sdk.test.ts'],
    fileParallelism: false, maxWorkers: 1, retry: 0, bail: 1,
    testTimeout: 180_000, hookTimeout: 30_000,
  },
});
