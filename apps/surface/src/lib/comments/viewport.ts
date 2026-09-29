


// Fixed-position coordinates use the layout viewport; visualViewport offsets
// identify the part still visible after keyboard panning or pinch zoom.
export const composerPlacement = (viewport: ViewportBounds, anchor: AnchorBounds, measuredHeight: number, contentTop: number) => {
  const left = viewport.x + 12;
  const top = Math.max(viewport.y + 12, viewport.height >= 400 ? contentTop + 8 : viewport.y + 12);
  const bottom = viewport.y + viewport.height - 32;
  const width = Math.max(1, Math.min(310, viewport.width - 24));
  const maxHeight = Math.max(1, bottom - top);
  const height = Math.min(measuredHeight || 280, maxHeight);
  return { x: clamp(anchor.left, left, viewport.x + viewport.width - width - 12),
    y: clamp(anchor.bottom + 10, top, bottom - height), width, maxHeight };
};


/** Translate the visible parent area into a mounted frame's layout coordinates. */
export const clipViewportToFrame = (local: ViewportBounds, parent: ViewportBounds, frame: ViewportBounds): ViewportBounds => {
  const x = Math.max(local.x, parent.x - frame.x, 0);
  const y = Math.max(local.y, parent.y - frame.y, 0);
  const right = Math.min(local.x + local.width, parent.x + parent.width - frame.x, frame.width);
  const bottom = Math.min(local.y + local.height, parent.y + parent.height - frame.y, frame.height);
  return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
};

export const readViewport = (window: Window): ViewportBounds => {
  const viewport = window.visualViewport;
  const local = viewport ? { x: viewport.offsetLeft, y: viewport.offsetTop, width: viewport.width, height: viewport.height }
    : { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
  // Surface tabs are same-origin frames. Their own visual viewport stays at the
  // layout size when the outer phone keyboard opens, so intersect each ancestor.
  try {
    const frame = window.frameElement;
    if (window.parent !== window && frame) {
      const rect = frame.getBoundingClientRect();
      return clipViewportToFrame(local, readViewport(window.parent), { x: rect.left + frame.clientLeft, y: rect.top + frame.clientTop, width: frame.clientWidth, height: frame.clientHeight });
    }
  } catch { /* A foreign embedding origin cannot expose its viewport. */ }
  return local;
};

/** Follow keyboard/pan changes in the document and its same-origin ancestors. */
export const observeViewport = (window: Window, update: () => void): (() => void) => {
  const cleanups: (() => void)[] = [];
  const observe = (target: EventTarget, type: string) => {
    target.addEventListener(type, update, true);
    cleanups.push(() => target.removeEventListener(type, update, true));
  };
  let current = window;
  while (true) {
    observe(current, 'resize'); observe(current, 'scroll');
    if (current.visualViewport) { observe(current.visualViewport, 'resize'); observe(current.visualViewport, 'scroll'); }
    try {
      if (current.parent === current || !current.frameElement) break;
      current = current.parent;
    } catch { break; }
  }
  return () => { for (const cleanup of cleanups) cleanup(); };
};
export type ViewportBounds = { x: number; y: number; width: number; height: number };
export type AnchorBounds = { left: number; bottom: number };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, Math.max(min, max)));
