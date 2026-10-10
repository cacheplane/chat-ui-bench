import type { Validation } from '@chat-ui-bench/contract';
import { ArtifactWriter } from './artifacts.js';
export const variants = ['clean', 'stall', 'delayed-display', 'scroll', 'omitted-delta', 'retention-release', 'retention-retain'] as const;
export type Variant = typeof variants[number];
export function calibrationOrder(repetitions = 3): { id: string; round: number; variant: Variant }[] {
  if (!Number.isInteger(repetitions) || repetitions < 1) throw new Error('repetitions must be a positive integer');
  return Array.from({ length: repetitions }, (_, index) => variants.map(variant => ({ id: `${index + 1}-${variant}`, round: index + 1, variant }))).flat();
}
export async function withDeadline<T>(operation: Promise<T>, ms: number, phase: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([operation, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`${phase} timed out after ${ms}ms`)), ms); })]); }
  finally { clearTimeout(timer); }
}
export const errorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);
interface OwnedBrowser { close(): Promise<void> }
export async function closeBrowserWithPage(browser: OwnedBrowser, disposePage: (() => Promise<void>) | undefined, pageBudgetMs = 9000): Promise<void> {
  try { if (disposePage) await withDeadline(disposePage(), pageBudgetMs, 'page disposal'); }
  finally { await browser.close(); }
}
interface OwnedServer { drain(): unknown[]; close(): Promise<void> }
export interface CaptureDependencies<B extends OwnedBrowser, S extends OwnedServer> {
  createServer(): Promise<S>; createBrowser(): Promise<B>;
  capture(browser: B, server: S, writer: ArtifactWriter): Promise<Validation | void>;
  setupMs?: number; disposalMs?: number;
}
/** No retries. Late factory results are also closed after a setup deadline. */
export async function runOwnedCapture<B extends OwnedBrowser, S extends OwnedServer>(directory: string, dependencies: CaptureDependencies<B, S>): Promise<Validation> {
  const writer = await ArtifactWriter.create(directory);
  await writer.append('producer-events.jsonl', []); await writer.append('page-observations.jsonl', []);
  let browser: B | undefined; let server: S | undefined; let accepting = true;
  let validation: Validation = { schemaVersion: 1, status: 'valid', reasons: [], checks: {} };
  const fail = (reason: string): void => { validation = { ...validation, status: 'failed', reasons: [...validation.reasons, reason] }; };
  const closeLate = async (name: string, resource: OwnedBrowser | OwnedServer): Promise<void> => {
    try { await withDeadline(resource.close(), dependencies.disposalMs ?? 10000, `late ${name} disposal`); }
    catch (error) { fail(`late ${name} disposal: ${errorMessage(error)}`); await writer.json('validation.json', validation); }
  };
  try {
    const setup = async (): Promise<void> => {
      const createdServer = await dependencies.createServer();
      if (!accepting) { await closeLate('server', createdServer); return; } server = createdServer;
      const createdBrowser = await dependencies.createBrowser();
      if (!accepting) { await closeLate('browser', createdBrowser); return; } browser = createdBrowser;
    };
    await withDeadline(setup(), dependencies.setupMs ?? 10000, 'setup');
    validation = await dependencies.capture(browser!, server!, writer) ?? validation;
  } catch (error) { fail(errorMessage(error)); }
  finally {
    accepting = false;
    if (server) { try { await writer.append('producer-events.jsonl', server.drain()); } catch (error) { fail(`producer log: ${errorMessage(error)}`); } }
    const cleanup = await Promise.all(([['browser', browser], ['server', server]] as const).map(async ([name, resource]) => {
      if (!resource) return null;
      try { await withDeadline(resource.close(), dependencies.disposalMs ?? 10000, `${name} disposal`); return null; }
      catch (error) { return `${name} disposal: ${errorMessage(error)}`; }
    }));
    for (const reason of cleanup) if (reason) fail(reason);
    if (server) { try { await writer.append('producer-events.jsonl', server.drain()); } catch (error) { fail(`producer final log: ${errorMessage(error)}`); } }
    await writer.json('validation.json', validation);
  }
  return validation;
}
