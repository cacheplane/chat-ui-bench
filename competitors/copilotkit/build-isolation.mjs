import path from 'node:path';
import fs from 'node:fs';

export function assertIsolatedModule(id, root) {
  const file = id.replace(/^\0/, '').split('?')[0];
  if (!path.isAbsolute(file)) return null;
  const physical = fs.realpathSync(file);
  const owned = fs.realpathSync(root) + path.sep;
  const shared = path.resolve(root, '../shared/context.mjs');
  if (!physical.startsWith(owned) && physical !== shared) throw new Error('Copilot foreign frontend module: ' + physical);
  return physical;
}
