import { describe, expect, test } from 'bun:test';
import { composerPlacement } from './viewport.ts';

describe('comment composer visible viewport', () => {
  test('keyboard bounds use visible height and pan offset rather than layout height', () => {
    const p = composerPlacement({ x: 0, y: 180, width: 390, height: 320 }, { left: 20, bottom: 640 }, 430, 60);
    expect(p.y).toBeGreaterThanOrEqual(192);
    expect(p.y + Math.min(430, p.maxHeight)).toBeLessThanOrEqual(468);
    expect(p.maxHeight).toBe(276);
  });
  test('an unclamped composer follows the selected element when the page scrolls', () => {
    const v = { x: 0, y: 0, width: 390, height: 844 };
    const before = composerPlacement(v, { left: 20, bottom: 300 }, 220, 60);
    const after = composerPlacement(v, { left: 20, bottom: 240 }, 220, 60);
    expect(after.y - before.y).toBe(-60);
  });
  test('horizontal visual viewport panning and narrow zoom keep the full width visible', () => {
    const p = composerPlacement({ x: 70, y: 100, width: 240, height: 350 }, { left: 0, bottom: 10 }, 280, 60);
    expect(p.x).toBe(82);
    expect(p.width).toBe(216);
    expect(p.y).toBe(112);
  });
  test('keyboard dismissal restores space without retaining a shrunken max height', () => {
    const small = composerPlacement({ x: 0, y: 100, width: 390, height: 280 }, { left: 20, bottom: 290 }, 400, 60);
    const restored = composerPlacement({ x: 0, y: 0, width: 390, height: 844 }, { left: 20, bottom: 290 }, 400, 60);
    expect(restored.maxHeight).toBeGreaterThan(small.maxHeight);
    expect(restored.y).toBe(300);
  });
});
