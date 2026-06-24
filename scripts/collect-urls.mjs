#!/usr/bin/env node
/**
 * Collect all page URLs from live sitemaps and WordPress export.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE } from './lib/page-fetch-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'src/data/all-slugs.json');

const SKIP_SLUGS = new Set([
  'top-10-zb_mp_product',
  'zb_mp_product',
  'feed',
  'comments',
  'wp-json',
  'xmlrpc.php',
]);

async function fetchSitemapUrls(sitemapUrl) {
  const res = await fetch(sitemapUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DGG-Migration/1.0)' },
  });
  if (!res.ok) return [];
  const xml = await res.text();
  const urls = [];
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const loc = match[1].trim();
    if (!loc.includes('degroteverzorginggids.nl')) continue;
    const slug = loc.replace(`${SITE}/`, '').replace(/\/$/, '');
    if (!slug || SKIP_SLUGS.has(slug)) continue;
    urls.push(slug);
  }
  return urls;
}

function slugFromUrl(url) {
  return url.replace(`${SITE}/`, '').replace(/\/$/, '');
}

async function main() {
  const productSlugs = await fetchSitemapUrls(`${SITE}/zb_mp-sitemap.xml`);
  const postSlugs = await fetchSitemapUrls(`${SITE}/post-sitemap.xml`);
  const pageSlugs = await fetchSitemapUrls(`${SITE}/page-sitemap.xml`);

  const contentPages = pageSlugs.filter((s) =>
    ['contact', 'over-ons', 'blog', 'sitemap'].includes(s)
  );

  const all = {
    homepage: [''],
    contentPages,
    productPages: [...new Set(productSlugs)].sort(),
    blogPosts: postSlugs.sort(),
    allSlugs: [...new Set([...productSlugs, ...postSlugs, ...contentPages])].sort(),
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(all, null, 2));

  console.log(`Collected URLs:`);
  console.log(`  Product pages: ${all.productPages.length}`);
  console.log(`  Blog posts: ${all.blogPosts.length}`);
  console.log(`  Content pages: ${all.contentPages.length}`);
  console.log(`  Total unique: ${all.allSlugs.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
