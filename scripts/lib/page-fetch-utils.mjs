import fs from 'node:fs';
import path from 'node:path';
import { parseHTML } from 'linkedom';

export const SITE = 'https://degroteverzorginggids.nl';

const TOC_HEADING_TAGS = ['h2', 'h3', 'h4', 'h5', 'h6'];

export function slugifyHeading(text) {
  return (
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'section'
  );
}

export function hydrateTableOfContents(html) {
  if (!html.includes('elementor-toc__spinner')) return html;

  const { document } = parseHTML(`<!DOCTYPE html><html><body>${html}</body></html>`);
  const tocWidgets = [...document.querySelectorAll('.elementor-widget-table-of-contents')];
  if (!tocWidgets.length) return html;

  const usedIds = new Set(
    [...document.querySelectorAll('[id]')].map((el) => el.getAttribute('id')).filter(Boolean)
  );

  const headings = [];
  for (const el of document.querySelectorAll(TOC_HEADING_TAGS.join(','))) {
    if (el.closest('.elementor-widget-table-of-contents')) continue;
    const text = el.textContent.replace(/\s+/g, ' ').trim();
    if (!text) continue;

    let id = el.getAttribute('id');
    if (!id) {
      id = slugifyHeading(text);
      let uniqueId = id;
      let suffix = 2;
      while (usedIds.has(uniqueId)) {
        uniqueId = `${id}-${suffix++}`;
      }
      id = uniqueId;
      el.setAttribute('id', id);
    }
    usedIds.add(id);
    headings.push({ text, id, level: Number.parseInt(el.tagName[1], 10) });
  }

  for (const widget of tocWidgets) {
    if (widget.querySelector('.elementor-toc__list-wrapper')) continue;
    const body = widget.querySelector('.elementor-toc__body');
    if (!body) continue;
    widget.querySelector('.elementor-toc__spinner-container')?.remove();

    if (!headings.length) {
      const empty = document.createElement('div');
      empty.className = 'elementor-toc__empty-message';
      empty.textContent = 'Er zijn geen kopteksten gevonden op deze pagina.';
      body.appendChild(empty);
      continue;
    }

    const list = document.createElement('ul');
    list.className = 'elementor-toc__list-wrapper';
    for (const heading of headings) {
      const item = document.createElement('li');
      item.className = `elementor-toc__list-item elementor-toc__list-item-level-${heading.level}`;
      const link = document.createElement('a');
      link.className = 'elementor-toc__list-item-text';
      link.href = `#${heading.id}`;
      link.textContent = heading.text;
      item.appendChild(link);
      list.appendChild(item);
    }
    body.appendChild(list);
  }

  return document.body.innerHTML;
}

export function rewriteHtml(content) {
  let result = content
    .replaceAll(SITE, '')
    .replaceAll('/wp-content/uploads/', '/uploads/')
    .replace(/href=""/g, 'href="/"')
    .replace(/action=""/g, 'action="/"')
    .replace(/\sfetchpriority="[^"]*"/g, '')
    .replace(/\sdecoding="[^"]*"/g, '')
    .replace(/\sloading="[^"]*"/g, '')
    .replace(/\ssrcset="[^"]*"/g, '')
    .replace(/\ssizes="[^"]*"/g, '')
    .replace(/\sdata-rocket-location-hash="[^"]*"/g, '')
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

  result = result.replace(
    /(<div\s+)data-elementor-type="(wp-page|single-post)"/,
    '$1id="content" data-elementor-type="$2"'
  );

  return hydrateTableOfContents(result);
}

export function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

export function extractMeta(html, slug) {
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1]?.trim() ?? slug;
  const description = decodeEntities(
    html.match(/<meta name="description" content="([^"]*)"/)?.[1] ??
      html.match(/<meta property="og:description" content="([^"]*)"/)?.[1] ??
      ''
  );
  const canonical =
    html.match(/<link rel="canonical" href="([^"]+)"/)?.[1]?.replace(SITE, '') ?? `/${slug}/`;
  const ogImageRaw = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] ?? '';
  const ogImage = ogImageRaw.replace(`${SITE}/wp-content/uploads/`, '/uploads/').replace(SITE, '');
  const modifiedTime =
    html.match(/<meta property="article:modified_time" content="([^"]+)"/)?.[1] ?? '';
  const publishedTime =
    html.match(/<meta property="article:published_time" content="([^"]+)"/)?.[1] ?? '';
  const bodyClass = html.match(/<body[^>]*class="([^"]*)"/)?.[1] ?? '';
  const pageId = html.match(/page-id-(\d+)/)?.[1] ?? '';
  const postCss = pageId ? `post-${pageId}.css` : '';

  return { title, description, canonical, ogImage, modifiedTime, publishedTime, bodyClass, pageId, postCss };
}

export function extractHeader(html) {
  const start = html.indexOf('<header');
  const end = html.indexOf('</header>');
  if (start < 0 || end < start) throw new Error('Could not find header');
  return html.slice(start, end + '</header>'.length);
}

export function extractMain(html) {
  const headerEnd = html.indexOf('</header>');
  const footerStart = html.indexOf('<footer');
  if (headerEnd >= 0 && footerStart > headerEnd) {
    return html.slice(headerEnd + '</header>'.length, footerStart);
  }

  const wpPageStart = html.search(/<div[^>]*data-elementor-type="wp-page"[^>]*>/);
  const singlePostStart = html.search(/<div[^>]*data-elementor-type="single-post"[^>]*>/);
  const contentStart = wpPageStart >= 0 ? wpPageStart : singlePostStart;
  const footerDivStart = html.search(
    /<footer[^>]*data-elementor-type="footer"|<div[^>]*data-elementor-type="footer"[^>]*class="[^"]*elementor-location-footer/
  );
  if (contentStart >= 0 && footerDivStart > contentStart) {
    return html.slice(contentStart, footerDivStart);
  }

  throw new Error('Could not locate main content boundaries');
}

export function extractFooter(html) {
  const start = html.indexOf('<footer');
  const end = html.lastIndexOf('</footer>');
  if (start < 0 || end < start) throw new Error('Could not find footer');
  return html.slice(start, end + '</footer>'.length);
}

export function extractStylesheets(html) {
  const sheets = new Set();
  for (const match of html.matchAll(/<link[^>]+rel=['"]stylesheet['"][^>]*>/gi)) {
    const tag = match[0];
    const hrefMatch = tag.match(/href=['"]([^'"]+)['"]/);
    if (!hrefMatch) continue;
    let href = hrefMatch[1];
    if (href.startsWith('//')) href = `https:${href}`;
    if (!href.startsWith('http')) href = `${SITE}${href.startsWith('/') ? '' : '/'}${href}`;
    if (!href.includes('degroteverzorginggids.nl')) continue;
    sheets.add(href.split('?')[0]);
  }
  return [...sheets];
}

export function collectUploadPaths(...contents) {
  const paths = new Set();
  for (const content of contents) {
    for (const match of content.matchAll(
      /(?:src|href|data-lazy-src|url\()["']?(\/uploads\/[^"')]+\.(?:jpe?g|png|webp|svg|gif|woff2?|ttf))/gi
    )) {
      paths.add(match[1]);
    }
    for (const match of content.matchAll(
      /(?:src|href)="(https:\/\/degroteverzorginggids\.nl\/wp-content\/uploads\/[^"]+\.(?:jpe?g|png|webp|svg|gif|woff2?|ttf))"/gi
    )) {
      paths.add(match[1].replace(`${SITE}/wp-content/uploads/`, '/uploads/'));
    }
  }
  return [...paths];
}

export function cssDestFromUrl(url) {
  const file = url.split('?')[0].split('/').pop() || 'style.css';
  const safe = file.replace(/[^a-zA-Z0-9._-]/g, '-');
  if (url.includes('/themes/hello-elementor/')) return `public/css/theme/${safe}`;
  if (url.includes('/google-fonts/css/')) return `public/css/fonts/${safe}`;
  if (url.includes('/uploads/elementor/css/')) return `public/css/elementor/${safe}`;
  if (url.includes('/font-awesome/css/')) return `public/css/fontawesome/${safe}`;
  if (url.includes('/eicons/css/')) return `public/css/eicons/${safe}`;
  if (url.includes('/elementor-pro/assets/css/')) return `public/css/elementor-pro/${safe}`;
  if (url.includes('/swiper/')) return `public/css/elementor/${safe}`;
  if (url.includes('/conditionals/')) return `public/css/elementor/${safe.split('/').pop()}`;
  if (url.includes('/plugins/elementor/assets/css/')) return `public/css/elementor/${safe}`;
  return `public/css/elementor/${safe}`;
}

export function rewriteCssUrls(content) {
  return content
    .replaceAll(SITE, '')
    .replaceAll('/wp-content/uploads/', '/uploads/')
    .replace(
      /url\([^)]*?plugins\/elementor\/assets\/lib\/font-awesome\/webfonts\/([^)'"]+)[^)]*\)/gi,
      'url(/fonts/fontawesome/$1)'
    )
    .replace(
      /url\([^)]*?plugins\/elementor\/assets\/lib\/eicons\/fonts\/([^)'"]+)[^)]*\)/gi,
      'url(/fonts/eicons/$1)'
    )
    .replace(/url\((['"]?)(https?:\/\/[^)'"]+)(['"]?)\)/g, (_match, q1, url, q2) => {
      const local = url
        .replace(SITE, '')
        .replace('/wp-content/uploads/', '/uploads/')
        .replace('/wp-content/plugins/elementor/assets/lib/eicons/fonts/', '/fonts/eicons/')
        .replace(
          '/wp-content/plugins/elementor/assets/lib/font-awesome/webfonts/',
          '/fonts/fontawesome/'
        );
      return `url(${q1}${local}${q2})`;
    })
    .replace(/url\(\.\.\/fonts\/(eicons\.[^)]+)\)/g, 'url(/fonts/eicons/$1)')
    .replace(/url\(\.\.\/webfonts\/([^)]+)\)/g, 'url(/fonts/fontawesome/$1)')
    .replace(
      /url\(\s*['"]?\/wp-content\/plugins\/elementor\/assets\/mask-shapes\/([^)'"]+)['"]?\s*\)/gi,
      'url(/css/elementor/mask-shapes/$1)'
    );
}

export async function downloadFile(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DGG-Migration/1.0)' },
  });
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
  return res.text();
}

export async function downloadBinary(url, destPath) {
  if (fs.existsSync(destPath)) return true;
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DGG-Migration/1.0)' },
  });
  if (!res.ok) return false;
  fs.writeFileSync(destPath, Buffer.from(await res.arrayBuffer()));
  return true;
}

export async function downloadImage(root, localPath) {
  const destPath = path.join(root, 'public', localPath);
  if (fs.existsSync(destPath)) return;
  const remoteUrl = `${SITE}/wp-content/uploads/${localPath.replace('/uploads/', '')}`;
  await downloadBinary(remoteUrl, destPath);
}

export async function downloadCss(root, url) {
  const dest = cssDestFromUrl(url);
  const destPath = path.join(root, dest);
  if (fs.existsSync(destPath)) return `/${dest.replace(/^public\//, '')}`;

  let content = await downloadFile(`${url}?ver=1`);
  content = rewriteCssUrls(content);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, content);
  return `/${dest.replace(/^public\//, '')}`;
}

export function fontRemotePath(fontPath) {
  if (fontPath.startsWith('/uploads/')) {
    return `/wp-content/uploads/${fontPath.replace('/uploads/', '')}`;
  }
  if (fontPath.startsWith('/fonts/eicons/')) {
    return `/wp-content/plugins/elementor/assets/lib/eicons/fonts/${fontPath.replace('/fonts/eicons/', '')}`;
  }
  if (fontPath.startsWith('/fonts/fontawesome/')) {
    return `/wp-content/plugins/elementor/assets/lib/font-awesome/webfonts/${fontPath.replace('/fonts/fontawesome/', '')}`;
  }
  return fontPath;
}

export async function downloadFontsFromCss(root, cssContent) {
  const fontUrls = new Set();
  const fontRe =
    /url\(['"]?(\/(?:fonts|uploads)\/[^)'"]+\.(?:woff2|woff|ttf|eot|svg)(?:\?[^)'"]*)?)['"]?\)/gi;
  for (const match of cssContent.matchAll(fontRe)) {
    fontUrls.add(match[1].split('?')[0]);
  }

  for (const fontPath of [...fontUrls].sort()) {
    const destPath = path.join(root, 'public', fontPath);
    if (fs.existsSync(destPath)) continue;

    const remotePath = fontRemotePath(fontPath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const ok = await downloadBinary(`${SITE}${remotePath}`, destPath);
    if (ok) {
      console.log(`  Font: ${fontPath}`);
    } else {
      console.warn(`  Font download failed: ${remotePath}`);
    }
  }
}

export async function downloadMaskShapesFromCss(root, cssContent) {
  const maskPaths = new Set();
  for (const match of cssContent.matchAll(
    /url\(\s*['"]?(\/wp-content\/plugins\/elementor\/assets\/mask-shapes\/[^)'"]+)['"]?\s*\)/gi
  )) {
    maskPaths.add(match[1]);
  }
  for (const match of cssContent.matchAll(
    /url\(\s*['"]?(\/css\/elementor\/mask-shapes\/[^)'"]+)['"]?\s*\)/gi
  )) {
    maskPaths.add(
      `/wp-content/plugins/elementor/assets/mask-shapes/${match[1].replace('/css/elementor/mask-shapes/', '')}`
    );
  }

  for (const maskPath of [...maskPaths].sort()) {
    const filename = maskPath.split('/').pop();
    const destPath = path.join(root, 'public/css/elementor/mask-shapes', filename);
    if (fs.existsSync(destPath)) continue;

    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const ok = await downloadBinary(`${SITE}${maskPath}`, destPath);
    if (ok) {
      console.log(`  Mask shape: ${filename}`);
    } else {
      console.warn(`  Mask shape download failed: ${maskPath}`);
    }
  }
}

export async function downloadAllFontsFromCssDir(root) {
  const cssDir = path.join(root, 'public/css');
  if (!fs.existsSync(cssDir)) return;

  const cssFiles = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.css')) cssFiles.push(full);
    }
  }
  walk(cssDir);

  console.log(`Scanning ${cssFiles.length} CSS files for fonts...`);
  for (const file of cssFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    await downloadFontsFromCss(root, content);
    await downloadMaskShapesFromCss(root, content);
  }
}

export async function fetchPageHtml(slug, cacheDir) {
  const res = await fetch(`${SITE}/${slug}/`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DVG-Migration/1.0)' },
  });
  if (res.ok) {
    const html = await res.text();
    if (cacheDir) {
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(path.join(cacheDir, `dvg-${slug}.html`), html);
    }
    return html;
  }

  const archived = await fetchArchivePageHtml(slug);
  if (archived) {
    if (cacheDir) {
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(path.join(cacheDir, `dvg-${slug}.html`), archived);
    }
    return archived;
  }

  throw new Error(`Live fetch failed for ${slug}: ${res.status}`);
}

function isValidArchiveHtml(html) {
  return (
    !html.includes('Pagina niet gevonden') &&
    (html.includes('</header>') || html.includes('data-elementor-type="wp-page"'))
  );
}

async function fetchArchivePageHtml(slug) {
  const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=degroteverzorginggids.nl/${slug}/&output=json&limit=25&filter=statuscode:200`;
  let cdxRes;
  for (let attempt = 0; attempt < 3; attempt++) {
    cdxRes = await fetch(cdxUrl);
    if (cdxRes.ok) break;
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
  if (!cdxRes?.ok) return null;

  const rows = await cdxRes.json();
  if (!rows || rows.length < 2) return null;

  const timestamps = rows.slice(1).map((row) => row[1]).sort().reverse();
  for (const timestamp of timestamps) {
    const archiveUrl = `https://web.archive.org/web/${timestamp}/${SITE}/${slug}/`;
    let res;
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch(archiveUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DVG-Migration/1.0)' },
      });
      if (res.ok) break;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
    if (!res?.ok) continue;
    const html = await res.text();
    if (isValidArchiveHtml(html)) {
      return html
        .replace(/https:\/\/web\.archive\.org\/web\/\d+(?:im_)?\/(https?:\/\/[^"'>\s]+)/gi, '$1')
        .replace(/https:\/\/web\.archive\.org\/web\/\d+(?:im_)?\/https?:\/\/degroteverzorginggids\.nl/gi, '')
        .replace(/href="\/web\/\d+\/\//g, 'href="/');
    }
  }

  return null;
}

export function savePageParts(root, outDir, slug, html) {
  const header = rewriteHtml(extractHeader(html));
  const main = rewriteHtml(extractMain(html));
  const footer = rewriteHtml(extractFooter(html));
  const pageDir = path.join(outDir, slug);
  fs.mkdirSync(pageDir, { recursive: true });
  fs.writeFileSync(path.join(pageDir, 'header.html'), header);
  fs.writeFileSync(path.join(pageDir, 'main.html'), main);
  fs.writeFileSync(path.join(pageDir, 'footer.html'), footer);
  return { header, main, footer };
}
