#!/usr/bin/env node
/**
 * Download icon/web fonts referenced by local CSS (Font Awesome, Elementor eicons).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadAllFontsFromCssDir } from './lib/page-fetch-utils.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

await downloadAllFontsFromCssDir(ROOT);
console.log('Font download complete.');
