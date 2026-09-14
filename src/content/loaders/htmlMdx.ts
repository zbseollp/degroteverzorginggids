import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Loader } from 'astro/loaders';

/**
 * Load blog .md / .mdx as frontmatter + raw HTML.
 * Skips the MDX compiler so Payload HTML (and `{` in copy) cannot drop a post.
 */
export function htmlMdxLoader(options: { base: string | URL }): Loader {
  const resolvedBase =
    options.base instanceof URL
      ? fileURLToPath(options.base)
      : path.isAbsolute(options.base)
        ? options.base
        : path.resolve(process.cwd(), options.base);

  return {
    name: 'html-mdx-loader',
    load: async ({ store, parseData, generateDigest, logger, watcher }) => {
      store.clear();
      watcher?.add(resolvedBase);

      let files: string[] = [];
      try {
        files = await walkContentFiles(resolvedBase);
      } catch (err) {
        logger.error(`Failed to read ${resolvedBase}: ${err}`);
        return;
      }

      let loaded = 0;
      for (const fullPath of files) {
        const rel = path.relative(resolvedBase, fullPath);
        const id = rel.replace(/\\/g, '/').replace(/\.mdx?$/i, '');
        const raw = await fs.readFile(fullPath, 'utf8');
        const { data, body } = splitFrontmatter(raw);
        const filePath = path.relative(process.cwd(), fullPath).split(path.sep).join('/');
        try {
          const parsed = await parseData({ id, data });
          store.set({
            id,
            data: parsed,
            body,
            digest: generateDigest(raw),
            filePath: filePath.startsWith('..') ? undefined : filePath,
          });
          loaded += 1;
        } catch (err) {
          logger.warn(`Schema fallback for ${rel}: ${err}`);
          store.set({
            id,
            data: {
              title: String(data.title || id),
              description: String(data.description || data.excerpt || ''),
              pubDate: new Date(),
              slug: typeof data.slug === 'string' ? data.slug : id,
            },
            body,
            digest: generateDigest(raw),
            filePath: filePath.startsWith('..') ? undefined : filePath,
          });
          loaded += 1;
        }
      }

      logger.info(`Loaded ${loaded}/${files.length} HTML blog entries from ${resolvedBase}`);
    },
  };
}

async function walkContentFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries: Awaited<ReturnType<typeof fs.readdir>>;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      out.push(...(await walkContentFiles(full)));
    } else if (/\.mdx?$/i.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function splitFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };
  return { data: parseSimpleYaml(match[1]), body: match[2] ?? '' };
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"');
  }
  return trimmed;
}

function coerce(value: string): unknown {
  const v = value.trim();
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null' || v === '') return v === '' ? '' : null;
  return stripQuotes(v);
}

function parseSimpleYaml(block: string): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  let pending: string | null = null;

  for (const rawLine of block.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const listItem = line.match(/^\s+-\s+(.*)$/);
    if (listItem && pending) {
      const current = data[pending];
      if (!Array.isArray(current)) data[pending] = [];
      (data[pending] as unknown[]).push(coerce(listItem[1]));
      continue;
    }

    const nested = line.match(/^\s+([\w-]+):\s*(.*)$/);
    if (nested && pending) {
      const current = data[pending];
      if (!current || Array.isArray(current) || typeof current !== 'object') {
        data[pending] = {};
      }
      (data[pending] as Record<string, unknown>)[nested[1]] = coerce(nested[2]);
      continue;
    }

    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (!kv) continue;
    pending = null;
    const key = kv[1];
    const value = kv[2];
    if (value === '') {
      pending = key;
      data[key] = [];
      continue;
    }
    data[key] = coerce(value);
  }

  return data;
}
