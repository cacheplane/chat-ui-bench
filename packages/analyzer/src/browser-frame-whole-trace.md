# Whole supplied Trace structural diagnostic

This opt-in D0 unit shares the root framing machine with the existing eager
Trace ingress. The eager API retains its 262,144-byte and 1,024-frame policy,
including complete wrapper validation before packet decoding or body views.

`createD0StructuralStudy(bytes, D0_POLICY)` accepts ordinary owned byte chunks
under a fixed 32 MiB / 64 KiB chunk / 262,144-byte packet / 131,072-packet /
4,096-feed policy. Its finish result proves only a supplied root boundary;
physical EOF and structuralContainerEOF remain false. The existing selected
packet decoder is reused. First projection failure stops decoding permanently,
while bounded framing and full hashes can continue. No packet history is kept:
only 128 anchors, finite counters and a domain-separated complete manifest hash.

`readD0PersistedTrace(reference, D0_POLICY)` is the explicit source-owned local
file adapter. It requires an exact normalized absolute path, expected size and
SHA256. The reference must come from the trusted acquisition owner; equality
does not authenticate a browser or a capture receipt. It opens one ordinary,
one-link file without following symlinks, reads through its original descriptor,
requires a separate original EOF even at the byte limit, compares full hash and
descriptor/path identity before and after, and requires successful close.
`fullInputVerified` records that file join. `structuralContainerEOF` additionally
requires the whole root wrapper boundary. Selected packet projection may still
be unavailable. A clean prefix or a caller EOF boolean cannot grant either join.

The fixed source-work reservation is 14,906,603,520 under a 15,000,000,000 ceiling.
It is a conservative source logical bound, not measured CPU or RSS. It includes
independent typed-payload staging and one failed/crossing packet. Output stays
within 262,144 bytes and 65,536 string bytes; a stricter private copier guard of
4,096 nodes and 256 compound records fits the closed result inside the wider
32,768-node profile maximum. JSON escape size is counted before serialization.

Annotations, ordered state, clocks, marks, populations and metrics are never
evaluated here. Capture completeness and target lifetime remain unestablished;
native GO, performance, scoring and ranking remain false and FPS unavailable.
No default file, CLI, browser, network or capture operation runs on import.
Tests use only authored synthetic bytes/files. The file adapter cannot establish
that a supplied persisted file represents a complete native capture.

## Whole-input ordered annotation diagnostic

`createWholeAnnotationStudy(bytes, WHOLE_ANNOTATION_POLICY)` and
`readWholeAnnotationTrace(reference, WHOLE_ANNOTATION_POLICY)` add a separate
opt-in ordered annotation mode. They use one persistent reducer across the
supplied file, preserving sequence-local names, defaults, resets and loss.
The physical reader is shared with D0. The eager/manual APIs and D0 policies
retain their existing limits and validation order.

This mode retains at most 64 sequences, 8,192 historical definitions, 1,024
default versions and 128 candidate rows. Live intern entries are capped at
4,096 and cumulative retained semantic strings at 262,144 UTF-8 bytes; reset
does not renew that cumulative allowance. Packet bodies use the stricter
8,192-occurrence and 4,096-member limits. Literal candidate values are capped
at 4,096 UTF-8 bytes each and 16,384 bytes together. Unresolved or duplicate
root-name inventories are withheld rather than treated as absent marks.

A semantic failure stops further decoding while full-input framing and hashing
continue when possible. Any semantic, framing, read, identity, hash, close or
output failure withdraws all candidate rows. The unchanged size-limit detector
may observe one extra byte: only the diagnostic `reader.bytes` slot can report
33,554,433. That result remains unavailable with `reader-growth`, false physical
verification and no candidates; the input limit remains 32 MiB.

The closed reader output keeps the same 262,144-byte ceiling, including keys
and JSON escaping, with 32,768 nodes, 4,096 objects and 65,536 UTF-8 string
bytes including keys. Its generic owned-JSON guard checks structure and capacity;
fixed source constructors establish the schema. The conservative source-work
bound is 14,928,673,113 under the unchanged 15,000,000,000 ceiling. It counts
source operations and bounded native walks; it does not measure CPU, RSS or GC.

The packet manifest binds all completely framed packet bodies, even after
semantic decoding stops. The transition manifest covers the implemented
supported semantic subset; `trustedPid` remains bound by the raw body and is
not included in that semantic digest or candidate context. Neither manifest
establishes capture completeness or normalizes clocks. Machine/sequence
identifiers, raw timestamps and selected clock/track sources remain unqualified.
All native, performance, scoring and ranking authority stays false, with FPS
unavailable.
## Source-owned phase inventory join

The runner's opt-in `inspectProtoNativePhase(owner)` accepts only the exact object
created by that source instance's native capture factory. It is synchronous and
one-shot: a genuine premature request is cached as unavailable. Unknown objects,
cloned receipts and Proxies do not dispatch file reads. The analyzer package's
`internal/whole-annotation` subpath is loaded lazily only after original finish and
self-receipt-write fulfillment, without changing the factory methods or persisted
receipt. The persisted self-write row remains truthfully pending in those bytes.

A ready request performs one source-owned whole-file read, joining its extent,
hash and observed device/inode to private original capture state. It requires a
resolved supported-root `markName` inventory, exactly one occurrence of each
private generated name, no selected-prefix foreign name and increasing packet
indices. It projects two rows with raw sequence, machine, track, clock and time
provenance. Decreasing timestamps remain unqualified; packet order is not clock
or causal order. Unrelated classified roots outside the private prefix are counted.
Unresolved siblings, observed state loss, malformed input or physical read failure
withhold the pair. Reentry latches a cached refusal; it cannot publish later success.

This is observed source-registry/supplied-file correspondence, not an inventory of
all opaque/raw occurrences or proof of continuous inode, target or capture
lifetime. All native, clock, target, population, duration, FPS and scoring authority
stays false/unavailable. A cached result describes its read instant. Package
subpath custody in the selected CI snapshot does not retain the complete called
reader graph; future actual capture needs separately reviewed exact dependency
custody and all existing functional/native release gates. No capture is enabled by
this diagnostic. Output is bounded to8192 serialized bytes,4096 UTF8 including
keys,256 nodes,16 objects and depth6; only fixed source-owned DTOs enter its guard.

## Explicit V6 sequence-start diagnostic

`createWholeUserTimingStudyV6`, `readWholeUserTimingTraceV6`,
`createProtoNativeUserTimingCaptureV6` and `inspectProtoNativeUserTimingPhaseV6`
select the separate V6 policy. Earlier profiles and default factories retain their
original outputs and loss refusals. The native-real-chat worker explicitly selects
the V6 factory and inspector; it has no caller-selected policy switch.

V6 adds `sequenceStart` with primitive `raw`, `explained`, `unexplained` and
`contradictions` counts. The raw count includes nonreset drop indications and
equals explained plus unexplained. An indication is explained only when the
decoded producer first-packet flag is true, the raw drop value is exactly 1 and
no packet for that exact machine/sequence has appeared earlier in the supplied
file. Absent machine and present machine 0 remain distinct. A true first flag
after any same-key history refuses the study, including after reset or a chunk
boundary. The existing `invalid-whole-annotation-input` refusal and V6
`contradictions` count identify that failure without extending older failure-code
membership. Reset still takes priority over a simultaneous drop; startup never
initializes valid state, defaults or intern definitions. Existing raw loss counters
keep their original meaning.

The complete ordered input and final V6 ledger bind the transition manifest.
The V6 owner refuses any unexplained indication anywhere in the file, including
after the end marker, and retains every other whole-file and phase gate. Late
semantic, read, hash, identity, EOF, close or capacity failure withdraws all earlier
candidates and rows. Inspection is brand-isolated and cached without extra reads.
This diagnostic grants no clock, target, duration, FPS, native or scoring authority.

## Explicit V7 clock and descriptor evidence inventory

`createWholeUserTimingStudyV7` and `readWholeUserTimingTraceV7` select
`pinned-whole-trace-user-timing-evidence-diagnostic-v7`. This analyzer-only opt-in
uses the V6 initialization, first-packet, counter-default and provenance rules.
Earlier policy result shapes and packet/transition manifests remain unchanged;
the native capture and worker still select V6. The reader uses the original owned
file descriptor once and requires its existing EOF, hash, identity and close gates.

V7 adds deeply frozen `evidenceInventory` with status
`complete-supported-observations` or `unavailable` and ordered `observations`.
Rows discriminate `clock_snapshot` and `track_descriptor` at the existing
validated decoder seam. Each retains packet index, packet body SHA256, payload
`location` offsets relative to that packet body, explicit machine and sequence
context (including sequence index and current interval), and raw packet timing,
sequence/reset/drop/first flags in `packetFields`. Absent machine differs from
present machine 0; metadata without a sequence has explicit absent context.
Sequence intervals reflect the existing reset/loss transition before the row.

Snapshot rows retain the optional primary trace clock and raw clock id,
timestamp, incremental flag and unit multiplier. Descriptor rows retain only
UUID, parent UUID, process pid/start timestamp and thread pid/tid. Optional scalar
absence is preserved, including explicit false and zero. Names and occurrence
arrays are omitted. No missing units are inferred, clock values normalized,
sequence clocks promoted, or target/lifetime association established.

Inventory admission checks a combined maximum of 128 observations and 512 clock
entries across snapshots before retaining each row. The existing persistent
string, repeated-work and global output budgets also apply; the maxima are
coupled, so a rich 128-row inventory may hit global output capacity first. No cap
is increased. Capacity or semantic refusal clears both inventory and candidates,
while existing physical reading/framing continues. Malformed tails and late
reader failures also withdraw both; no successful partial prefix is published.
The existing `invalid-whole-annotation-input` identifies inventory row/clock
capacity refusal without extending the legacy closed failure-code vocabulary.

Complete supported observations are diagnostic raw evidence, not proof of capture
completeness. Clock normalization, target binding, presented-frame enumeration,
duration and FPS remain unavailable, and native/scoring authority remains false.
# Private Clock3 instant phase alignment

`@chat-ui-bench/analyzer/internal/native-clock3-phase` exports
`readNativeClock3PhaseAlignment(reference, [exactStart, exactEnd], policy)` and
`NATIVE_CLOCK3_PHASE_POLICY` (`native-clock3-phase-alignment-diagnostic-v1`).
This separate owned-file diagnostic projects exact `BeginFrame` and `DrawFrame`
type3 instants and the two UserTiming marks into raw clock3. It returns exact
packet, name/default/track/epoch/snapshot witnesses and observed counts before,
inside or after the half-open mark interval. These are whole-file observations;
root ownership, complete opportunity populations and FPS remain unavailable.

The supported profile is one absent-machine namespace, nonincremental builtin3
in ns and sequence-local64/65 declared with1000ns units. Local64 accumulates all
eligible packet deltas, including unselected events, descriptors and packets
without TrackEvents; local65 is absolute. Same-sequence snapshot anchors retain
their full nanosecond residual. Explicit3/65 packets do not advance64. Snapshot
packets are processed after reset/default/intern updates and return before both
invalid-NEEDS bypass and generic timestamp conversion; their header timestamps
do not advance64. A reset needs fresh anchors/defaults. A direct3 BeginFrame can
be backdated before a local anchor without being reinterpreted as a delta.

Packet clock0 falls back to a valid current sequence default with explicit-zero
presence preserved. Missing/zero/invalid defaults and selected clock6 refuse;
equal3/6 snapshot readings do not authorize general extrapolation. Snapshot
clock0, explicit multiplier0, inconsistent units/incrementality, missing anchors,
unexplained loss, ambiguous selected names/tracks, noninstant selected names,
int64 arithmetic overflow and unsupported machine/clock semantics refuse.
Legitimate unnamed slice ends/counters remain unselected while their applicable
packet deltas are processed.

The projection shares the existing128 candidate ceiling with the retained
UserTiming inventory, including its two exact phase marks. A fully resolved
unrelated UserTiming literal remains unselected for phase binding and consumes
its inherited inventory capacity; its applicable packet delta is still processed.
An unresolved potential phase name refuses. Original32MiB file,64 sequence,128 observation/512 clock entry,
work/UTF8 and256KiB serialized-output limits remain unchanged. A late failure,
including original file EOF/hash/identity/close or output admission failure,
withdraws every normalized row and count. No prefix, retry or capacity extension
is admitted. The full ordered pass, original reader and parser/interpretation
source pins are reused; V6/V7/V8 outputs and native collector selection remain
separate. Producer snapshot semantics and recorded vendor-source correspondence
remain explicit assumptions; input origin is unauthenticated. No rate, physical
duration, presentation success, evaluation, ranking or FPS authority is added.

## Explicit V9 compact evidence and private Clock3 v2

`createWholeUserTimingStudyV9` and `readWholeUserTimingTraceV9` select
`WHOLE_USER_TIMING_V9_POLICY`, whose exact value is
`pinned-whole-trace-user-timing-compact-evidence-diagnostic-v9`. The factory and
policy live in ordered-state; the reader uses the existing private
`@chat-ui-bench/analyzer/internal/whole-annotation` entry. The existing private
`internal/native-clock3-phase` entry also exports
`readNativeClock3PhaseAlignmentV2(reference, [exactStart, exactEnd], policy)` and
`NATIVE_CLOCK3_PHASE_V2_POLICY`
(`native-clock3-phase-alignment-diagnostic-v2`). These require explicit selection;
a failed V7, V8 or Clock3 v1 call is never retried with a newer policy. Native
collection continues to select V6.

V9 has a separate frozen `evidenceInventory` with `version: 1`, status
`complete-supported-compact-observations` or `unavailable`, `facts` and ordered
`occurrences`. Each fact retains a complete supported snapshot or descriptor
payload, including kind, optional scalar presence, exact decimal values and
original nested property order. Each occurrence has these fixed tuple columns:

| Index | Value |
|---|---|
| 0 | Fact dictionary index |
| 1 | Packet index |
| 2 | Original packet body SHA256 |
| 3 | Exact machine id string, or null for absent machine |
| 4 | `[sequenceId, sequenceIndex, intervalVersion]`, or null for absent sequence |
| 5 | Original optional timing/reset/drop/first headers in `packetFields` |
| 6 | `[scope, fieldNumber, wireType, start, valueStart, end]` in the packet body |

The location's packet index is column 1. Explicit machine 0 differs from absence;
zero, false and missing packet headers remain distinct. Occurrence order,
locations, context, body hashes and duplicate multiplicity are retained even
when payload facts repeat. No UUID, clock id or hash substitutes for full fact
equality. Source-created iteration reconstructs one original observation at a
time; production does not expand the complete inventory into an observation or
matching-descriptor array. Snapshot staging still sees every original live row.

The new version admits at most 128 distinct facts and 256 occurrences, with 512
clock entries counted across every occurrence, including repeated snapshots.
These separate versioned limits do not reinterpret the old 128-observation cap:
V7, V8 and Clock3 v1 retain their original outputs and refusals. V9 charges each
full original observation's persistence bytes, plus bounded dictionary-key and
tuple/reference overhead; iterator work is charged too. The original 32 MiB input,
field/repeated-work/persistence budgets, sequence/default/disclosure/candidate
limits and combined output guards remain unchanged: 256 KiB serialized JSON,
65536 aggregate key/value UTF8 bytes, 32768 nodes, 4096 objects and depth 16.
Compact evidence, raw drops, candidates and projection state are admitted
together, followed by the complete study, owned-reader and facade envelopes.

Whole-study semantic or resource failure atomically withdraws compact evidence,
candidates, raw-drop facts and projection. Existing whole-file hashing/framing
continues; original EOF/hash/identity/close failures also withdraw retained
payloads. Reader/facade envelope refusal removes study and projection together.
Projection-only refusal withdraws normalized rows/counts without promoting valid
raw evidence into a successful projection. No successful clipped prefix is
published. V8 raw-drop declarations and their classification remain unchanged.

Clock3 v2 uses the same absent-machine builtin 3 and same-sequence local 64/65
profile, units, epoch/default/anchor checks, arithmetic, descriptor identity and
joint 128 candidate ceiling. It adds no selected clock 6 alias or extrapolation.
The new `reviewedCompactEvidence` compatibility record supplements the unchanged
historical implementation pins. Storage admission establishes no producer or
target authenticity, presentation success, FPS, rate, metric, native-support,
evaluation, scoring or ranking authority.
