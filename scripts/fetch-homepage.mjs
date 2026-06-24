#!/usr/bin/env node
/**
 * Re-fetch homepage HTML from live degroteverzorginggids.nl.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SITE,
  rewriteHtml,
  extractHeader,
  extractMain,
  extractFooter,
  collectUploadPaths,
  downloadImage,
} from './lib/page-fetch-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'src/data/homepage');

async function main() {
  console.log('Fetching live homepage...');
  const res = await fetch(`${SITE}/`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DGG-Migration/1.0)' },
  });
  if (!res.ok) throw new Error(`Homepage fetch failed: ${res.status}`);
  const html = await res.text();

  const headerHtml = rewriteHtml(extractHeader(html));
  const mainHtml = rewriteHtml(extractMain(html));
  const footerHtml = rewriteHtml(extractFooter(html));

  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  const descMatch = html.match(/<meta name="description" content="([^"]*)"/);
  const modifiedMatch = html.match(/<meta property="article:modified_time" content="([^"]+)"/);
  const ogImageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
  const bodyClass = html.match(/<body[^>]*class="([^"]*)"/)?.[1] ?? '';

  const meta = {
    title: titleMatch?.[1] || 'DeGroteGadgetsGids.nl',
    description: descMatch?.[1] || 'Vergelijk online de nieuwste gadgets',
    canonical: '/',
    modifiedTime: modifiedMatch?.[1] || '',
    ogImage:
      ogImageMatch?.[1]?.replace(SITE, '').replace('/wp-content/uploads/', '/uploads/') ||
      '/uploads/2023/01/cropped-Frame-609.png',
    bodyClass,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'header.html'), headerHtml);
  fs.writeFileSync(path.join(OUT_DIR, 'main.html'), mainHtml);
  fs.writeFileSync(path.join(OUT_DIR, 'footer.html'), footerHtml);
  fs.writeFileSync(path.join(OUT_DIR, 'meta.json'), JSON.stringify(meta, null, 2));

  const images = collectUploadPaths(headerHtml, mainHtml, footerHtml);
  const favicons = [
    '/uploads/2023/01/cropped-Frame-609-32x32.png',
    '/uploads/2023/01/cropped-Frame-609-192x192.png',
    '/uploads/2023/01/cropped-Frame-609-180x180.png',
    '/uploads/2023/01/cropped-Frame-609.png',
  ];
  console.log(`Downloading ${images.length} homepage images...`);
  for (const imagePath of [...new Set([...images, ...favicons])]) {
    await downloadImage(ROOT, imagePath);
  }

  const favicon32 = path.join(ROOT, 'public/uploads/2023/01/cropped-Frame-609-32x32.png');
  const faviconRoot = path.join(ROOT, 'public/favicon.png');
  if (fs.existsSync(favicon32)) {
    fs.copyFileSync(favicon32, faviconRoot);
  }

  console.log('Homepage HTML updated.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
