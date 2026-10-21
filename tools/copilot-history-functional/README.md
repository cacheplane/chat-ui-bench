# Copilot history functional diagnostic

This sibling diagnostic renders the real Copilot app and observes source-owned virtualizer writes. It is unscored: FPS, performance qualification, and native readiness remain unavailable.

Build the source contract once with `npm run build --workspace @chat-ui-bench/contract` after `npm ci`.

Run `npm run test:copilot-history-functional` for offline source controls. Running the tool without arguments only checks current source pins and writes nothing. An explicit browser attempt uses `npm run diagnose:copilot-history-functional -- --browser --run-id example --out /absolute/absent/output`. The output directory must not exist. There are no retries.

The diagnostic builds the complete pinned browser and server graph. A reversible diagnostic server transform supports seed-only teardown; canonical application sources are unchanged. The observer closes the source commit after layout bookkeeping and before follow-up callbacks, retains original return records, requires a natural mapped eligible original write, then checks irreversible viewport invalidation and strict host/server/browser cleanup. Refusals retain evidence and produce an unavailable result.

The source work budget covers admitted observer work through first refusal. Arbitrary original calls after sticky refusal can execute fault-containment bookkeeping and are not a total-program CPU attestation. Compile inputs, emitted outputs, source work, command counts, streams, and original-return widths have separate limits. Browser/SDK work occurs only after explicit `--browser`.

The source profile reserves 67,108,160 logical units under a 67,108,864 hard cap. The initial 1,366,336 includes a nonrenewable 64-unit reserve for the new commit diagnostic argument at first refusal. The 18 labels are at most 18 ASCII characters and use the existing 64-character site field; a complete maximal driver view remains 733 bytes under the 2,048-byte original-return cap. No field or callback quota is added.

Each source transform must reverse to its complete pinned original. Compilation admits at most 16,384 inputs and 64 MiB per pass before compiler supply; output and retained evidence share a 640-file/32-MiB envelope. Original returns, static responses, SDK settlement, browser process EOF, process groups, and profile removal have separate joins. A natural process exit does not establish server settlement or an eligible write.
