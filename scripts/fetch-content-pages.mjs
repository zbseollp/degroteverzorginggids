#!/usr/bin/env node
/**
 * Fetch contact, over-ons, blog listing, and sitemap pages.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  rewriteHtml,
  extractHeader,
  extractMain,
  extractFooter,
  extractMeta,
  collectUploadPaths,
  downloadCss,
  downloadImage,
  fetchPageHtml,
} from './lib/page-fetch-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(ROOT, '.migration-cache');

const PAGES = {
  contact: 'contact',
  'over-ons': 'over-ons',
  blog: 'blog-listing',
  sitemap: 'sitemap',
};

function getSlugs() {
  if (process.argv.length > 2) {
    return process.argv.slice(2).map((s) => ({ slug: s, dir: PAGES[s] || s }));
  }
  return Object.entries(PAGES).map(([slug, dir]) => ({ slug, dir }));
}

async function main() {
  for (const { slug, dir } of getSlugs()) {
    console.log(`Processing /${slug}/...`);
    const outDir = path.join(ROOT, 'src/data', dir);
    const html = await fetchPageHtml(slug, CACHE_DIR);
    const meta = extractMeta(html, slug);
    const header = rewriteHtml(extractHeader(html));
    const main = rewriteHtml(extractMain(html));
    const footer = rewriteHtml(extractFooter(html));
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'header.html'), header);
    fs.writeFileSync(path.join(outDir, 'main.html'), main);
    fs.writeFileSync(path.join(outDir, 'footer.html'), footer);

    if (meta.postCss) {
      try {
        await downloadCss(
          ROOT,
          `https://degroteverzorginggids.nl/wp-content/uploads/elementor/css/${meta.postCss}`.split('?')[0]
        );
      } catch {
        /* optional */
      }
    }

    const images = collectUploadPaths(header, main, footer);
    for (const imagePath of images) {
      await downloadImage(ROOT, imagePath);
    }

    fs.writeFileSync(
      path.join(outDir, 'meta.json'),
      JSON.stringify(
        {
          title: meta.title,
          description: meta.description,
          canonical: meta.canonical,
          ogImage: meta.ogImage,
          bodyClass: meta.bodyClass,
          modifiedTime: meta.modifiedTime,
          publishedTime: meta.publishedTime,
          postCss: meta.postCss,
        },
        null,
        2
      )
    );
    console.log(`  Saved to src/data/${dir}/ (${images.length} images)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
