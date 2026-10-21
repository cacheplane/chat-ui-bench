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
