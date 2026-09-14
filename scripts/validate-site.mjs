#!/usr/bin/env node
/**
 * Validate migrated site: compare live URLs vs built dist output.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SITE = 'https://degroteverzorginggids.nl';
const SLUGS_PATH = path.join(ROOT, 'src/data/all-slugs.json');

async function checkLive(slug) {
  const url = slug ? `${SITE}/${slug}/` : `${SITE}/`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DGG-Validate/1.0)' },
    });
    return res.status;
  } catch {
    return 0;
  }
}

function checkBuilt(slug) {
  const file = slug
    ? path.join(DIST, slug, 'index.html')
    : path.join(DIST, 'index.html');
  return fs.existsSync(file);
}

async function main() {
  if (!fs.existsSync(SLUGS_PATH)) {
    console.error('Run npm run collect-urls first');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(SLUGS_PATH, 'utf-8'));
  const slugs = ['', ...data.contentPages, ...data.productPages, ...data.blogPosts];

  let liveOk = 0;
  let builtOk = 0;
  let missingBuilt = [];
  let liveFailed = [];

  for (const slug of slugs) {
    const status = await checkLive(slug);
    if (status === 200) liveOk++;
    else liveFailed.push({ slug: slug || 'home', status });

    if (checkBuilt(slug)) builtOk++;
    else missingBuilt.push(slug || 'home');
  }

  console.log(`Live pages OK (200): ${liveOk}/${slugs.length}`);
  console.log(`Built pages found: ${builtOk}/${slugs.length}`);

  if (liveFailed.length) {
    console.log('\nLive fetch issues:');
    for (const item of liveFailed.slice(0, 20)) {
      console.log(`  ${item.slug}: HTTP ${item.status}`);
    }
    if (liveFailed.length > 20) console.log(`  ... and ${liveFailed.length - 20} more`);
  }

  if (missingBuilt.length) {
    console.log('\nMissing built pages:');
    for (const slug of missingBuilt.slice(0, 30)) {
      console.log(`  /${slug === 'home' ? '' : slug + '/'}`);
    }
    if (missingBuilt.length > 30) console.log(`  ... and ${missingBuilt.length - 30} more`);
    process.exit(1);
  }

  console.log('\nValidation passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
