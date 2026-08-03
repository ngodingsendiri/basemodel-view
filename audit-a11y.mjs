import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const url = 'http://localhost:4173/';
const browser = await chromium.launch();
const results = [];
const log = (o) => results.push(o);

const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

// Force DARK theme
await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark'); });
await page.waitForTimeout(1500);

// Define lum2 in page context
await page.evaluate(() => {
  window.lum2 = (c) => {
    const m = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
    if (!m) return 0;
    return [m[1], m[2], m[3]].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  };
});

// Contrast in DARK
const darkContrast = await page.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    let bg = cs.backgroundColor;
    let p = el.parentElement;
    while (p && bg === 'rgba(0, 0, 0, 0)') { bg = getComputedStyle(p).backgroundColor; p = p.parentElement; }
    return { fg: cs.color, bg, fontSize: cs.fontSize };
  };
  const sels = ['.menu-label','.model-id','.content-count','.stat-chip','.stat-chip--price','.badge-tier-free','.badge-tier-budget','.badge-tier-balanced','.badge-tier-premium','.menu-badge','.api-key-link','.last-updated','.brand-sub','.menu-section-title','.legend-label','.legend-item','.modal-title','.alt-item-name','.alt-item-reason','.compare-th-name','.compare-th-id','.empty-state'];
  return sels.map((sel) => {
    const r = pick(sel);
    if (!r) return { sel, missing: true };
    const l1 = window.lum2(r.fg), l2 = window.lum2(r.bg);
    const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
    const ratio = +((hi + 0.05) / (lo + 0.05)).toFixed(2);
    return { sel, fg: r.fg, bg: r.bg, fontSize: r.fontSize, ratio, aa: ratio >= 4.5, aalarge: ratio >= 3 };
  });
});
log({ k: 'dark-contrast', darkContrast });

// Buttons font-family audit
const fonts = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('button, input, select').forEach((el) => {
    const ff = getComputedStyle(el).fontFamily.split(',')[0].trim();
    if (ff.toLowerCase() === 'arial') out.push({ tag: el.tagName, cls: el.className.toString().slice(0, 40), ff });
  });
  return out.slice(0, 50);
});
log({ k: 'controls-not-inter', fonts });

// Radius usage per component
const radiusUsage = await page.evaluate(() => {
  const sels = ['.menu-item', '.tier-badge', '.stat-chip', '.modality-chip', '.icon-btn', '.copy-btn', '.compare-toggle', '.search-clear', '.search-input', '.sort-select', '.share-link-btn', '.export-btn', '.clear-filters-btn', '.retry-btn', '.empty-state-action', '.alt-show-more', '.compare-th-remove', '.close-button', '.menu-avatar', '.compare-bar-btn', '.legend-item'];
  return sels.map((sel) => { const el = document.querySelector(sel); return el ? { sel, radius: getComputedStyle(el).borderRadius } : { sel, missing: true }; });
});
log({ k: 'radius-usage', radiusUsage });

// Box-shadows
const shadows = await page.evaluate(() => {
  const out = {};
  document.querySelectorAll('*').forEach((el) => {
    const s = getComputedStyle(el).boxShadow;
    if (s && s !== 'none') out[s] = (out[s] || 0) + 1;
  });
  return Object.entries(out).sort((a, b) => b[1] - a[1]);
});
log({ k: 'shadows', shadows });

// Axe scan (dark)
const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
log({ k: 'axe', violations: res.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help })) });

await context.close();
await browser.close();
console.log(JSON.stringify(results, null, 1));