/** Borrowed byte comparison: no dependencies, copies, resource allocation or I/O. */
export function equalChunkBytes(left: readonly Uint8Array[], right: readonly Uint8Array[]): boolean {
  let li = 0; let ri = 0; let lo = 0; let ro = 0;
  for (;;) {
    while (li < left.length && lo === left[li]!.byteLength) { li++; lo = 0; }
    while (ri < right.length && ro === right[ri]!.byteLength) { ri++; ro = 0; }
    if (li === left.length || ri === right.length) return li === left.length && ri === right.length;
    const a = left[li]!; const b = right[ri]!;
    const count = Math.min(a.byteLength - lo, b.byteLength - ro);
    for (let i = 0; i < count; i++) if (a[lo + i] !== b[ro + i]) return false;
    lo += count; ro += count;
  }
}
