// This version has not been published. Keep the real CLI fail-closed until all
// five registry metadata records and tarball SRIs have been independently read,
// verified and reviewed. Synthetic unit fixtures never replace this authority.
// After publication this becomes the fixed reviewed
// threadplane-published-stock035-pins-v1 record, not a caller-provided manifest.
// It includes selectedSourceHashes for exact root package.json, selected app
// package.json and selected package-lock.json bytes from the pure derivation.
// Both registry identities and these hashes must exist before the real accessor
// admits any build or selection. A null selectedSourceHashes is parser/model
// preparation only and remains unavailable to both production CLIs.
export const STOCK035_PUBLISHED_PINS_V1 = null;
