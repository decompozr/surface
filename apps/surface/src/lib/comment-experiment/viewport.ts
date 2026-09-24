


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


export const readViewport = (window: Window): ViewportBounds => {
  const viewport = window.visualViewport;
  return viewport ? { x: viewport.offsetLeft, y: viewport.offsetTop, width: viewport.width, height: viewport.height }
    : { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
};
export type ViewportBounds = { x: number; y: number; width: number; height: number };
export type AnchorBounds = { left: number; bottom: number };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, Math.max(min, max)));
