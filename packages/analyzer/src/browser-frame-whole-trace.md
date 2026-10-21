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
