import { mkdir, mkdtemp, open, rename } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
export async function createArtifactInvocation(base: string): Promise<string> {
  await mkdir(base, { recursive: true });
  const directory = await mkdtemp(join(resolve(base), `calibration-${new Date().toISOString().replace(/[:.]/g, '-')}-`));
  const writer = await ArtifactWriter.create(directory);
  await writer.json('invocation.json', { schemaVersion: 1, createdAt: new Date().toISOString(), directory, status: 'running' });
  return directory;
}
export class ArtifactWriter {
  private constructor(readonly directory: string) {}
  static async create(directory: string): Promise<ArtifactWriter> { await mkdir(directory, { recursive: true }); return new ArtifactWriter(directory); }
  async append(file: string, entries: unknown[]): Promise<void> {
    const handle = await open(join(this.directory, file), 'a');
    try { if (entries.length) await handle.writeFile(entries.map(entry => JSON.stringify(entry)).join('\n') + '\n'); await handle.sync(); }
    finally { await handle.close(); }
  }
  async text(file: string, value: string): Promise<void> {
    const temporary = join(this.directory, `${file}.${randomUUID()}.tmp`); const handle = await open(temporary, 'w');
    try { await handle.writeFile(value); await handle.sync(); } finally { await handle.close(); }
    await rename(temporary, join(this.directory, file));
  }
  async json(file: string, value: unknown): Promise<void> { await this.text(file, JSON.stringify(value, null, 2) + '\n'); }
}
