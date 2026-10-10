import { expect, it } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { serveAssets } from './server.js';
it('handles Chromium’s automatic favicon request without a console-generating 404', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bench-assets-'));
  await writeFile(join(directory, 'index.html'), '<title>test</title>');
  const server = await serveAssets(directory);
  try {
    expect((await fetch(server.url)).status).toBe(200);
    expect((await fetch(`${server.url}/favicon.ico`)).status).toBe(204);
    expect((await fetch(`${server.url}/missing.js`)).status).toBe(404);
  } finally { await server.close(); }
});
