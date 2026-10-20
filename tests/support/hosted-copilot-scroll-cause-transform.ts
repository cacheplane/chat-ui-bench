import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PINNED_MODULE = '@tanstack/virtual-core/dist/esm/index.js';
export const PINNED_SHA256 = '06f0d457a913752786a32f3f16dff0c5a9c5a8c4877665c31a2e74598db13c09';
const PREFIX = '__scrollCauseV1';
const hash = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
export interface ScrollCauseInsertion { offset: number; text: string }
export interface ScrollCauseTransform { code: string; originalSha256: string; transformedSha256: string; insertions: ScrollCauseInsertion[] }

/** Exact-version insertion transform. It neither reads nor imports a dependency. */
export function transformScrollCause(source: string, moduleId: string, observerImport: string): ScrollCauseTransform {
  if (moduleId !== PINNED_MODULE || Buffer.byteLength(source) !== 54156 || hash(source) !== PINNED_SHA256 || source.includes(PREFIX)) throw new Error('Unrecognized original virtualizer');
  if (!/^file:\/\/\/[A-Za-z0-9_./%:-]+\.(?:ts|mjs)$/.test(observerImport) || observerImport.includes('/../') || observerImport.length > 1024) throw new Error('Unsafe observer import');
  try {
    const path = fileURLToPath(observerImport);
    if (path.includes('\0') || pathToFileURL(path).href !== observerImport) throw new Error('Noncanonical observer import');
  } catch { throw new Error('Unsafe observer import'); }
  const insertions: ScrollCauseInsertion[] = [];
  const locate = (needle: string) => {
    const first = source.indexOf(needle);
    if (first < 0 || source.indexOf(needle, first + 1) >= 0) throw new Error('Nonunique virtualizer site');
    return first;
  };
  const before = (needle: string, text: string) => insertions.push({ offset: locate(needle), text });
  const after = (needle: string, text: string) => insertions.push({ offset: locate(needle) + needle.length, text });
  insertions.push({ offset: 0, text: `import { scrollCauseObserver as ${PREFIX} } from ${JSON.stringify(observerImport)};\n` });
  after('    this.resizeItem = (index, size) => {', `\n      const ${PREFIX}Resize = ${PREFIX}.enter(this, index, size);\n      let ${PREFIX}Normal = true, ${PREFIX}Predicate = 0;\n      try {`);
  before('    };\n    this.getVirtualItems = memo(', `      } catch (${PREFIX}Error) { ${PREFIX}Normal = false; throw ${PREFIX}Error; } finally { ${PREFIX}.exit(this, ${PREFIX}Resize, ${PREFIX}Normal); }\n`);
  after('this.shouldAdjustScrollPositionOnItemSizeChange !== void 0 ? ', `(${PREFIX}Predicate = 1, `);
  before(') : defaultShouldAdjust);', ')');
  // Both operand wrappers preserve the original member-call receiver and the
  // guard/call getter reads, including a getter which returns different values.
  const defaultSite = locate(') : defaultShouldAdjust);');
  insertions.push({ offset: defaultSite + 4, text: `(${PREFIX}Predicate = 2, ` });
  insertions.push({ offset: defaultSite + ') : defaultShouldAdjust'.length, text: ')' });
  after('        let adjustedSync = false;', `\n        ${PREFIX}.decision(this, ${PREFIX}Resize, key, index, itemStart, cachedSize, itemSize, size, delta, scrollOffsetWithAdj, isFirstMeasure, defaultShouldAdjust, shouldAdjustScroll, wasAtEnd, awaitingCommandReadBack, ${PREFIX}Predicate);`);
  const wrap = (call: string, branch: number) => {
    before(call, `const ${PREFIX}Scope = ${PREFIX}.open(this, ${PREFIX}Resize, ${branch});\n            let ${PREFIX}Returned = false;\n            try {\n            `);
    after(call, `\n            ${PREFIX}Returned = true;\n            } finally { ${PREFIX}.close(this, ${PREFIX}Resize, ${PREFIX}Scope, ${PREFIX}Returned, adjustedSync); }`);
  };
  wrap('adjustedSync = this.applyScrollAdjustment(\n              this.getTotalSize() - prevTotalSize\n            );', 2);
  wrap('adjustedSync = this.applyScrollAdjustment(delta);', 1);
  // Capture the existing expression rather than repeat coercion or read the
  // pendingWrite object. These insertions leave its value and evaluation intact.
  before('      this.pendingWrite = {', `      let ${PREFIX}Target;\n`);
  after('        target: ', `(${PREFIX}Target = `);
  after('        target: offset + (adjustments ?? 0)', ')');
  before('      this.options.scrollToFn(offset, { behavior, adjustments }, this);', `      ${PREFIX}.request(this, offset, adjustments, behavior, ${PREFIX}Target);\n`);
  // The exact original optional call has completed. Reuse only its assigned
  // receiver/method locals: no second getter, invocation or argument object.
  const delegateEnd = locate('    behavior\n  });\n};\nconst windowScroll');
  insertions.push({ offset: delegateEnd + '    behavior\n  });'.length, text: `\n  ${PREFIX}.returned(instance, _a, _b, offset, adjustments, behavior);` });
  insertions.sort((a, b) => a.offset - b.offset);
  if (insertions.some((entry, index) => index > 0 && entry.offset === insertions[index - 1]!.offset)) throw new Error('Overlapping insertions');
  let code = source;
  for (const entry of [...insertions].reverse()) code = code.slice(0, entry.offset) + entry.text + code.slice(entry.offset);
  const result = { code, originalSha256: PINNED_SHA256, transformedSha256: hash(code), insertions };
  return result;
}

export function reverseScrollCause(result: ScrollCauseTransform): string {
  if (result.originalSha256 !== PINNED_SHA256 || hash(result.code) !== result.transformedSha256) throw new Error('Invalid transform receipt');
  let cursor = 0, shift = 0, original = '';
  for (const entry of result.insertions) {
    if (!Number.isSafeInteger(entry.offset) || entry.offset < cursor || typeof entry.text !== 'string') throw new Error('Invalid insertion');
    const actual = entry.offset + shift;
    original += result.code.slice(cursor + shift, actual);
    if (result.code.slice(actual, actual + entry.text.length) !== entry.text) throw new Error('Insertion mismatch');
    cursor = entry.offset; shift += entry.text.length;
  }
  original += result.code.slice(cursor + shift);
  if (Buffer.byteLength(original) !== 54156 || hash(original) !== PINNED_SHA256) throw new Error('Original reconstruction mismatch');
  const match = /^import \{ scrollCauseObserver as __scrollCauseV1 \} from ("[^"\n]+");\n/.exec(result.code);
  if (!match) throw new Error('Missing observer binding');
  const canonical = transformScrollCause(original, PINNED_MODULE, JSON.parse(match[1]!));
  if (canonical.code !== result.code || JSON.stringify(canonical.insertions) !== JSON.stringify(result.insertions)) throw new Error('Unrecognized insertion');
  return original;
}
