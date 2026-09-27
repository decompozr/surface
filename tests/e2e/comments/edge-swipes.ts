import { expect, type Page } from '@playwright/test';
import { join } from 'node:path';

/** Trusted Chromium touch; WebKit synthetic events verify the recognizer, not native Safari history gestures. */
export const verifyEdgeSwipes = async (page: Page, trusted: boolean, output: string, name: string) => {
  const cdp = trusted ? await page.context().newCDPSession(page) : undefined;
  const width = page.viewportSize()!.width;
  const menu = page.getByRole('button', { name: 'Toggle navigation', exact: true });
  const comments = page.getByRole('button', { name: /Open comments/ });
  const swipe = async (points: number[][], cancel = false) => {
    if (cdp) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: points[0][0], y: points[0][1], id: 1 }] });
      for (const [x, y] of points.slice(1)) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] });
        await page.waitForTimeout(20);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
    } else {
      await page.evaluate(({ points, cancel }) => {
        const target = document.elementFromPoint(points[0][0], points[0][1])!;
        const emit = (type: string, point: number[], active: boolean) => {
          const touch = { identifier: 1, target, clientX: point[0], clientY: point[1], pageX: point[0], pageY: point[1], screenX: point[0], screenY: point[1] };
          const event = new Event(type, { bubbles: true, cancelable: true });
          Object.defineProperties(event, { touches: { value: active ? [touch] : [] }, targetTouches: { value: active ? [touch] : [] }, changedTouches: { value: [touch] } });
          target.dispatchEvent(event);
        };
        emit('touchstart', points[0], true);
        for (const point of points.slice(1)) emit('touchmove', point, true);
        emit(cancel ? 'touchcancel' : 'touchend', points.at(-1)!, false);
      }, { points, cancel });
    }
    await page.waitForTimeout(250);
  };
  const right = (x = 8) => [[x, 350], [x + 25, 350], [x + 55, 351], [x + 110, 351]];
  const left = (x = width - 8) => [[x, 350], [x - 25, 350], [x - 55, 351], [x - 110, 351]];
  const closed = async () => {
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await expect(comments).toHaveAttribute('aria-expanded', 'false');
  };
  try {
    await closed();
    await swipe(right());
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await page.screenshot({ path: join(output, `${name}-swipe-navigation.png`) });
    await swipe(left(180)); await closed();
    await expect(menu).toBeFocused();
    await swipe(left());
    await expect(comments).toHaveAttribute('aria-expanded', 'true');
    await page.screenshot({ path: join(output, `${name}-swipe-comments.png`) });
    await swipe(right(90)); await closed();
    await expect(comments).toBeFocused();
    await swipe([[8, 350], [28, 350], [40, 350]]); await closed();
    await swipe(right(90)); await closed();
    await swipe(right(), true); await closed();
    await swipe([[8, 350], [9, 325], [10, 300], [10, 250]]); await closed();
    for (const input of await page.getByRole('textbox').all()) {
      if (!await input.isVisible() || !await input.isEditable()) continue;
      const original = await input.inputValue();
      await input.fill('Retain gesture test draft');
      await swipe(right()); await closed();
      await expect(input).toHaveValue('Retain gesture test draft');
      await expect(input).toBeFocused();
      await input.fill(original);
      await input.blur();
      break;
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await cdp?.detach(); }
};
