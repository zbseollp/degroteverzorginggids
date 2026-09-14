#!/usr/bin/env node
/**
 * Permanently strip executable markup from content files.
 * Keeps JSON-LD; removes other <script>, iframes, javascript: URIs, and inline handlers.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.astro', '.wrangler']);
const EXTS = new Set(['.html', '.md', '.mdx', '.xml']);

function stripMaliciousHtml(html) {
  return html
    .replace(/<script\b(?![^>]*type=["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b(?![^>]*type=["']application\/ld\+json["'])[^>]*\/>/gi, '')
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/document\.write\s*\((?:[^)(]+|\([^)]*\))*\)/gi, '');
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (EXTS.has(path.extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

const files = walk(ROOT);
let changed = 0;
for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8');
  const next = stripMaliciousHtml(raw);
  if (next !== raw) {
    fs.writeFileSync(file, next);
    changed += 1;
    console.log('cleaned', path.relative(ROOT, file));
  }
}
console.log(`sanitize-content: ${changed} file(s) cleaned, ${files.length} scanned`);
