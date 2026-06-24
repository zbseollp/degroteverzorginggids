#!/usr/bin/env node
/**
 * Fetch live blog post pages from degroteverzorginggids.nl.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractMeta,
  collectUploadPaths,
  downloadCss,
  downloadImage,
  fetchPageHtml,
  savePageParts,
} from './lib/page-fetch-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'src/data/blog-posts');
const CACHE_DIR = path.join(ROOT, '.migration-cache');
const SLUGS_PATH = path.join(ROOT, 'src/data/all-slugs.json');

function getSlugs() {
  if (process.argv.length > 2) return process.argv.slice(2);
  const data = JSON.parse(fs.readFileSync(SLUGS_PATH, 'utf-8'));
  return data.blogPosts;
}

async function main() {
  const slugs = getSlugs();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const manifest = fs.existsSync(path.join(OUT_DIR, 'manifest.json'))
    ? JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'manifest.json'), 'utf-8'))
    : {};

  let success = 0;
  let failed = 0;

  for (const slug of slugs) {
    try {
      console.log(`Processing ${slug}...`);
      const html = await fetchPageHtml(slug, CACHE_DIR);
      const meta = extractMeta(html, slug);
      const { header, main, footer } = savePageParts(ROOT, OUT_DIR, slug, html);

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

      manifest[slug] = {
        title: meta.title,
        description: meta.description,
        canonical: meta.canonical,
        ogImage: meta.ogImage,
        bodyClass: meta.bodyClass,
        modifiedTime: meta.modifiedTime,
        publishedTime: meta.publishedTime,
        postCss: meta.postCss,
      };
      success++;
      console.log(`  OK`);
    } catch (err) {
      failed++;
      console.warn(`  FAILED ${slug}: ${err.message}`);
    }
  }

  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\nDone: ${success} succeeded, ${failed} failed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
