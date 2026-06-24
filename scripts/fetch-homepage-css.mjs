#!/usr/bin/env node
/**
 * Download CSS assets from live degroteverzorginggids.nl homepage.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SITE,
  extractStylesheets,
  downloadCss,
  downloadAllFontsFromCssDir,
} from './lib/page-fetch-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STYLESHEETS_PATH = path.join(ROOT, 'src/data/stylesheets.json');

const EXTRA_CSS = [
  `${SITE}/wp-content/plugins/elementor-pro/assets/css/widget-table-of-contents.min.css`,
  `${SITE}/wp-content/plugins/elementor/assets/css/widget-accordion.min.css`,
  `${SITE}/wp-content/plugins/elementor/assets/css/widget-counter.min.css`,
  `${SITE}/wp-content/plugins/elementor-pro/assets/css/widget-breadcrumbs.min.css`,
  `${SITE}/wp-content/plugins/elementor-pro/assets/css/widget-posts.min.css`,
  `${SITE}/wp-includes/css/dist/block-library/style.min.css`,
];

async function main() {
  console.log('Fetching homepage for CSS list...');
  const res = await fetch(`${SITE}/`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DGG-Migration/1.0)' },
  });
  if (!res.ok) throw new Error(`Homepage fetch failed: ${res.status}`);
  const html = await res.text();

  const urls = [...new Set([...extractStylesheets(html), ...EXTRA_CSS.map((u) => u.split('?')[0])])];
  const stylesheets = [];

  console.log(`Downloading ${urls.length} CSS files...`);
  for (const url of urls) {
    try {
      const href = await downloadCss(ROOT, url);
      if (!stylesheets.includes(href)) {
        stylesheets.push(href);
        console.log(`  ${href}`);
      }
    } catch (err) {
      console.warn(`  Skip: ${url} (${err.message})`);
    }
  }

  const fixFiles = [
    'public/css/site-nav-fixes.css',
    'public/css/homepage-inline.css',
    'public/css/product-page-fixes.css',
    'public/css/blog-post-fixes.css',
    'public/css/blog-listing-fixes.css',
    'public/css/contact-page-fixes.css',
  ];
  for (const file of fixFiles) {
    if (fs.existsSync(path.join(ROOT, file))) {
      stylesheets.push(`/${file.replace(/^public\//, '')}`);
    }
  }

  fs.mkdirSync(path.dirname(STYLESHEETS_PATH), { recursive: true });
  fs.writeFileSync(STYLESHEETS_PATH, JSON.stringify([...new Set(stylesheets)].sort(), null, 2));
  console.log(`Saved ${stylesheets.length} stylesheets to src/data/stylesheets.json`);

  console.log('Downloading icon and web fonts...');
  await downloadAllFontsFromCssDir(ROOT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
