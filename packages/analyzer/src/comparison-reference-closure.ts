import type {z} from 'zod';
import type {comparisonSchemasForVersionPair} from '@chat-ui-bench/contract';
import type {ComparisonByteFact, ComparisonLoadingIssue, ComparisonRawRole} from './comparison-load.js';

type Schemas = ReturnType<typeof comparisonSchemasForVersionPair>;
type Evidence = z.output<Schemas['comparisonEvidenceSchema']>;
type RawInventory = z.output<Schemas['comparisonRawInventorySchema']>;
type Capture = z.output<Schemas['comparisonCaptureStatusSchema']>;
type Acquisition = z.output<Schemas['comparisonProvenanceAcquisitionSchema']>;
type Validation = z.output<Schemas['comparisonValidationSchema']>;
export interface ComparisonReferenceLane {
  status: 'complete' | 'partial' | 'unavailable'; reportedStatus: string | null;
  issues: ComparisonLoadingIssue[]; additionalIssueCount: number;
}
export interface ComparisonSlotReferences {
  inventory: ComparisonReferenceLane; capture: ComparisonReferenceLane; acquisition: ComparisonReferenceLane;
}
export interface ComparisonReferenceInput {
  inventory: {path: 'evidence.json' | 'raw-inventory.json'; value: Evidence | RawInventory} | null;
  capture: Capture | null; acquisition: Acquisition | null; validation: Validation | null;
  row: z.output<Schemas['comparisonCaptureInvocationSchema']>['runs'][number];
  files: Map<string, {actual: ComparisonByteFact | null; seal: ComparisonByteFact | null; role: ComparisonRawRole}>;
  absent: {path: string; reason: string}[];
}
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const factEquals = (a: ComparisonByteFact | null, b: ComparisonByteFact | null): boolean => a !== null && b !== null && a.byteLength === b.byteLength && a.sha256 === b.sha256;
function lane(reportedStatus: string | null): ComparisonReferenceLane {return {status: reportedStatus === null ? 'unavailable' : 'complete', reportedStatus, issues: [], additionalIssueCount: 0};}
function issue(target: ComparisonReferenceLane, path: string, reason: string, kind: 'membership' | 'integrity' = 'membership'): void {
  if (target.status !== 'unavailable') target.status = 'partial';
  if (target.issues.length < 32) target.issues.push({kind, path, role: 'slot-json', reason}); else target.additionalIssueCount++;
}
export function unavailableComparisonReferences(reason: string): ComparisonSlotReferences {
  const result = {inventory: lane(null), capture: lane(null), acquisition: lane(null)};
  for (const target of Object.values(result)) issue(target, '.', reason);
  return result;
}
const derived = new Set(['evidence.json', 'raw-inventory.json', 'results.json', 'metrics.json', 'summary.md', 'report.json', 'report.html', 'report.md']);
const acquisitionPayload = (path: string): boolean => (path === 'provenance/build-evidence.json' || path === 'instrumentation/build-evidence.json'
  || path.startsWith('provenance/source/') || path.startsWith('provenance/assets/') || path.startsWith('provenance/packages/') && path.endsWith('/package.json')
  || path.startsWith('instrumentation/source/') || path.startsWith('instrumentation/compiled/'));

/** Relations over original admitted data only; callers retain filesystem ownership. */
export function checkComparisonReferences(input: ComparisonReferenceInput): ComparisonSlotReferences {
  const result = {inventory: lane(input.inventory?.value.status ?? null), capture: lane(input.capture?.status ?? null), acquisition: lane(input.acquisition?.status ?? null)};
  const {inventory, capture, acquisition, files} = input;
  if (!inventory) issue(result.inventory, '.', 'Exactly one parsed original inventory is required');
  else {
    const ownFact = files.get(inventory.path);
    if (!ownFact || !factEquals(ownFact.actual, ownFact.seal)) issue(result.inventory, inventory.path, 'Inventory original is not bound to dataset seal', 'integrity');
    const names = inventory.value.files.map(file => file.path), seen = new Set<string>();
    for (const [index, file] of inventory.value.files.entries()) {
      if (seen.has(file.path)) issue(result.inventory, file.path, 'Duplicate inventory reference'); seen.add(file.path);
      if (index > 0 && file.path <= names[index - 1]!) issue(result.inventory, file.path, 'Inventory references are not in canonical ascending order');
      if (derived.has(file.path.split('/').at(-1)!)) issue(result.inventory, file.path, 'Inventory reference is self or derived output');
      const original = files.get(file.path);
      if (!original || file.path === inventory.path) issue(result.inventory, file.path, 'Inventory reference is not an admitted same-slot payload');
      else if (!factEquals(file, original.actual) || !factEquals(file, original.seal)) issue(result.inventory, file.path, 'Inventory digest differs from measured original or dataset seal', 'integrity');
      if (original?.role === 'temporary' && (file.status !== 'partial' || !(file.reason === 'incomplete atomic temporary' || file.reason?.startsWith('incomplete atomic temporary: ')))) issue(result.inventory, file.path, 'Temporary payload must preserve incomplete atomic temporary reason');
    }
    for (const path of files.keys()) if (path !== inventory.path && !seen.has(path)) issue(result.inventory, path, 'Observed slot payload has no inventory reference');
    if ('unavailableFiles' in inventory.value) {
      const sorted = (values: {path: string; reason: string}[]) => [...values].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
      if (!same(sorted(inventory.value.unavailableFiles), sorted(input.absent))) issue(result.inventory, inventory.path, 'Inventory unavailable references differ from original declared absences');
    }
  }
  if (!capture) issue(result.capture, 'capture-status.json', 'Parsed original capture status is required');
  else {
    if (!inventory) issue(result.capture, 'capture-status.json', 'Capture agreement requires original inventory');
    else {
      if ((capture.evidenceMetadata.status === 'available') !== (inventory.path === 'evidence.json')) issue(result.capture, 'capture-status.json', 'Capture evidence availability differs from original inventory');
      const payloads = inventory.value.files.filter(file => file.path !== 'capture-status.json').map(file => ({path: file.path, status: file.status, ...(file.reason === undefined ? {} : {reason: file.reason})}));
      if (!same(capture.payloads, payloads)) issue(result.capture, 'capture-status.json', 'Capture payload references differ from original inventory');
      if ('instrumentation' in inventory.value && capture.finalPageInstrumentation.status === 'available' && !same(capture.finalPageInstrumentation.value, inventory.value.instrumentation)) issue(result.capture, 'capture-status.json', 'Capture instrumentation differs from original evidence');
    }
    if (!same(capture.unavailablePaths, input.absent)) issue(result.capture, 'capture-status.json', 'Capture unavailable references differ from original declared absences');
    if (!input.validation || input.validation.status !== input.row.status || !same(input.validation.reasons, input.row.reasons)) issue(result.capture, 'validation.json', 'Validation verdict or ordered reasons differ from terminal ledger');
  }
  if (!acquisition) issue(result.acquisition, 'provenance/acquisition.json', 'Parsed original acquisition record is required');
  else {
    const observed = new Set(acquisition.members.map(member => member.path));
    for (const [path, original] of files) if (original.role !== 'temporary' && acquisitionPayload(path) && !observed.has(path)) issue(result.acquisition, path, 'Observed acquisition payload has no acquisition member');
    for (const member of acquisition.members) {
      if (member.status === 'partial' || [member.beforeCopy, member.copied, member.afterCopy].some(fact => fact.status === 'unavailable')) issue(result.acquisition, member.path, 'Acquisition retains partial or unavailable original measurements');
      if (member.copied.status === 'available') {
        const original = files.get(member.path);
        if (!original || !factEquals(member.copied.value, original.actual) || !factEquals(member.copied.value, original.seal)) issue(result.acquisition, member.path, 'Acquisition copied measurement differs from retained original or dataset seal', 'integrity');
      }
      const available = member.copied.status === 'available' ? {name: 'copied', fact: member.copied.value}
        : member.beforeCopy.status === 'available' ? {name: 'beforeCopy', fact: member.beforeCopy.value}
        : member.afterCopy.status === 'available' ? {name: 'afterCopy', fact: member.afterCopy.value} : null;
      if (available) {
        for (const stage of ['beforeCopy', 'afterCopy'] as const) if (member[stage].status === 'available' && !factEquals(member[stage].value, available.fact)) issue(result.acquisition, member.path, `Acquisition ${stage} measurement differs from available ${available.name} measurement`, 'integrity');
        if (member.originalSha256 !== undefined && member.originalSha256 !== available.fact.sha256) issue(result.acquisition, member.path, `Acquisition original digest differs from available ${available.name} measurement`, 'integrity');
      }
    }
  }
  return result;
}
export function revokeComparisonReferences(result: ComparisonSlotReferences): void {
  for (const target of Object.values(result)) if (target.status === 'complete') issue(target, '.', 'Original invocation ownership or membership was not closed', 'integrity');
}
