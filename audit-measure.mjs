import { chromium } from 'playwright';

const url = 'http://localhost:4173/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const results = [];

const log = (o) => results.push(o);

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

// ---- Geometry helpers ----
const box = async (sel) => page.locator(sel).first().boundingBox();
const boxes = async (sel) => page.locator(sel).evaluateAll((els) => els.map((el) => {
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), fs: cs.fontSize, fw: cs.fontWeight, lh: cs.lineHeight, ff: cs.fontFamily, color: cs.color, bg: cs.backgroundColor, padding: cs.padding, radius: cs.borderRadius, border: cs.border };
}));

// Sidebar geometry
const sidebar = await box('.sidebar');
const header = await box('.content-header');
const cards = await boxes('.model-card');

log({ k: 'sidebar', ...sidebar });
log({ k: 'content-header', ...header });
log({ k: 'cards(3)', cards: cards.slice(0, 3) });

// Header control spacing
const headerControls = await page.locator('.header-controls').evaluateAll((els) => els.map((el) => {
  const children = Array.from(el.children);
  return children.map((c) => {
    const r = c.getBoundingClientRect();
    const cs = getComputedStyle(c);
    return { tag: c.tagName, cls: c.className, x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), fs: cs.fontSize, ff: cs.fontFamily.split(',')[0] };
  });
}));
log({ k: 'header-controls', controls: headerControls[0] });

// Typography inventory
const type = await page.evaluate(() => {
  const out = {};
  document.querySelectorAll('h1,h2,h3,button,a,.content-title,.content-count,.menu-label,.model-name,.model-id,.stat-chip,.tier-badge,.brand-name,.brand-sub,.legend-title,.legend-label,.legend-item,.last-updated,.menu-badge,.menu-section-title,.modal-title,.modal-model-id code,.alt-list-title,.alt-item-name,.alt-item-reason,.compare-bar-count,.search-input,.sort-select,.free-toggle,.compare-th-name,.compare-table th,.compare-table td').forEach((el) => {
    const cs = getComputedStyle(el);
    const key = `${cs.fontFamily.split(',')[0].trim()} ${cs.fontSize} ${cs.fontWeight} ${cs.lineHeight}`;
    if (!out[key]) out[key] = { count: 0, cls: [] };
    out[key].count++;
    if (out[key].cls.length < 4) out[key].cls.push(el.className.toString().slice(0, 30));
  });
  return out;
});
log({ k: 'typography', type });

// Colors used
const colors = await page.evaluate(() => {
  const out = {};
  document.querySelectorAll('*').forEach((el) => {
    const cs = getComputedStyle(el);
    ['color', 'backgroundColor', 'borderColor'].forEach((p) => {
      const v = cs[p];
      if (v && v !== 'rgba(0, 0, 0, 0)' && v !== 'transparent') {
        out[v] = (out[v] || 0) + 1;
      }
    });
  });
  return Object.entries(out).sort((a, b) => b[1] - a[1]).slice(0, 40);
});
log({ k: 'colors-top40', colors });

// Radius inventory
const radii = await page.evaluate(() => {
  const out = {};
  document.querySelectorAll('*').forEach((el) => {
    const r = getComputedStyle(el).borderRadius;
    if (r && r !== '0px') out[r] = (out[r] || 0) + 1;
  });
  return Object.entries(out).sort((a, b) => b[1] - a[1]);
});
log({ k: 'radii', radii });

// Contrast checks (WCAG relative luminance)
const contrast = (c1, c2) => {
  const lum = (c) => {
    if (!c || typeof c !== 'string') return 0;
    const clean = c.replace(/rgba?\(/, '').replace(')', '');
    const a = clean.split(',').map((x) => parseFloat(x) / 255).slice(0, 3).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  };
  const l1 = lum(c1), l2 = lum(c2);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
};

const contrastChecks = [
  ['body', '--text-secondary usage', 'var(--text-secondary)', '#a1a1aa', '#09090b'],
  ['body', '--text-muted', 'var(--text-muted)', '#9d9da5', '#09090b'],
  ['model-id', 'model-id on bg-panel', 'x', '#9d9da5', '#111113'],
  ['model-id', 'model-id on card', 'x', '#9d9da5', '#121214'],
  ['content-count', 'content-count on base', 'x', '#9d9da5', '#09090b'],
  ['stat-chip', 'stat-chip text', 'x', '#a1a1aa', '#141416'],
  ['tier-badge free', 'free on card', '#10b981', '#121214'],
  ['badge budget', 'budget on card', '#3b82f6', '#121214'],
  ['badge balanced', 'balanced', '#8b5cf6', '#121214'],
  ['badge premium', 'premium', '#f59e0b', '#121214'],
  ['placeholder', 'placeholder', 'placeholder', '#9d9da5', '#111113'],
  ['light: muted', 'light muted on light base', 'x', '#636a75', '#fafafa'],
  ['light: secondary', 'light secondary', 'x', '#3f3f46', '#fafafa'],
];
log({ k: 'contrast', checks: contrastChecks.map(([, , , fg, bg]) => ({ label: `${fg} on ${bg}`, ratio: +contrast(fg, bg).toFixed(2), passAA: contrast(fg, bg) >= 4.5, passAA18: contrast(fg, bg) >= 3, fg, bg })) });

// Search input width vs container
const searchWrap = await box('.search-wrap');
log({ k: 'search-wrap', ...searchWrap });

await browser.close();
console.log(JSON.stringify(results, null, 1));
