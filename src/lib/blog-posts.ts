import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';

export const POSTS_PER_PAGE = 8;
export const BLOG_PLACEHOLDER = '/images/blog-placeholder.svg';

export type BlogPost = CollectionEntry<'blog'>;

const HIDDEN_SLUGS = new Set(['hello-world', 'blog-template']);

export function getBlogPageUrl(page: number): string {
  return page <= 1 ? '/blog/' : `/blog/page/${page}/`;
}

export function publicSlug(post: BlogPost): string {
  const slug = post.data.slug?.trim();
  return (slug || post.id).replace(/^\/+|\/+$/g, '').replace(/\.mdx?$/i, '');
}

export function publicHref(post: BlogPost): string {
  return `/${publicSlug(post)}/`;
}

export function postDate(post: BlogPost): Date {
  const value = post.data.pubDate;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  return new Date(0);
}

export function formatNlDate(value: Date): string {
  return value.toLocaleDateString('nl-NL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function isLivePost(post: BlogPost): boolean {
  const slug = publicSlug(post);
  if (HIDDEN_SLUGS.has(slug)) return false;
  const status = String(post.data.publishStatus || '').toLowerCase();
  if (status === 'draft' || status === 'unpublished') return false;
  return true;
}

export async function getPublishedPosts(): Promise<BlogPost[]> {
  const posts = await getCollection('blog');
  return posts.filter(isLivePost).sort((a, b) => postDate(b).getTime() - postDate(a).getTime());
}

export function firstImageUrl(html: string): string | undefined {
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  const url = match?.[1]?.trim();
  return url || undefined;
}

export function resolveFeaturedImage(post: BlogPost): string {
  const fromData = post.data.featuredImage?.trim();
  if (fromData) return fromData;
  const fromBody = firstImageUrl(blogBodyHtml(post.body));
  if (fromBody) return fromBody;
  return BLOG_PLACEHOLDER;
}

export function postExcerpt(post: BlogPost, max = 170): string {
  const raw = post.data.description || stripTags(blogBodyHtml(post.body));
  const text = raw.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function unescapeHtml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function looksLikeHtml(value: string): boolean {
  return /^\s*</.test(value) && /<(p|h[1-6]|div|figure|ul|ol|img|article|section|blockquote)\b/i.test(value);
}

function looksLikeMarkdown(value: string): boolean {
  return /(?:^|\n)\s*#{1,6}\s|\*\*[^*]+\*\*|^\s*[-*]\s/m.test(value);
}

function inlineMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let para: string[] = [];

  const flushPara = () => {
    const text = para.join(' ').trim();
    para = [];
    if (text) out.push(`<p>${inlineMarkdown(text)}</p>`);
  };

  for (const line of lines) {
    const heading = line.match(/^\s*(#{1,6})\s+(.*)$/);
    if (heading) {
      flushPara();
      const level = Math.min(heading[1].length, 4);
      out.push(`<h${level}>${inlineMarkdown(heading[2].trim())}</h${level}>`);
      continue;
    }
    if (!line.trim()) {
      flushPara();
      continue;
    }
    para.push(line.trim());
  }
  flushPara();
  return out.join('\n');
}

function unwrapWpContent(source: string): string | undefined {
  const jsonAttr = source.match(/<WpContent\s+html=\{("(?:[^"\\]|\\.)*")\}\s*\/>/i);
  if (jsonAttr?.[1]) {
    try {
      return JSON.parse(jsonAttr[1]) as string;
    } catch {
      /* fall through */
    }
  }
  const match = source.match(/<WpContent\s+html=\{([\s\S]*)\}\s*\/>/i);
  if (!match?.[1]) return undefined;
  const raw = match[1].trim();
  try {
    if (raw.startsWith('"') && raw.endsWith('"')) return JSON.parse(raw) as string;
    if (raw.startsWith("'") && raw.endsWith("'")) return JSON.parse(`"${raw.slice(1, -1)}"`) as string;
  } catch {
    return raw.replace(/^["'`]|["'`]$/g, '').replace(/\\n/g, '\n').replace(/\\"/g, '"');
  }
  if (raw.startsWith('`') && raw.endsWith('`')) return raw.slice(1, -1);
  return undefined;
}

/** Existing WP posts wrap HTML in WpContent; Payload writes HTML or markdown. */
export function blogBodyHtml(body: string | undefined): string {
  if (!body) return '';
  let text = body.trim();
  if (text.includes('&lt;WpContent') || text.includes('&lt;p')) {
    text = unescapeHtml(text);
  }
  text = text.replace(/^import\s+WpContent[^\n]*\n+/i, '').trim();
  const unwrapped = unwrapWpContent(text);
  if (unwrapped) text = unwrapped.trim();
  if (looksLikeHtml(text)) return text;
  if (looksLikeMarkdown(text) || (text && !text.includes('<'))) return markdownToHtml(text);
  return text;
}
