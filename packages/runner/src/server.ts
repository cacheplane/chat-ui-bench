import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, resolve, extname, sep } from 'node:path';
export async function serveAssets(directory: string): Promise<{ url: string; close(): Promise<void> }> {
  const base = resolve(directory);
  const server = createServer(async (request, response) => {
    const name = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    // Headed Chromium requests a favicon even when the reference declares none.
    if (name === '/favicon.ico') { response.writeHead(204); response.end(); return; }
    const file = resolve(join(base, name === '/' ? 'index.html' : name));
    if (!file.startsWith(base + sep)) { response.writeHead(403); response.end(); return; }
    try {
      const content = await readFile(file);
      response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' } as Record<string, string>)[extname(file)] ?? 'application/octet-stream');
      response.setHeader('Cache-Control', 'no-store'); response.end(content);
    } catch { response.writeHead(404); response.end(); }
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(); }); });
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
  return { url: `http://127.0.0.1:${address.port}`, close: async () => { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); } };
}
