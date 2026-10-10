import { defineConfig } from 'vite';
export default defineConfig({
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
  // Heap ownership diagnostics rely on ReferenceRetainedBufferOwner and retainedBuffers.
  // Serve this production bundle in calibration; avoid dev/HMR overhead.
  build: { minify: false, sourcemap: true },
});
