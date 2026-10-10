import { z } from 'zod';
import { replayEventSchema } from './fixture.js';
import type { LongThreadAdapterHost, ComparisonPhase } from './comparison.js';
const base = { timestampMs: z.number().finite().nonnegative(), sequence: z.number().int().nonnegative() };
/** Transport evidence only. These records never establish product-applied state. */
export const adapterCaptureEventSchema = z.discriminatedUnion('kind', [
    z.strictObject({ ...base, kind: z.literal('receipt'), data: z.strictObject({ event: replayEventSchema }) }),
    z.strictObject({ ...base, kind: z.literal('translation'), data: z.strictObject({ protocolEvent: z.string().min(1), messageId: z.string().min(1), text: z.string() }) }),
]).superRefine((event, ctx) => { if (event.kind === 'receipt' && event.sequence !== event.data.event.sequence)
    ctx.addIssue({ code: 'custom', message: 'Receipt sequence disagrees with actual event' }); });
export type AdapterCaptureEvent = z.infer<typeof adapterCaptureEventSchema>;
export interface ActiveDomSnapshot {
    readonly activeMessageId: string | null;
    readonly mounted: boolean;
    readonly text: string | null;
    readonly mountedMessageCount: number;
}
export const activeHostSnapshotSchema = z.strictObject({activeMessageId: z.string().min(1).nullable(), hostMounted: z.boolean()}).refine(v => v.activeMessageId !== null || !v.hostMounted, 'Absent active message cannot have a mounted host');
export type ActiveHostSnapshot = z.infer<typeof activeHostSnapshotSchema>;
export interface AdapterPhaseBoundary {
    readonly phase: ComparisonPhase;
    readonly instanceId: string;
    readonly boundary: 'start' | 'end';
    readonly timestampMs: number;
}
/** Additive bridge: phase marks use the page clock and locally unique instance identities. */
export interface LongThreadCaptureHost extends LongThreadAdapterHost {
    drainCaptureEvents(): readonly AdapterCaptureEvent[];
    markPhase(phase: ComparisonPhase, boundary: 'start' | 'end'): AdapterPhaseBoundary;
    readActiveDom(): ActiveDomSnapshot;
    /** Actual message host, independent of text-content mount; later capture must implement this probe. */
    readActiveHost?(): ActiveHostSnapshot;
    waitForReplay(): Promise<void>;
}
