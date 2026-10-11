import {performance} from 'node:perf_hooks';
import {comparisonDeadlineSchema, type ComparisonDeadline} from '@chat-ui-bench/contract';
export type ComparisonOwnershipStage = 'setup' | 'replay' | 'disposal';
export const COMPARISON_STAGE_BUDGETS = {setup: 60000, replay: 30000, disposal: 10000} as const;
export interface ComparisonOwnedResource {
  name: string;
  close(): Promise<void>;
  /** A real containment check may establish safety despite an auxiliary close failure. */
  verifyContained?(): Promise<boolean>;
}
export interface ComparisonOwnershipContext {
  readonly signal: AbortSignal; readonly generation: number; readonly stage: ComparisonOwnershipStage;
  readonly startedAtHostMs: number; readonly deadlineAtHostMs: number;
  remainingMs(): number; assertActive(): void; adopt(resource: ComparisonOwnedResource): Promise<void>;
}
export interface ComparisonOwnershipFailure {stage: ComparisonOwnershipStage; timestampMs: number; message: string; stack: string | null; resource: string | null}
export type ComparisonStageResult<T> = {status: 'complete'; value: T; deadline: ComparisonDeadline} | {status: 'failed' | 'expired'; deadline: ComparisonDeadline};
export interface ComparisonOwnershipClock {now(): number; setTimer?: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>; clearTimer?: (timer: ReturnType<typeof setTimeout>) => void}
interface ResourceRecord {resource: ComparisonOwnedResource; close: Promise<void> | null; failure: ComparisonOwnershipFailure | null}
function message(error: unknown) {
  if (error instanceof Error) {const rendered = error.message || error.name; return rendered === '' ? 'Error with empty message and name' : rendered;}
  return error === '' ? 'Thrown empty string' : String(error);
}
/** Races report deadlines; tracked operations and adopted resources establish actual settlement separately. */
export class ComparisonOwnership {
  private readonly clock: ComparisonOwnershipClock;
  private generation = 0;
  private active = false;
  private disposing = false;
  private disposed = false;
  private disposalExpired = false;
  private unsafeClose = false;
  private pending = new Set<Promise<unknown>>();
  private resources: ResourceRecord[] = [];
  private operationFailures: ComparisonOwnershipFailure[] = [];
  private waiters: (() => void)[] = [];
  readonly deadlines: ComparisonDeadline[] = [];
  constructor(clock: ComparisonOwnershipClock = {now: () => performance.now()}) {this.clock = clock;}
  now() {return this.clock.now();}
  get failures(): ComparisonOwnershipFailure[] {return [...this.operationFailures, ...this.resources.flatMap(r => r.failure ? [r.failure] : [])];}
  get unsafeOutstanding() {return this.pending.size > 0 || this.resources.some(r => r.close === null);}
  get canContinue() {return this.disposed && !this.disposalExpired && !this.unsafeClose && !this.unsafeOutstanding;}
  get ownershipSettled(): Promise<void> {return this.pending.size === 0 && (!this.disposing || this.resources.every(r => r.close !== null)) ? Promise.resolve() : new Promise(resolve => this.waiters.push(resolve));}
  private notify() {if (this.pending.size === 0 && (!this.disposing || this.resources.every(r => r.close !== null))) for (const resolve of this.waiters.splice(0)) resolve();}
  private track<T>(task: Promise<T>): Promise<T> {this.pending.add(task); void task.then(() => {this.pending.delete(task); this.notify();}, () => {this.pending.delete(task); this.notify();}); return task;}
  private failure(stage: ComparisonOwnershipStage, error: unknown, resource: string | null): ComparisonOwnershipFailure {return {stage, timestampMs: this.now(), message: message(error), stack: error instanceof Error ? error.stack ?? null : null, resource};}
  private startClose(record: ResourceRecord): Promise<void> {
    if (record.close) return record.close;
    const close = (async () => {
      try {await record.resource.close();} catch (error) {
        record.failure = this.failure('disposal', error, record.resource.name);
        let contained = false;
        if (record.resource.verifyContained) {try {contained = await record.resource.verifyContained();} catch {contained = false;}}
        if (!contained) this.unsafeClose = true;
      }
    })();
    record.close = this.track(close); return record.close;
  }
  private async adopt(resource: ComparisonOwnedResource, generation: number, deadlineAtHostMs: number): Promise<void> {
    if (!resource.name || typeof resource.close !== 'function') throw new Error('Owned resource needs a name and close operation');
    if (this.resources.some(r => r.resource === resource)) throw new Error('Resource was already adopted');
    const record: ResourceRecord = {resource, close: null, failure: null}; this.resources.push(record);
    if (this.disposing || !this.active || generation !== this.generation || this.now() >= deadlineAtHostMs) {await this.startClose(record); throw new Error('Late resource was closed after generation revocation');}
  }
  async run<T>(stage: Exclude<ComparisonOwnershipStage, 'disposal'>, operation: (context: ComparisonOwnershipContext) => Promise<T>): Promise<ComparisonStageResult<T>> {
    if (this.active || this.disposing || this.pending.size) throw new Error('Cannot start stage with active or unsettled ownership');
    if (this.deadlines.some(d => d.stage === stage)) throw new Error('Stage cannot be retried');
    const generation = ++this.generation, controller = new AbortController(); this.active = true;
    const startedAtHostMs = this.now(), budgetMs = COMPARISON_STAGE_BUDGETS[stage], deadlineAtHostMs = startedAtHostMs + budgetMs;
    const context: ComparisonOwnershipContext = {signal: controller.signal, generation, stage, startedAtHostMs, deadlineAtHostMs, remainingMs: () => Math.max(0, deadlineAtHostMs - this.now()), assertActive: () => {
      if (!this.active || this.generation !== generation || controller.signal.aborted || this.now() >= deadlineAtHostMs) throw new Error('Ownership generation revoked or deadline expired');
    }, adopt: resource => this.adopt(resource, generation, deadlineAtHostMs)};
    type Outcome = {kind: 'complete'; value: T} | {kind: 'failed'; error: unknown} | {kind: 'expired'};
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expiry = new Promise<Outcome>(resolve => {timer = (this.clock.setTimer ?? setTimeout)(() => {this.active = false; this.operationFailures.push(this.failure(stage, new Error(`${stage} absolute deadline expired`), null)); controller.abort(); resolve({kind: 'expired'});}, budgetMs);});
    let operationPromise: Promise<T>;
    try {operationPromise = operation(context);} catch (error) {operationPromise = Promise.reject(error);}
    let lateDeadline: ComparisonDeadline | null = null, operationFinishedAt: number | null = null;
    const finished = () => {operationFinishedAt = this.now(); if (lateDeadline) lateDeadline.finishedAtHostMs = operationFinishedAt;};
    const settled = this.track(operationPromise.then<Outcome, Outcome>(value => {finished(); return {kind: 'complete', value};}, error => {finished(); this.operationFailures.push(this.failure(stage, error, null)); return {kind: 'failed', error};}));
    const outcome = await Promise.race([settled, expiry]);
    if (timer !== undefined) (this.clock.clearTimer ?? clearTimeout)(timer);
    this.active = false; controller.abort();
    const finishedAtHostMs = operationFinishedAt, expired = outcome.kind === 'expired' || this.now() > deadlineAtHostMs;
    const status = expired ? 'expired' : outcome.kind === 'failed' ? 'failed' : 'complete';
    const deadline = comparisonDeadlineSchema.parse({stage, budgetMs, startedAtHostMs, deadlineAtHostMs, finishedAtHostMs, outcome: status, ...(status === 'complete' ? {} : {reason: expired ? `${stage} absolute deadline expired` : outcome.kind === 'failed' ? message(outcome.error) : `${stage} failed`})});
    this.deadlines.push(deadline);
    if (expired && this.pending.has(settled)) lateDeadline = deadline;
    return status === 'complete' && outcome.kind === 'complete' ? {status, value: outcome.value, deadline} : {status: status === 'complete' ? 'failed' : status, deadline};
  }
  async dispose(): Promise<ComparisonStageResult<void>> {
    if (this.disposing) throw new Error('Disposal cannot be retried');
    this.disposing = true; this.active = false; ++this.generation;
    const startedAtHostMs = this.now(), budgetMs = COMPARISON_STAGE_BUDGETS.disposal, deadlineAtHostMs = startedAtHostMs + budgetMs;
    for (const resource of this.resources) this.startClose(resource);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expiry = new Promise<'expired'>(resolve => {timer = (this.clock.setTimer ?? setTimeout)(() => {this.operationFailures.push(this.failure('disposal', new Error('disposal absolute deadline expired with unsettled ownership'), null)); resolve('expired');}, budgetMs);});
    let lateDeadline: ComparisonDeadline | null = null, settledAt: number | null = null;
    const settlement = this.ownershipSettled.then(() => {settledAt = this.now(); if (lateDeadline) lateDeadline.finishedAtHostMs = settledAt; return 'settled' as const;});
    const outcome = await Promise.race([settlement, expiry]);
    if (timer !== undefined) (this.clock.clearTimer ?? clearTimeout)(timer);
    const finishedAtHostMs = settledAt; this.disposalExpired = outcome === 'expired' || this.now() > deadlineAtHostMs; this.disposed = true;
    const status = this.disposalExpired ? 'expired' : this.resources.some(r => r.failure) ? 'failed' : 'complete';
    const deadline = comparisonDeadlineSchema.parse({stage: 'disposal', budgetMs, startedAtHostMs, deadlineAtHostMs, finishedAtHostMs, outcome: status, ...(status === 'complete' ? {} : {reason: this.disposalExpired ? 'disposal absolute deadline expired with unsettled ownership' : 'Owned resource cleanup failed'})}); this.deadlines.push(deadline);
    if (settledAt === null) lateDeadline = deadline;
    return status === 'complete' ? {status, value: undefined, deadline} : {status, deadline};
  }
}
