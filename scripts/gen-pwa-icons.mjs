/**
 * Generate PWA icons by screenshotting an inline HTML page that renders
 * the same gradient-target mark used in `<Logo />`.
 *
 * Produces `public/icons/icon-{192,512,512-maskable}.png`.
 * Run once with `node scripts/gen-pwa-icons.mjs`. Re-run if the brand
 * mark changes.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT_DIR = resolve('public/icons');
mkdirSync(OUT_DIR, { recursive: true });

// `inset` is the padding around the target so it doesn't bleed into the
// rounded corner. Maskable variant uses a larger inset because Android
// crops the safe zone (~10% on each side).
function makeHtml({ size, inset, maskable }) {
  const innerSize = size - inset * 2;
  // The icon viewbox is 24x24 (same as the Logo SVG).
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html, body { margin: 0; padding: 0; background: transparent; }
  body {
    width: ${size}px;
    height: ${size}px;
    display: grid;
    place-items: center;
    ${maskable ? 'background: hsl(142 70% 32%);' : ''}
  }
  .box {
    width: ${innerSize}px;
    height: ${innerSize}px;
    border-radius: ${maskable ? 0 : Math.round(innerSize * 0.22)}px;
    background: linear-gradient(135deg, hsl(142 70% 32%) 0%, hsl(142 70% 27%) 100%);
    display: grid;
    place-items: center;
    box-shadow: 0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.08);
  }
  svg { width: ${Math.round(innerSize * 0.6)}px; height: ${Math.round(innerSize * 0.6)}px; }
</style></head>
<body>
  <div class="box">
    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" fill="#fff" />
    </svg>
  </div>
</body></html>`;
}

async function render({ size, inset, maskable, file }) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1
  });
  const page = await ctx.newPage();
  await page.setContent(makeHtml({ size, inset, maskable }), {
    waitUntil: 'load'
  });
  await page.screenshot({
    path: resolve(OUT_DIR, file),
    omitBackground: !maskable,
    type: 'png'
  });
  await browser.close();
  console.log('✓', file);
}

await render({ size: 192, inset: 16, maskable: false, file: 'icon-192.png' });
await render({ size: 512, inset: 36, maskable: false, file: 'icon-512.png' });
await render({
  size: 512,
  inset: 80,
  maskable: true,
  file: 'icon-512-maskable.png'
});

console.log('\nIcons generated in', OUT_DIR);
