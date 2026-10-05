import { chromium, webkit, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const origin = process.env.SURFACE_NAVIGATION_URL;
if (!origin) throw new Error('Set SURFACE_NAVIGATION_URL to the selected isolated or read-only review page.');
const output = resolve(process.env.SURFACE_NAVIGATION_OUTPUT ?? '.decompozr/surface/navigation-width');
mkdirSync(output, { recursive: true });

for (const [engine, browserType] of [['chromium', chromium], ['webkit', webkit]] as const) {
  const browser = await browserType.launch();
  try {
    for (const width of [1280, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 800 }, reducedMotion: 'no-preference' });
      await page.goto(origin, { waitUntil: 'networkidle' });
      const toggle = page.getByRole('button', { name: 'Toggle navigation', exact: true });
      const pane = page.locator('#surface-navigation');
      if (await toggle.getAttribute('aria-expanded') === 'true') await toggle.click();
      await page.waitForTimeout(250);
      const sample = async () => page.evaluate(async () => {
        const navigation = document.getElementById('surface-navigation');
        const content = document.querySelector('[data-dz-shell] > main');
        if (!navigation || !content) throw new Error('Missing shell navigation/content');
        const frames: { navigation: number; content: number; height: number }[] = [];
        const start = performance.now();
        do {
          frames.push({ navigation: navigation.getBoundingClientRect().width, content: content.getBoundingClientRect().width, height: navigation.scrollHeight });
          await new Promise<void>(done => requestAnimationFrame(() => done()));
        } while (performance.now() - start < 280);
        return frames;
      });
      const closed = await sample();
      const opening = sample();
      await toggle.click();
      const openFrames = await opening;
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(pane).toBeVisible();
      await page.screenshot({ path: `${output}/${engine}-${width}-open.png` });
      await Bun.write(`${output}/${engine}-${width}-opening.json`, JSON.stringify([...closed, ...openFrames], null, 2));
      const openingWidths = [...closed, ...openFrames].map(frame => frame.navigation);
      expect(Math.max(...openingWidths) - Math.min(...openingWidths), 'opening must not compress navigation text').toBeLessThan(1);
      const closing = sample();
      await page.keyboard.press('Escape');
      const closeFrames = await closing;
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(toggle).toBeFocused();
      const frames = [...closed, ...openFrames, ...closeFrames];
      await Bun.write(`${output}/${engine}-${width}.json`, JSON.stringify(frames, null, 2));
      const range = (values: number[]) => Math.max(...values) - Math.min(...values);
      expect(range(frames.map(frame => frame.navigation)), 'pane width remains fixed throughout opening/closing').toBeLessThan(1);
      expect(range(frames.map(frame => frame.content)), 'page width remains fixed throughout opening/closing').toBeLessThan(1);
      expect(range(frames.map(frame => frame.height)), 'navigation text does not reflow during the animation').toBeLessThan(1);
      await page.screenshot({ path: `${output}/${engine}-${width}-closed.png` });
      await page.close();
      console.log(`${engine} ${width}: fixed pane/content width, no animation reflow, Escape and focus restoration passed`);
    }
  } finally { await browser.close(); }
}
