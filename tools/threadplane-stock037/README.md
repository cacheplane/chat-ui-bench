# Prospective stock Threadplane 0.3.7 selection

This selector prepares a disposable canonical stock034 checkout for a separate
stock037 cohort. Production pins are currently `null`, so the selector and build
guard refuse before examining arguments or accessing the checkout. Parser and
model tests use authored metadata; they do not establish publication or readiness.

Activation requires verified publication of all six synchronized packages:
`@threadplane/{a2ui,telemetry,render,chat,ag-ui,langgraph}`. The benchmark consumes
five of those packages; it does not consume `ag-ui`. Review actual tarball
dependency and peer metadata before activating the fixed transformation. An
unrepresented graph change requires a reviewed implementation change.

The model binds the exact canonical root manifest, app manifest and lockfile
bytes. The production operation additionally binds the expected checkout and
fixed selected-source hashes, stages originals and replacements, checks inputs
again, and verifies the published bytes. Selection does not install packages or
qualify a stock build. An ordinary isolated `npm ci`, genuine production builds,
and the default build readers remain necessary after activation.

Old stock036 selectors, output, and captured evidence retain their original
identities. See [the stock037 acquisition protocol](../competitor-comparison/semantic-large-stock037-v3.md).
