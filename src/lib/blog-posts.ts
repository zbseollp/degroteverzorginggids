export const POSTS_PER_PAGE = 4;

export function getBlogPageUrl(page: number): string {
  return page <= 1 ? '/blog/' : `/blog/page/${page}/`;
}
