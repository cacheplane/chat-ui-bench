# Unscored Copilot module-binding diagnostic

After locked installation, use Node24.x on Linux or macOS:

```
npm run test:copilot-module-binding
npm run diagnose:copilot-module-binding -- --preflight
npm run diagnose:copilot-module-binding -- --browser
```

Only explicit `--browser` permits one browser attempt. Optional `--out` must be an absolute normalized absent directory; existing output is never overwritten or retried. Optional `--run-id` is a safe1–64 character identifier; otherwise a UUID is assigned. Source checkout and current Node executable derive from module location/process.execPath, with no executable/source/profile override. Preflight does not import vendor code, create output or start a browser.

Four reversible source-owned initialization taps count Copilot ESM, virtual core, React CJS and react-virtual wrapper exactly once through one adapter. Full production app/sentinel graph is compiled offline; the app is never rendered. The same bare public Copilot ESM import, positive four-source STATIC contributions and actual loaded closure are required. Only the exact two source-proven CSS inline SVG edges classify as embedded assets; this grants no request permission. Unknown external imports, assets, path aliases and requests refuse.

The tool owns one controller child and one browser server/client/context/page. Original controller and browser exit+close, raw EOF+close, actual owned groups, profile, context/browser/listener closure and retained file fsync/close/readback are separate requirements. Browser PID/profile is reported over owned IPC at original exact-executable spawn; killing the controller cannot stand in for detached browser closure. A forced cleanup/survivor stays failure. This is scoped owned-group knowledge, not all-descendant or OS-wide egress proof.

Original120s includes build,15s browser phase,5s cleanup and finalization. BUILD limits are640files/32MiB/8MiB each, inputs16384files/8MiB each/64MiB per pass, requests768/640paths/32MiB total. Raw streams are1MiB each. Raw receipt retains exact last admitted original text up to16KiB UTF8 before validation/wait; accepted parsed receipt is separate and exact. Whole escaped postcleanup phase is262144bytes. All generated intents/attempts, compiled assets, metadata, logs and receipts share BUILD limits, including four outer capture reservations. Functional controls retain separate96file/8MiB/5s-subject bounds. Owned relocation/control fixture inputs also fit96files/8MiB and are removed after each subject; installed node_modules is linked read-only rather than copied. The actual offline build subject uses a separately bounded BUILD scratch and removes it after the subject. See profile.json for fixed ceilings.

Intent/attempt records live only in owned output and bind sources/profile/run/build; they express explicit CLI consent/provenance, not external approval. Runtime provenance records actual Node/V8/platform/architecture, pinned package/control bytes/browser revision, executable regular-file metadata and browser.version(). No exact-machine binary or whole browser/app attestation is claimed. Missing/oversized/late/unknown evidence remains unavailable; timing checks do not make synchronous native operations preemptible.

Receipts inventory their completed prefix. The final console terminal inventories every retained file after receipt persistence, within the original boundary. Join actual command exit and terminal with artifact replay; an earlier receipt alone cannot attest its own future publication/exit. CI logs/upload are external transport, not resource closure. Failed profile cleanup leaves retained profile inventory unknown/unavailable.

This public API deliberately excludes the private history/cache/render observer and its owner/history/node/active32/work subjects. Preserved regressions cover binding counts/schema, byte reversal/strict directives, CJS/ESM/static joins, inline asset provenance, raw/escaped quotas, output/source drift, original process/stream/group/profile/timeout closure and portability. Test fixtures are generated locally, never reconstructed historical receipts. No AIMock/canonical app/verifier/trace changes, UI workload, warm/live readiness, cache continuity, native/FPS capture or performance/scoring/ranking authority follows. All such authority remains false or unavailable.
