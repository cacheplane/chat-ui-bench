import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['packages/runner/src/browser.test.ts'], testTimeout: 15000, hookTimeout: 180000, fileParallelism: false } });
