import { toCanvas } from 'html-to-image';
import type { Capture } from './model.ts';


/** Capture only the element's visible rectangle, excluding annotation overlays. */
export const captureElement = async (element: HTMLElement): Promise<Capture> => {
  await document.fonts.ready;
  const rect = element.getBoundingClientRect();
  let left = Math.max(0, rect.left), top = Math.max(0, rect.top);
  let right = Math.min(innerWidth, rect.right), bottom = Math.min(innerHeight, rect.bottom);
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent), bounds = parent.getBoundingClientRect();
    if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { left = Math.max(left, bounds.left); right = Math.min(right, bounds.right); }
    if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom); }
  }
  if (right <= left || bottom <= top) throw new Error('Scroll the selected element into view before capturing.');
  if (rect.width * rect.height > 4_000_000) throw new Error('Select a smaller element to capture.');
  let backgroundColor = '#ffffff';
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const color = getComputedStyle(node).backgroundColor;
    if (color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)') { backgroundColor = color; break; }
  }
  const display = getComputedStyle(element).display;
  const source = await toCanvas(element, {
    width: rect.width, height: rect.height, pixelRatio: 1, backgroundColor, skipFonts: true,
    style: { margin: '0', display: display === 'inline' ? 'inline-block' : display },
  });
  const width = Math.round(right - left), height = Math.round(bottom - top);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image capture is unavailable in this browser.');
  const scaleX = source.width / rect.width, scaleY = source.height / rect.height;
  ctx.drawImage(source, (left - rect.left) * scaleX, (top - rect.top) * scaleY, width * scaleX, height * scaleY, 0, 0, width, height);
  const png = canvas.toDataURL('image/png');
  if (png.length > 1_500_000) throw new Error('This capture is too large. Select a smaller element.');
  return { png, width, height, capturedAt: new Date().toISOString(), method: 'dom-render', bounds: { x: left, y: top, width, height } };
};
