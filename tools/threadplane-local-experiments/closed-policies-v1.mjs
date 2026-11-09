// Closed source-authored descriptive data. Importing or copying this object grants
// no authority: each engine privately binds live fixed accessors to named routes.
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
export const SHARED_SIGNALS_POLICY_V1=freeze({
 id:'local-shared-signals-v1',prefix:'local-shared-signals',envelopeKey:'localSharedSignals',diagnosticKey:'localSharedSignalsDiagnostic',
 label:'local-source-built-shared-signals-037',selectionName:'local-source-built-shared-signals-037-v1',sourceFlavor:'local-source-built-shared-signals-v1',
 purpose:'paired-local-source-built-shared-read-diagnostic',
 decisionPath:'/private/tmp/THREADPLANE-SHARED-SIGNALS-PROSPECTIVE-DECISION-V1-20261107.json',
 decisionSha256:'4aeb8b7928090073430b99feb4c708b483c9a76ca6531d1eaba414bfdbf7e68c',
 transactionName:'.threadplane-local-shared-signals-selection',packageDirectory:'local-packages/local-shared-signals',
 roots:{control:'/private/tmp/chat-ui-bench-shared-signals-control-native-20261107-invocation01',candidate:'/private/tmp/chat-ui-bench-shared-signals-candidate-native-20261107-invocation01'},
 fixedSourceKey:'tools/threadplane-local-shared-signals/fixed-experiment-v1.mjs',
 selectorModule:'tools/threadplane-local-shared-signals/select-v1.mjs',deriveExport:'deriveLocalSharedSignalsSelectionV1',
 buildModule:'tools/competitor-comparison/threadplane-local-shared-signals-build-v1.mjs',buildGuardExport:'createLocalSharedSignalsBuildGuardV1',
 caseModule:'tools/competitor-comparison/matrix-case-stock037-trace-v3.mjs',caseExport:'runLocalSharedSignalsCaseV1',
 schemas:{fixed:'threadplane-local-shared-signals-fixed-experiment-v1',selection:'threadplane-local-shared-signals-selection-v1',preparation:'threadplane-local-shared-signals-preparation-facts-v2',build:'threadplane-local-shared-signals-build-identity-v1',envelope:'threadplane-local-shared-signals-case-v1',decision:'threadplane-local-shared-signals-decision-v1',invocation:'threadplane-local-shared-signals-invocation-v1'},
 toolingKeys:[
  'tools/threadplane-local-shared-signals/fixed-experiment-v1.mjs',
  'tools/threadplane-local-shared-signals/select-v1.mjs',
  'tools/threadplane-stock037/select-v1.mjs',
  'tools/competitor-comparison/threadplane-local-shared-signals-build-v1.mjs',
  'tools/competitor-comparison/threadplane-local-shared-signals-install-transform-v1.mjs',
  'tools/threadplane-local-experiments/closed-policies-v1.mjs',
  'tools/threadplane-local-experiments/selection-engine-v1.mjs',
  'tools/threadplane-local-experiments/build-engine-v1.mjs',
  'tools/threadplane-local-experiments/coordinator-engine-v1.mjs',
 ],
});
export const OWNED_MARKDOWN_POLICY_V1=freeze({
 id:'local-owned-markdown-v1',prefix:'local-owned-markdown',envelopeKey:'localOwnedMarkdown',diagnosticKey:'localOwnedMarkdownDiagnostic',
 label:'local-source-built-owned-markdown-037',selectionName:'local-source-built-owned-markdown-037-v1',sourceFlavor:'local-source-built-owned-markdown-v1',
 purpose:'paired-local-source-built-owned-markdown-diagnostic',
 decisionPath:'/private/tmp/THREADPLANE-OWNED-MARKDOWN-PROSPECTIVE-DECISION-V1-20261108.json',
 decisionSha256:'fda4958afce1597ec1e3e0e1387335456cdc34bf126eec595ebdb36750987b63',
 transactionName:'.threadplane-local-owned-markdown-selection',packageDirectory:'local-packages/local-owned-markdown',
 roots:{control:'/private/tmp/chat-ui-bench-owned-markdown-control-native-20261108-invocation01',candidate:'/private/tmp/chat-ui-bench-owned-markdown-candidate-native-20261108-invocation01'},
 fixedSourceKey:'tools/threadplane-local-owned-markdown/fixed-experiment-v1.mjs',
 selectorModule:'tools/threadplane-local-owned-markdown/select-v1.mjs',deriveExport:'deriveLocalOwnedMarkdownSelectionV1',
 buildModule:'tools/competitor-comparison/threadplane-local-owned-markdown-build-v1.mjs',buildGuardExport:'createLocalOwnedMarkdownBuildGuardV1',
 caseModule:'tools/competitor-comparison/matrix-case-stock037-trace-v3.mjs',caseExport:'runLocalOwnedMarkdownCaseV1',
 schemas:{fixed:'threadplane-local-owned-markdown-fixed-experiment-v1',selection:'threadplane-local-owned-markdown-selection-v1',preparation:'threadplane-local-owned-markdown-preparation-facts-v2',build:'threadplane-local-owned-markdown-build-identity-v1',envelope:'threadplane-local-owned-markdown-case-v1',decision:'threadplane-local-owned-markdown-decision-v1',invocation:'threadplane-local-owned-markdown-invocation-v1'},
 toolingKeys:[
  'tools/threadplane-local-owned-markdown/fixed-experiment-v1.mjs',
  'tools/threadplane-local-owned-markdown/select-v1.mjs',
  'tools/threadplane-stock037/select-v1.mjs',
  'tools/competitor-comparison/threadplane-local-owned-markdown-build-v1.mjs',
  'tools/competitor-comparison/threadplane-local-shared-signals-install-transform-v1.mjs',
  'tools/threadplane-local-experiments/closed-policies-v1.mjs',
  'tools/threadplane-local-experiments/selection-engine-v1.mjs',
  'tools/threadplane-local-experiments/build-engine-v1.mjs',
  'tools/threadplane-local-experiments/coordinator-engine-v1.mjs',
 ],
});

// Separate draft namespace. Provisional pins grant no selection/execution authority.
export const OWNED_MARKDOWN_POLICY_V2=freeze({
 id:'local-owned-markdown-v2',prefix:'local-owned-markdown-v2',envelopeKey:'localOwnedMarkdownV2',diagnosticKey:'localOwnedMarkdownDiagnosticV2',
 label:'local-source-built-owned-markdown-037-v2',selectionName:'local-source-built-owned-markdown-037-v2',sourceFlavor:'local-source-built-owned-markdown-v2',
 purpose:'paired-local-source-built-owned-markdown-v2-diagnostic',
 decisionPath:'/private/tmp/THREADPLANE-OWNED-MARKDOWN-PROSPECTIVE-DECISION-V2-20261108.json',
 decisionSha256:'44db4d7393bb66920123624622d037ca3a0fea9d537c16f88f02eade3eba7f89',
 transactionName:'.threadplane-local-owned-markdown-v2-selection',packageDirectory:'local-packages/local-owned-markdown-v2',
 roots:{control:'/private/tmp/chat-ui-bench-owned-markdown-v2-control-native-20261108-invocation01',candidate:'/private/tmp/chat-ui-bench-owned-markdown-v2-candidate-native-20261108-invocation01'},
 fixedSourceKey:'tools/threadplane-local-owned-markdown/fixed-experiment-v2.mjs',
 selectorModule:'tools/threadplane-local-owned-markdown/select-v2.mjs',deriveExport:'deriveLocalOwnedMarkdownSelectionV2',
 buildModule:'tools/competitor-comparison/threadplane-local-owned-markdown-build-v2.mjs',buildGuardExport:'createLocalOwnedMarkdownBuildGuardV2',
 caseModule:'tools/competitor-comparison/matrix-case-stock037-trace-v3.mjs',caseExport:'runLocalOwnedMarkdownCaseV2',
 // v1 already owns preparation-facts-v2. This new tag separates authority;
 // the shared preparation shape and reader algorithm remain unchanged.
 schemas:{fixed:'threadplane-local-owned-markdown-fixed-experiment-v2',selection:'threadplane-local-owned-markdown-selection-v2',preparation:'threadplane-local-owned-markdown-preparation-facts-v3',build:'threadplane-local-owned-markdown-build-identity-v2',envelope:'threadplane-local-owned-markdown-case-v2',decision:'threadplane-local-owned-markdown-decision-v2',invocation:'threadplane-local-owned-markdown-invocation-v2'},
 toolingKeys:[
  'tools/threadplane-local-owned-markdown/fixed-experiment-v2.mjs',
  'tools/threadplane-local-owned-markdown/select-v2.mjs',
  'tools/threadplane-stock037/select-v1.mjs',
  'tools/competitor-comparison/threadplane-local-owned-markdown-build-v2.mjs',
  'tools/competitor-comparison/threadplane-local-shared-signals-install-transform-v1.mjs',
  'tools/threadplane-local-experiments/closed-policies-v1.mjs',
  'tools/threadplane-local-experiments/selection-engine-v1.mjs',
  'tools/threadplane-local-experiments/build-engine-v1.mjs',
  'tools/threadplane-local-experiments/coordinator-engine-v1.mjs',
 ],
});

// Candidate-only two-slot diagnostic; actual source/declaration bindings pending.
export const POSTFIX_DIAGNOSTIC_POLICY_V1=freeze({
 id:'local-postfix-two-slot-v1',prefix:'local-postfix-two-slot-v1',label:'local-source-built-postfix-diagnostic-037-v1',selectionName:'local-source-built-postfix-diagnostic-037-v1',sourceFlavor:'local-source-built-postfix-diagnostic-v1',purpose:'candidate-only-two-slot-postfix-diagnostic',
 decisionPath:'/private/tmp/THREADPLANE-POSTFIX-TWO-SLOT-DIAGNOSTIC-DECISION-V1-20261108.json',decisionSha256:'b450dcda89e5f84301c6bbe69d4d89df5fe90a1fc63c2654dfc80ca4a6533318',
 transactionName:'.threadplane-local-postfix-two-slot-v1-selection',packageDirectory:'local-packages/local-postfix-two-slot-v1',roots:{candidate:'/private/tmp/chat-ui-bench-postfix-two-slot-candidate-native-20261108-invocation01'},
 envelopeKey:'localPostfixDiagnosticV1',diagnosticKey:'localPostfixTwoSlotDiagnosticV1',caseModule:'tools/competitor-comparison/matrix-case-stock037-trace-v3.mjs',caseExport:'runLocalPostfixDiagnosticCaseV1',
 fixedSourceKey:'tools/threadplane-local-postfix-diagnostic/fixed-experiment-v1.mjs',selectorModule:'tools/threadplane-local-postfix-diagnostic/select-v1.mjs',deriveExport:'deriveLocalPostfixSelectionV1',buildModule:'tools/competitor-comparison/threadplane-local-postfix-diagnostic-build-v1.mjs',buildGuardExport:'createLocalPostfixBuildGuardV1',
 schemas:{fixed:'threadplane-local-postfix-diagnostic-fixed-v1',selection:'threadplane-local-postfix-diagnostic-selection-v1',preparation:'threadplane-local-postfix-diagnostic-preparation-facts-v1',build:'threadplane-local-postfix-diagnostic-build-identity-v1',envelope:'threadplane-local-postfix-diagnostic-case-v1',invocation:'threadplane-postfix-two-slot-diagnostic-v1'},
 toolingKeys:['tools/threadplane-local-postfix-diagnostic/fixed-experiment-v1.mjs','tools/threadplane-local-postfix-diagnostic/select-v1.mjs','tools/threadplane-stock037/select-v1.mjs','tools/competitor-comparison/threadplane-local-postfix-diagnostic-build-v1.mjs','tools/competitor-comparison/threadplane-local-shared-signals-install-transform-v1.mjs','tools/threadplane-local-experiments/closed-policies-v1.mjs','tools/threadplane-local-experiments/selection-engine-v1.mjs','tools/threadplane-local-experiments/build-engine-v1.mjs',
 // Required future coordinator source. No old paired coordinator substitution.
 'tools/competitor-comparison/aimock-local-postfix-two-slot-v1.mjs'],
});
