# Request-window phase V2 implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement and independently review each task.

**Goal:** Add explicit whole-trace phase inspection for fixed sustained-scroll acquisitions using the existing V12 original-file reader, keeping historical V6 policy intact.

**Architecture:** Select the new inspection policy before collection. Complete the original browser capture and its 17-second collection / 19-second finalization gates first. A separately owned, bounded analysis process reads the entire original file once through the existing V12 reader. Only complete semantic, physical, source, and process closure can grant the private acquisition capability used by feedback analysis. Persisted JSON cannot grant that capability.

**Tech stack:** Node 24, existing native CDP collector, original-file V12 reader, Node authored controls, existing unchanged Perfetto V1 feedback pipeline.

## Boundaries

The V12 policy has explicitly different fixed analysis budgets: 4096 disclosure groups, 4096 metadata facts, 8192 metadata occurrences and 256 internal candidates. The phase adapter retains the downstream 128-candidate ceiling and 8 KiB receipt envelope. Historical V6 keeps its 128 disclosure ceiling and refuses the same unsupported inputs. No fallback from V6 to V12, trace truncation, cropping, shorter capture, partial inventory, capacity mutation, or semantic failure salvage is permitted.

Whole-input EOF, identity, SHA256, structural EOF, complete selected-schema processing, all five manifests, explained sequence initialization, absence of contradictory initialization and unexplained drops, and global ordinary-event root inventory are mandatory. Recognized marks alone cannot pass a withheld global inventory. Require unique exact owner start/end names, matching selected prefix, original packet order, and exact original source/request/manifest/trace binding.

Analysis grants no clock, target, presentation population, FPS, scoring or ranking authority. Fixed-window feedback remains conditional on successful unchanged whole V1 observations. Stock and modified configurations and fixture profiles remain distinct. Traces and native-derived reports stay local.

## Tasks

- [x] Write and run failing authored original-byte controls for the versioned V12 phase adapter. Implement its bounded, frozen output and all global refusal gates.
- [x] Add explicit preselected deferred inspection to the request-window worker and strict result validator, preserving legacy mode and checks. Test crossed policies, missing original completion and forged rows.
- [x] Add a separately timed original process supervisor and private original-return qualification, with source/runtime/input bookends, bounded pipes, original stdin/EOF/exit/close and timeout cleanup. No production injection seams.
- [ ] Close all new source and compiled imports in request-family provenance. Measure retained preparation accounting against existing budgets, including the larger fixture profile. Keep legacy roster membership intact.
- [ ] Run affected controls, existing reader/state refusal suites, build and type checks. Independently review specification and implementation; resolve material findings.
- [ ] Open an authored-source-only PR, require all seven checks on the reviewed head, merge, then require all seven on merged main.
- [ ] Prepare fresh, separately identified stock 0.3.3 fixture/trace cohorts from that main. Review local operator bindings, then run original native and analysis verification. Preserve every refusal. Report numeric observations only after the complete pipeline succeeds; FPS remains unavailable unless its trace proof passes.
