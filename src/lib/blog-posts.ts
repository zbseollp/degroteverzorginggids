import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';

export const POSTS_PER_PAGE = 4;

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

/** Existing WP posts wrap HTML in WpContent; Payload writes raw HTML. */
export function blogBodyHtml(body: string | undefined): string {
  if (!body) return '';
  const wrapped = body.match(/<WpContent\s+html=\{("[\s\S]*")\}\s*\/>/);
  if (wrapped?.[1]) {
    try {
      return JSON.parse(wrapped[1]) as string;
    } catch {
      /* fall through */
    }
  }
  return body.replace(/^import\s+WpContent[^\n]*\n+/, '').trim();
}
