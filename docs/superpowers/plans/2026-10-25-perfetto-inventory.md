# Bounded Perfetto Inventory Implementation Plan

> Use subagent-driven development, test-first controls, spec review then quality review.

Goal: inspect real retained traces under existing output caps without relabeling partial full exports as success.

Files: tools/perfetto-import/inventory.sql (new), run.mjs, run.node.mjs, smoke.mjs, README.md. Existing workflow invokes smoke, so avoid unrelated CI edits.

- [ ] Write authored red missing-API/policy SQL controls.
- [ ] Add fixed inventory SQL with exactly the complete aggregates/context described in the spec; no raw rows/argument values/rates/LIMIT.
- [ ] Add explicit official and authored-only inventory library entrypoints, fixed internal policy selection and CLI --inventory-config. Preserve default full entrypoints, full SQL and default manifest shape. Retain all failure/identity/process/budget requirements.
- [ ] Verify inventory success/closure/mode, default unchanged, independent overflow failure, exact SQL structure and inert imports. Do not increase limits or add fallback.
- [ ] Extend authored official smoke with a separately identified graphics-inventory output using identical308bytefixture. Assert complete grouped counts/context/argument-key-types; allnative/scoringfalse/FPSnull.
- [ ] Run Node controls and pinned official Mac smoke; independently review exact implementation and update README to distinguish full-row and aggregate evidence.
- [ ] Commit, PR, merge only on original exact-head hosted green; downstream main green before new capture. Root may independently run reviewed offline inventory on retained inputs while captures are parked, with explicit source/policy provenance.
