/** Selected DOM correspondence only: these observations do not establish paint or FPS. */
export function observeMatrixDOM({ selectors, responseId = null, anchorId = null, countMounted = false, maxResponseCharacters = 262144 }) {
  // Keep every dependency inside this function: callers serialize it into Chromium.
  const result = {
    schema: 'matrix-dom-selected-v3', mountedCount: null, errors: [],
    clip: { left: 0, top: 0, right: 0, bottom: 0 },
    scroll: { top: 0, height: 0, clientHeight: 0, rect: { x: 0, y: 0, width: 0, height: 0 } },
    items: [], missingContentCount: 0,
  };
  const fail = code => { if (!result.errors.includes(code)) result.errors.push(code); };
  const finite = values => values.every(Number.isFinite);
  const rectOf = rect => ({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom });
  const validRect = rect => finite(Object.values(rect)) && rect.right >= rect.left && rect.bottom >= rect.top;
  const visible = element => element.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true, opacityProperty: true });
  try {
    if (!selectors || !['scroller', 'message', 'messageContent'].every(key => typeof selectors[key] === 'string' && selectors[key].length > 0 && selectors[key].length <= 2048)
      || !Number.isInteger(maxResponseCharacters) || maxResponseCharacters < 1 || maxResponseCharacters > 262144
      || typeof countMounted !== 'boolean'
      || ![responseId, anchorId].every(id => id === null || (typeof id === 'string' && id.length > 0 && id.length <= 128))) {
      fail('observer-options'); return result;
    }
    const scrollers = document.querySelectorAll(selectors.scroller);
    if (scrollers.length !== 1 || !(scrollers[0] instanceof HTMLElement)) { fail('scroller-unique'); return result; }
    const scroller = scrollers[0];
    const box = scroller.getBoundingClientRect();
    result.scroll = { top: scroller.scrollTop, height: scroller.scrollHeight, clientHeight: scroller.clientHeight,
      rect: { x: box.x, y: box.y, width: box.width, height: box.height } };
    result.clip = { left: Math.max(0, box.left + scroller.clientLeft), top: Math.max(0, box.top + scroller.clientTop),
      right: Math.min(innerWidth, box.left + scroller.clientLeft + scroller.clientWidth),
      bottom: Math.min(innerHeight, box.top + scroller.clientTop + scroller.clientHeight) };
    if (!validRect(result.clip) || !finite([...Object.values(result.scroll.rect), result.scroll.top, result.scroll.height, result.scroll.clientHeight])
      || box.width <= 0 || box.height <= 0 || result.clip.right <= result.clip.left || result.clip.bottom <= result.clip.top
      || result.scroll.height < 0 || result.scroll.clientHeight < 0) { fail('scroller-geometry'); return result; }
    if (countMounted) result.mountedCount = scroller.querySelectorAll(selectors.message).length;
    const clip = result.clip;
    const hits = [];
    const selected = new Set();
    const outerRects = new Map();
    const rootFor = element => {
      const root = element?.closest(selectors.message);
      return root && root !== scroller && scroller.contains(root) ? root : null;
    };
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
      const target = document.elementFromPoint(clip.left + (x + 0.5) * (clip.right - clip.left) / 5,
        clip.top + (y + 0.5) * (clip.bottom - clip.top) / 5);
      const root = rootFor(target);
      hits.push(root);
      if (root) selected.add(root);
    }
    const attributes = ['data-message-id', 'data-bench-message-id', 'data-bench-message'];
    // Indices 25 and 26 are reserved for actual response/anchor clipped centers.
    // There are at most 27 hit tests, independent of the mounted history length.
    for (const id of [responseId, anchorId]) {
      let accepted = null;
      const found = id === null ? null : document.querySelector(attributes.map(attribute => `[${attribute}="${CSS.escape(id)}"]`).join(','));
      const root = rootFor(found);
      if (root && root === found && visible(root)) {
        const rect = rectOf(root.getBoundingClientRect());
        if (!validRect(rect)) fail('message-geometry');
        else {
          outerRects.set(root, rect);
          const left = Math.max(rect.left, clip.left), top = Math.max(rect.top, clip.top);
          const right = Math.min(rect.right, clip.right), bottom = Math.min(rect.bottom, clip.bottom);
          if (right > left && bottom > top && rootFor(document.elementFromPoint((left + right) / 2, (top + bottom) / 2)) === root) {
            selected.add(root); accepted = root;
          }
        }
      }
      hits.push(accepted);
    }
    if (selected.size > 32) { fail('selected-root-cap'); return result; }
    let totalCharacters = 0;
    const identities = new Set();
    for (const root of selected) {
      // In particular, do not query the content before outer-root visibility and hit checks.
      if (!visible(root)) continue;
      const outerRect = outerRects.get(root) ?? rectOf(root.getBoundingClientRect());
      if (!validRect(outerRect)) { fail('message-geometry'); continue; }
      if (Math.min(outerRect.right, clip.right) <= Math.max(outerRect.left, clip.left)
        || Math.min(outerRect.bottom, clip.bottom) <= Math.max(outerRect.top, clip.top)) continue;
      const hitPoints = hits.flatMap((hit, index) => hit === root ? [index] : []);
      if (hitPoints.length === 0) continue;
      const ids = attributes.filter(attribute => root.hasAttribute(attribute)).map(attribute => [attribute, root.getAttribute(attribute)]);
      const nativeId = ids[0]?.[1] ?? null;
      if (ids.some(([, id]) => id !== nativeId) || (nativeId !== null && (!nativeId || nativeId.length > 128 || identities.has(nativeId)))) {
        fail('message-identity'); continue;
      }
      if (nativeId !== null) identities.add(nativeId);
      const content = root.matches(selectors.messageContent) ? root : root.querySelector(selectors.messageContent);
      if (!content || !visible(content)) { result.missingContentCount++; continue; }
      const rect = rectOf(content.getBoundingClientRect());
      if (!validRect(rect)) { fail('content-geometry'); continue; }
      if (Math.min(rect.right, clip.right) <= Math.max(rect.left, clip.left)
        || Math.min(rect.bottom, clip.bottom) <= Math.max(rect.top, clip.top)) { result.missingContentCount++; continue; }
      const text = content.textContent ?? '';
      const cap = nativeId === null || nativeId === responseId ? maxResponseCharacters : 512;
      if (text.length > cap || totalCharacters + text.length > maxResponseCharacters + 32 * 512) { fail('message-text-cap'); continue; }
      if (!text.length) { result.missingContentCount++; continue; }
      totalCharacters += text.length;
      result.items.push({ nativeId, identityAttribute: ids[0]?.[0] ?? null, text, visible: true, rect, hitPoints });
    }
  } catch {
    fail('observer-access');
  }
  return result;
}
