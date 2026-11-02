import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { observeMatrixDOM } from './matrix-observer-v3.mjs';

let browser, page;
const selectors = { scroller: '#scroll', message: '.message', messageContent: '.content' };
before(async () => {
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 800, height: 600 } });
});
after(async () => { await browser?.close(); });
async function setup(rows, extra = '') {
  await page.goto('about:blank');
  await page.setContent(`<style>body{margin:0}#scroll{position:absolute;left:20px;top:30px;width:400px;height:300px;border:4px solid;overflow:auto}.message{height:80px}.content{margin-left:8px;min-height:70px} ${extra}</style><div id="scroll">${rows}</div>`);
}
const row = (id, text = 'x'.repeat(512), attrs = '') => `<div class="message" data-message-id="${id}" ${attrs}><div class="content">${text}</div></div>`;
const observe = (options = {}) => page.evaluate(observeMatrixDOM, { selectors, ...options });

test('self-contained serialized observer reports exact client clip and visible native content', async () => {
  await setup(row('h1') + row('response', 'real prefix'));
  const actual = await observe({ responseId: 'response' });
  assert.equal(actual.schema, 'matrix-dom-selected-v3');
  assert.deepEqual(actual.errors, []);
  assert.equal(actual.mountedCount, null);
  assert.deepEqual(actual.clip, { left: 24, top: 34, right: 424, bottom: 334 });
  assert.equal(actual.scroll.top, 0);
  assert.equal(actual.items.find(x => x.nativeId === 'response').text, 'real prefix');
  for (const item of actual.items) {
    assert.equal(item.visible, true);
    assert.equal(item.identityAttribute, 'data-message-id');
    assert.ok(item.hitPoints.length > 0);
    assert.ok(item.hitPoints.every(x => Number.isInteger(x) && x >= 0 && x < 27));
  }
});

test('10k mounted roots: hidden/offscreen poisoned descendants are never read or laid out, including direct IDs', async () => {
  await setup(row('visible') + Array.from({ length: 9999 }, (_, i) => row(`off-${i}`)).join(''));
  await page.evaluate(() => {
    window.poisonReads = 0;
    for (const content of document.querySelectorAll('.message:not(:first-child) .content')) {
      Object.defineProperty(content, 'textContent', { get() { window.poisonReads++; throw Error('offscreen-text'); } });
      content.getBoundingClientRect = () => { window.poisonReads++; throw Error('offscreen-layout'); };
    }
    // Keep one actual visible message; all other outer roots are genuinely offscreen.
    document.querySelector('.message').style.height = '400px';
    const original = Element.prototype.querySelectorAll;
    Element.prototype.querySelectorAll = function(s) {
      if (s === '.message') throw Error('all-mounted-not-bookend');
      return original.call(this, s);
    };
    const originalDocument = document.querySelectorAll.bind(document);
    document.querySelectorAll = s => {
      if (s === '.message') throw Error('all-mounted-not-bookend');
      return originalDocument(s);
    };
    window.restoreCountQueries = () => {
      Element.prototype.querySelectorAll = original;
      document.querySelectorAll = originalDocument;
    };
  });
  const selected = await observe({ responseId: 'off-9998', anchorId: 'off-5000' });
  assert.deepEqual(selected.errors, []);
  assert.deepEqual(selected.items.map(x => x.nativeId), ['visible']);
  assert.equal(await page.evaluate(() => window.poisonReads), 0);
  await page.evaluate(() => window.restoreCountQueries());
  assert.equal((await observe({ countMounted: true })).mountedCount, 10000);
  assert.equal(await page.evaluate(() => window.poisonReads), 0);
});

test('direct ID alone never accepts occluded or hidden content', async () => {
  await setup(row('covered') + row('hidden', 'secret', 'style="visibility:hidden"'));
  await page.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', '<div style="position:absolute;left:24px;top:34px;width:400px;height:80px;background:white;z-index:5"></div>');
    for (const content of document.querySelectorAll('.content')) {
      Object.defineProperty(content, 'textContent', { get() { throw Error('forbidden-descendant-read'); } });
      content.getBoundingClientRect = () => { throw Error('forbidden-descendant-rect'); };
    }
  });
  const actual = await observe({ responseId: 'covered', anchorId: 'hidden' });
  assert.deepEqual(actual.errors, []);
  assert.deepEqual(actual.items, []);
});

test('thin actual response and anchor roots get bounded clipped-center hits beyond the fixed grid', async () => {
  await setup(row('response', 'prefix') + row('anchor', 'history'), '.message{height:10px}.content{min-height:10px;height:10px;font-size:8px;line-height:10px}');
  const actual = await observe({ responseId: 'response', anchorId: 'anchor' });
  assert.deepEqual(actual.errors, []);
  assert.equal(actual.items.find(x => x.nativeId === 'response')?.text, 'prefix');
  assert.ok(actual.items.find(x => x.nativeId === 'response')?.hitPoints.includes(25));
  assert.ok(actual.items.find(x => x.nativeId === 'anchor')?.hitPoints.includes(26));
});

test('contradictory native identities are fatal and missing content is recoverable', async () => {
  await setup(row('one', 'text', 'data-bench-message-id="other"'));
  assert.ok((await observe()).errors.some(x => /identity/.test(x)));
  await setup('<div class="message" data-bench-message="unmounted"></div>');
  const missing = await observe();
  assert.deepEqual(missing.errors, []);
  assert.equal(missing.missingContentCount, 1);
  assert.deepEqual(missing.items, []);
});

test('historical and actual response caps reject overflow without truncation', async () => {
  await setup(row('history', 'h'.repeat(513)));
  assert.ok((await observe()).errors.some(x => /text-cap/.test(x)));
  await setup(row('response', 'r'.repeat(6400)));
  assert.equal((await observe({ responseId: 'response', maxResponseCharacters: 6400 })).items[0].text.length, 6400);
  await setup(row('response', 'r'.repeat(6401)));
  assert.ok((await observe({ responseId: 'response', maxResponseCharacters: 6400 })).errors.some(x => /text-cap/.test(x)));
  assert.ok((await observe({ maxResponseCharacters: Infinity })).errors.length > 0);
  await setup(row('response', 'r'.repeat(262144)));
  const largest = await observe({ responseId: 'response' });
  assert.deepEqual(largest.errors, []);
  assert.equal(largest.items[0].text.length, 262144);
});

test('unknown native IDs have a bounded aggregate fallback and invalid geometry is fatal', async () => {
  await setup(Array.from({ length: 4 }, () => '<div class="message"><div class="content">' + 'x'.repeat(6400) + '</div></div>').join(''));
  const actual = await observe({ maxResponseCharacters: 6400 });
  assert.ok(actual.errors.some(x => /text-cap/.test(x)));
  await setup(row('geometry'));
  await page.evaluate(() => { document.querySelector('.content').getBoundingClientRect = () => ({ left: NaN, top: 0, right: 10, bottom: 10 }); });
  assert.ok((await observe()).errors.some(x => /geometry/.test(x)));
});

test('scroller uniqueness and clip intersection are validated', async () => {
  await setup(row('one'));
  await page.evaluate(() => document.body.append(document.querySelector('#scroll').cloneNode(true)));
  assert.ok((await observe()).errors.some(x => /scroller/.test(x)));
  await setup(row('one'), '#scroll{left:-100px;top:-100px}');
  const actual = await observe();
  assert.equal(actual.clip.left, 0);
  assert.equal(actual.clip.top, 0);
});
