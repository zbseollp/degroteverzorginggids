#!/usr/bin/env node
/**
 * WordPress WXR → Astro migration script for degroteverzorginggids.nl
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import { parseHTML } from 'linkedom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const XML_PATH = path.join(ROOT, 'degroteverzorginggidsnl.WordPress.2026-06-24.xml');
const BLOG_DIR = path.join(ROOT, 'src/content/blog');
const PAGES_DIR = path.join(ROOT, 'src/pages');
const PUBLIC_UPLOADS = path.join(ROOT, 'public/uploads');
const NAV_PATH = path.join(ROOT, 'src/data/navigation.json');
const MISSING_SLUGS_PATH = path.join(ROOT, 'src/data/missing-slugs.json');
const SITE_URL = 'https://degroteverzorginggids.nl';

const SKIP_PAGE_SLUGS = new Set([
  'blog',
  'sitemap',
  'top-10-zb_mp_product',
  'zb_mp_product',
  'sample-page',
]);
const SKIP_POST_SLUGS = /^blog-template/;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  cdataPropName: '__cdata',
  isArray: (name) =>
    ['item', 'wp:author', 'wp:category', 'wp:tag', 'wp:term', 'category', 'wp:postmeta'].includes(
      name
    ),
});

function text(val) {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (val.__cdata != null) return String(val.__cdata);
  return String(val);
}

function ensureArray(val) {
  if (val == null) return [];
  return Array.isArray(val) ? val : [val];
}

function escapeYaml(str) {
  if (!str) return '""';
  const cleaned = str.replace(/\r/g, '').trim();
  if (/[:#\[\]{}|>&*!%@`"'\\]/.test(cleaned) || cleaned.includes('\n')) {
    return `"${cleaned.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
  }
  return `"${cleaned.replace(/"/g, '\\"')}"`;
}

function stripWpBlocks(html) {
  return html
    .replace(/<!--\s*\/?wp:[^>]+-->/g, '')
    .replace(/\[wp_sitemap_page\]/g, '')
    .replace(/\[lmt-post-modified-info\]/g, '')
    .replace(/\[zb_mpx_category_links[^\]]*\]/g, '')
    .replace(/\[zb_mp[^\]]*\]/g, '')
    .replace(/\[elementor-template[^\]]*\]/g, '');
}

function rewriteUrls(html) {
  return html
    .replace(/https:\/\/degroteverzorginggids\.nl\/wp-content\/uploads\//g, '/uploads/')
    .replace(/https:\/\/degroteverzorginggids\.nl\//g, '/')
    .replace(/srcset="[^"]*"/g, '')
    .replace(/sizes="[^"]*"/g, '')
    .replace(/loading="[^"]*"/g, '')
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, '–')
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function sanitizeHtml(html) {
  let body = rewriteUrls(stripWpBlocks(html));
  try {
    const { document } = parseHTML(`<div id="wp-root">${body}</div>`);
    document.querySelectorAll('style, script').forEach((el) => el.remove());
    body = document.querySelector('#wp-root')?.innerHTML || body;
  } catch {
    body = body.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    body = body.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  }
  return body.trim();
}

function htmlToMdxBody(html) {
  const body = sanitizeHtml(html);
  return `import WpContent from '../../components/WpContent.astro';\n\n<WpContent html={${JSON.stringify(body)}} />`;
}

function extractDescription(excerpt, html, title) {
  const ex = text(excerpt).trim();
  if (ex) return ex.replace(/<[^>]+>/g, '').slice(0, 300);
  const match = html.match(/<p[^>]*>(.*?)<\/p>/is);
  if (match) return match[1].replace(/<[^>]+>/g, '').trim().slice(0, 300);
  return title;
}

function getMeta(item, key) {
  const metas = ensureArray(item['wp:postmeta']);
  for (const meta of metas) {
    if (text(meta['wp:meta_key']) === key) return text(meta['wp:meta_value']);
  }
  return '';
}

function getCategories(item) {
  return ensureArray(item.category)
    .filter((c) => text(c['@_domain']) === 'category')
    .map((c) => text(c.__cdata || c).trim())
    .filter(Boolean);
}

function getTags(item) {
  return ensureArray(item.category)
    .filter((c) => text(c['@_domain']) === 'post_tag')
    .map((c) => text(c.__cdata || c).trim())
    .filter(Boolean);
}

function parseItems() {
  const xml = fs.readFileSync(XML_PATH, 'utf-8');
  const data = parser.parse(xml);
  const channel = data.rss.channel;
  const items = ensureArray(channel.item);

  const authors = {};
  for (const a of ensureArray(channel['wp:author'])) {
    authors[text(a['wp:author_login'])] =
      text(a['wp:author_display_name']) || text(a['wp:author_login']);
  }

  const byId = {};
  const attachments = {};
  const posts = [];
  const pages = [];
  const navItems = [];

  for (const item of items) {
    const id = text(item['wp:post_id']);
    const type = text(item['wp:post_type']);
    const status = text(item['wp:status']);
    const slug = text(item['wp:post_name']);
    const title = text(item.title);
    const content = text(item['content:encoded']);
    const excerpt = text(item['excerpt:encoded']);
    const link = text(item.link);
    const creator = text(item['dc:creator']);
    const postDate = text(item['wp:post_date']);
    const modified = text(item['wp:post_modified']);

    const record = {
      id,
      type,
      status,
      slug,
      title,
      content,
      excerpt,
      link,
      creator,
      postDate,
      modified,
      parent: text(item['wp:post_parent']),
      menuOrder: Number(text(item['wp:menu_order']) || 0),
      categories: getCategories(item),
      tags: getTags(item),
      thumbnailId: getMeta(item, '_thumbnail_id'),
      attachmentUrl: text(item['wp:attachment_url']),
      attachedFile: getMeta(item, '_wp_attached_file'),
      menuMeta: {},
    };

    if (type === 'nav_menu_item') {
      record.menuMeta = {
        type: getMeta(item, '_menu_item_type'),
        objectId: getMeta(item, '_menu_item_object_id'),
        object: getMeta(item, '_menu_item_object'),
        parent: getMeta(item, '_menu_item_menu_item_parent'),
        url: getMeta(item, '_menu_item_url'),
      };
      navItems.push(record);
    }

    if (type === 'attachment') {
      attachments[id] = record;
    }

    byId[id] = record;

    if (status === 'publish') {
      if (type === 'post') posts.push(record);
      if (type === 'page') pages.push(record);
    }
  }

  return { authors, byId, attachments, posts, pages, navItems };
}

async function downloadFile(url, dest) {
  if (fs.existsSync(dest)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DGG-Migration/1.0)' },
    });
    if (!res.ok) {
      console.warn(`Failed to download ${url}: ${res.status}`);
      return;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
  } catch (err) {
    console.warn(`Error downloading ${url}:`, err.message);
  }
}

async function downloadMedia(allRecords, attachments) {
  const urls = new Set();
  const regex = /https:\/\/degroteverzorginggids\.nl\/wp-content\/uploads\/([^\s"'<>]+)/g;

  for (const record of allRecords) {
    let m;
    while ((m = regex.exec(record.content)) !== null) {
      urls.add(m[0]);
    }
  }

  for (const att of Object.values(attachments)) {
    if (att.attachmentUrl) urls.add(att.attachmentUrl);
    if (att.attachedFile) urls.add(`${SITE_URL}/wp-content/uploads/${att.attachedFile}`);
  }

  console.log(`Downloading ${urls.size} media files...`);
  let done = 0;
  const urlList = [...urls];
  const batchSize = 10;

  for (let i = 0; i < urlList.length; i += batchSize) {
    const batch = urlList.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (url) => {
        const rel = url.replace(`${SITE_URL}/wp-content/uploads/`, '');
        const dest = path.join(PUBLIC_UPLOADS, rel);
        await downloadFile(url, dest);
        done++;
      })
    );
    if (done % 50 === 0 || done === urlList.length) {
      console.log(`  ${done}/${urlList.length}`);
    }
  }
}

function resolveNavUrl(navItem, byId) {
  const { type, objectId, url } = navItem.menuMeta;
  if (type === 'custom' && url) {
    const href = url.replace(SITE_URL, '').replace(/\/$/, '') || '/';
    if (href === '/blog') return '/blog';
    return href;
  }
  if (objectId && byId[objectId]) {
    const target = byId[objectId];
    if (target.slug === 'home') return '/';
    if (target.slug === 'blog') return '/blog';
    return `/${target.slug}`;
  }
  return url ? url.replace(SITE_URL, '').replace(/\/$/, '') || '/' : '#';
}

function buildNavigation(navItems, byId) {
  const mainMenu = navItems
    .filter((n) => n.status === 'publish')
    .sort((a, b) => a.menuOrder - b.menuOrder);

  const items = mainMenu.map((n) => {
    const linked = n.menuMeta.objectId ? byId[n.menuMeta.objectId] : null;
    const label =
      n.title ||
      linked?.title ||
      resolveNavUrl(n, byId).split('/').filter(Boolean).pop()?.replace(/-/g, ' ') ||
      'Link';
    return {
      id: n.id,
      label,
      href: resolveNavUrl(n, byId),
      parentId: n.menuMeta.parent !== '0' ? n.menuMeta.parent : null,
      order: n.menuOrder,
    };
  });

  function dedupeSiblings(nodes) {
    const seen = new Set();
    return nodes.filter((node) => {
      if (seen.has(node.href)) return false;
      seen.add(node.href);
      return true;
    });
  }

  function buildTree(parentId = null) {
    return dedupeSiblings(
      items
        .filter((i) => i.parentId === parentId)
        .sort((a, b) => a.order - b.order)
        .map((i) => ({
          label: i.label,
          href: i.href,
          children: buildTree(i.id),
        }))
    );
  }

  return buildTree(null);
}

function buildFooterNav(pages) {
  const useful = pages.filter((p) =>
    ['over-ons', 'blog', 'contact', 'sitemap'].includes(p.slug)
  );
  return useful.map((p) => ({
    label: p.title || p.slug,
    href:
      p.slug === 'home'
        ? '/'
        : p.slug === 'blog'
          ? '/blog'
          : `/${p.slug}`,
  }));
}

function writeBlogPost(post, authors) {
  const slug = post.slug;
  if (!slug || SKIP_POST_SLUGS.test(slug)) return null;

  const body = htmlToMdxBody(post.content);
  const description = extractDescription(post.excerpt, post.content, post.title);
  const author = authors[post.creator] || post.creator || 'admin';
  const categories = post.categories.length ? post.categories : ['Blog'];
  const tags = post.tags;

  const frontmatter = [
    '---',
    `title: ${escapeYaml(post.title)}`,
    `description: ${escapeYaml(description)}`,
    `pubDate: ${post.postDate.split(' ')[0]}`,
    post.modified !== post.postDate ? `updatedDate: ${post.modified.split(' ')[0]}` : null,
    `author: ${escapeYaml(author)}`,
    `categories:`,
    ...categories.map((c) => `  - ${escapeYaml(c)}`),
    tags.length ? `tags:` : `tags: []`,
    ...tags.map((t) => `  - ${escapeYaml(t)}`),
    '---',
  ]
    .filter(Boolean)
    .join('\n');

  fs.writeFileSync(path.join(BLOG_DIR, `${slug}.mdx`), `${frontmatter}\n\n${body}\n`);
  return slug;
}

function writePage(page) {
  const slug = page.slug;
  if (!slug || SKIP_PAGE_SLUGS.has(slug)) return;

  const body = sanitizeHtml(page.content);
  const title = page.title || slug;
  const description = extractDescription(page.excerpt, page.content, title);

  const file = `---
import BaseLayout from '../layouts/BaseLayout.astro';
---

<BaseLayout title=${JSON.stringify(title)} description=${JSON.stringify(description)}>
  <article class="page-content" set:html={${JSON.stringify(body)}} />
</BaseLayout>
`;

  if (slug === 'home') {
    fs.writeFileSync(path.join(PAGES_DIR, 'index.astro'), file);
    return;
  }

  fs.writeFileSync(path.join(PAGES_DIR, `${slug}.astro`), file);
}

function writeSitemapPage(pages, posts) {
  const pageLinks = pages
    .filter((p) => p.slug && !SKIP_PAGE_SLUGS.has(p.slug))
    .map((p) => ({
      label: p.title || p.slug,
      href: p.slug === 'home' ? '/' : `/${p.slug}`,
    }));

  const postLinks = posts.map((p) => ({
    label: p.title,
    href: `/${p.slug}`,
  }));

  const file = `---
import BaseLayout from '../layouts/BaseLayout.astro';

const pages = ${JSON.stringify(pageLinks, null, 2)};
const posts = ${JSON.stringify(postLinks, null, 2)};
---

<BaseLayout title="Sitemap" description="Overzicht van alle pagina's en blogartikelen op degroteverzorginggids.nl">
  <article class="page-content">
    <h1>Sitemap</h1>
    <h2>Pagina's</h2>
    <ul>
      {pages.map((page) => (
        <li><a href={page.href}>{page.label}</a></li>
      ))}
    </ul>
    <h2>Blogartikelen</h2>
    <ul>
      {posts.map((post) => (
        <li><a href={post.href}>{post.label}</a></li>
      ))}
    </ul>
  </article>
</BaseLayout>
`;
  fs.writeFileSync(path.join(PAGES_DIR, 'sitemap.astro'), file);
}

function collectMissingSlugs(posts, pages) {
  const exported = new Set();
  for (const p of posts) {
    if (!SKIP_POST_SLUGS.test(p.slug)) exported.add(p.slug);
  }
  for (const p of pages) {
    if (!SKIP_PAGE_SLUGS.has(p.slug)) exported.add(p.slug);
  }
  exported.add('blog');
  exported.add('home');

  const xml = fs.readFileSync(XML_PATH, 'utf-8');
  const linked = new Set();
  for (const match of xml.matchAll(/https:\/\/degroteverzorginggids\.nl\/([a-z0-9-]+)\//g)) {
    const slug = match[1];
    if (
      !['wp-content', 'category', 'tag', 'author', 'feed', 'comments', 'elementor', 'home'].includes(
        slug
      )
    ) {
      linked.add(slug);
    }
  }

  const skipMissing = new Set([
    'wp-admin',
    'wp-global-styles-hello-elementor',
    'sample-page',
    'sitemap',
    'home-copy',
    'frame-582-1-svg',
    'tuinenplaza-auteur-jpg',
    'vector-svg',
    'top-10-zb_mp_product',
    'privacy-policy',
    'productbg-svg',
    'frame',
    'frame-609',
    'cropped-frame-609-png',
    'rectangle-2-1-png',
    'rectangle-3-png',
    'ellipse-14-png',
    'cerebrisanspro-regular',
    'cerebrisanspro-medium',
    'cerebrisanspro-semibold',
    'cerebrisanspro-bold',
  ]);

  const missing = [...linked]
    .filter((slug) => {
      if (exported.has(slug) || /^\d+$/.test(slug)) return false;
      if (skipMissing.has(slug)) return false;
      if (SKIP_POST_SLUGS.test(slug)) return false;
      if (/(-svg|-jpg|-jpeg|-png|-webp|-ttf)$/.test(slug)) return false;
      if (slug.startsWith('icon-park-outline')) return false;
      if (slug.startsWith('fence-') || slug.startsWith('flea-market-') || slug.startsWith('work-in-the-garden-')) {
        return false;
      }
      return true;
    })
    .sort();

  return missing;
}

async function main() {
  console.log('Parsing WordPress export...');
  const { authors, byId, attachments, posts, pages, navItems } = parseItems();

  console.log(
    `Found ${posts.length} posts, ${pages.length} pages, ${Object.keys(attachments).length} attachments`
  );

  fs.mkdirSync(BLOG_DIR, { recursive: true });
  fs.mkdirSync(PAGES_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(NAV_PATH), { recursive: true });

  const allRecords = [...posts, ...pages];
  await downloadMedia(allRecords, attachments);

  console.log('Writing blog posts...');
  const writtenPosts = [];
  for (const post of posts) {
    const slug = writeBlogPost(post, authors);
    if (slug) writtenPosts.push({ ...post, slug });
  }

  // Static pages are rendered from fetched Elementor HTML in src/pages/*.astro

  const headerNav = buildNavigation(navItems, byId);
  const footerNav = buildFooterNav(pages);

  fs.writeFileSync(
    NAV_PATH,
    JSON.stringify({ header: headerNav, footer: footerNav }, null, 2)
  );

  const missingSlugs = collectMissingSlugs(writtenPosts, pages);
  fs.writeFileSync(MISSING_SLUGS_PATH, JSON.stringify(missingSlugs, null, 2));

  console.log('Migration complete!');
  console.log(`  Blog posts: ${writtenPosts.length}`);
  console.log(`  Pages: ${pages.length}`);
  console.log(`  Nav items: ${headerNav.length} top-level`);
  console.log(`  Missing slugs to fetch: ${missingSlugs.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
