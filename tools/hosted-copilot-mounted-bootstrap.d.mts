/** Inert supplied-data exports only; importing the bootstrap does not run a CLI action. */
import type {RestoredHistoryDiagnosticPort} from '../apps/copilotkit/src/geometry.ts';
export function createRestoredHistoryDiagnosticPort(write:(bytes:Uint8Array,callback:(error?:Error|null)=>void)=>boolean):RestoredHistoryDiagnosticPort;
export function frontendSettingsCommitment(source: unknown): Readonly<{
  tuple: readonly (readonly [string, string])[];
  sha256: string;
}>;
export function validateNativePrerequisiteProvider(expected: unknown, run: unknown, artifact: unknown): Readonly<{
  sourceSha: string;
  qualification: false;
}>;
/** A projection is supplied data, not validated global closure or runtime authority. */
export function nativeGlobalClosureInput(parentCommand: unknown, partial: unknown): unknown;
