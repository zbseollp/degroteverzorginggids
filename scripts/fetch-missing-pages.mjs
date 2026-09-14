#!/usr/bin/env node
/**
 * Fetch pages referenced on degroteverzorginggids.nl but missing from the WordPress export.
 * Run: node scripts/fetch-missing-pages.mjs [slug ...]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://degroteverzorginggids.nl';
const PAGES_DIR = path.join(ROOT, 'src/pages');
const PUBLIC_UPLOADS = path.join(ROOT, 'public/uploads');
const MISSING_SLUGS_PATH = path.join(ROOT, 'src/data/missing-slugs.json');

function rewriteHtml(content) {
  return content
    .replaceAll(SITE, '')
    .replaceAll('/wp-content/uploads/', '/uploads/')
    .replace(/href=""/g, 'href="/"')
    .replace(/\sfetchpriority="[^"]*"/g, '')
    .replace(/\sdecoding="[^"]*"/g, '')
    .replace(/\sloading="[^"]*"/g, '')
    .replace(/\ssrcset="[^"]*"/g, '')
    .replace(/\ssizes="[^"]*"/g, '')
    .replace(/\sdata-lazy-srcset="[^"]*"/g, '')
    .replace(/\sdata-lazy-sizes="[^"]*"/g, '')
    .replace(
      /<img([^>]*?)\ssrc="data:image\/svg\+xml[^"]*"([^>]*?)\sdata-lazy-src="([^"]+)"([^>]*)>/gi,
      (_m, before, middle, url, after) => {
        const local = url.replace('/wp-content/uploads/', '/uploads/');
        return `<img${before} src="${local}"${middle}${after}>`;
      }
    )
    .replace(/<noscript><img[^>]*><\/noscript>/g, '');
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

function extractMeta(html, slug) {
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1]?.trim() ?? slug;
  const description = decodeEntities(
    html.match(/<meta name="description" content="([^"]*)"/)?.[1] ??
      html.match(/<meta property="og:description" content="([^"]*)"/)?.[1] ??
      ''
  );
  return { title, description };
}

function extractMain(html) {
  const headerEnd = html.indexOf('</header>');
  const footerStart = html.indexOf('<footer');
  if (headerEnd >= 0 && footerStart > headerEnd) {
    return html.slice(headerEnd + '</header>'.length, footerStart);
  }

  const contentMatch = html.match(/<div[^>]*id="content"[^>]*>[\s\S]*<\/div>\s*<footer/i);
  if (contentMatch) return contentMatch[0].replace(/<footer[\s\S]*$/i, '');

  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) return mainMatch[1];

  throw new Error('Could not locate main content boundaries');
}

function collectUploadPaths(...contents) {
  const paths = new Set();
  for (const content of contents) {
    for (const match of content.matchAll(
      /(?:src|href|data-lazy-src|url\()["']?(\/uploads\/[^"')]+\.(?:jpe?g|png|webp|svg|gif|woff2?|ttf))/gi
    )) {
      paths.add(match[1]);
    }
    for (const match of content.matchAll(
      /(?:src|href)="(https:\/\/degroteverzorginggids\.nl\/wp-content\/uploads\/[^"]+\.(?:jpe?g|png|webp|svg|gif|ttf|woff2?))"/gi
    )) {
      paths.add(match[1].replace(`${SITE}/wp-content/uploads/`, '/uploads/'));
    }
  }
  return [...paths];
}

async function downloadImage(localPath) {
  const destPath = path.join(ROOT, 'public', localPath);
  if (fs.existsSync(destPath)) return;

  const remoteUrl = `${SITE}/wp-content/uploads/${localPath.replace('/uploads/', '')}`;
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const res = await fetch(remoteUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DGG-Migration/1.0)' },
  });
  if (!res.ok) {
    console.warn(`  Failed: ${remoteUrl} (${res.status})`);
    return;
  }
  fs.writeFileSync(destPath, Buffer.from(await res.arrayBuffer()));
}

async function fetchPage(slug) {
  const res = await fetch(`${SITE}/${slug}/`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DGG-Migration/1.0)' },
  });
  if (!res.ok) throw new Error(`Live fetch failed for ${slug}: ${res.status}`);
  return await res.text();
}

function writePageAstro(slug, meta, body) {
  const file = `---
import BaseLayout from '../layouts/BaseLayout.astro';
---

<BaseLayout title=${JSON.stringify(meta.title)} description=${JSON.stringify(meta.description)}>
  <article class="page-content" set:html={${JSON.stringify(body)}} />
</BaseLayout>
`;
  fs.writeFileSync(path.join(PAGES_DIR, `${slug}.astro`), file);
}

async function main() {
  const slugs = process.argv.slice(2).length
    ? process.argv.slice(2)
    : JSON.parse(fs.readFileSync(MISSING_SLUGS_PATH, 'utf-8'));

  let success = 0;
  let failed = 0;

  for (const slug of slugs) {
    try {
      console.log(`Processing ${slug}...`);
      const html = await fetchPage(slug);
      const meta = extractMeta(html, slug);
      const main = rewriteHtml(extractMain(html));

      const images = collectUploadPaths(main);
      for (const imagePath of images) {
        await downloadImage(imagePath);
      }

      writePageAstro(slug, meta, main);
      success++;
      console.log(`  OK (${images.length} images)`);
    } catch (err) {
      failed++;
      console.warn(`  FAILED ${slug}: ${err.message}`);
    }
  }

  console.log(`Done: ${success} succeeded, ${failed} failed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
