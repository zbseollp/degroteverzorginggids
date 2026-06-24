import productManifest from '../data/product-pages/manifest.json';

export interface SearchEntry {
  title: string;
  description: string;
  url: string;
  type: 'product' | 'blog' | 'page';
}

export interface BlogSearchInput {
  id: string;
  title: string;
  description: string;
}

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&hellip;/g, '…')
    .replace(/&euml;/g, 'ë')
    .replace(/&Euml;/g, 'Ë')
    .replace(/&ouml;/g, 'ö')
    .replace(/&uuml;/g, 'ü')
    .replace(/&aacute;/g, 'á')
    .replace(/&egrave;/g, 'è')
    .replace(/&eacute;/g, 'é');
}

function stripSiteSuffix(title: string): string {
  return title.replace(/\s*[-–|]\s*(DeGroteVerzorgingGids\.nl|degroteverzorginggids\.nl)\s*$/i, '').trim();
}

const staticPages: SearchEntry[] = [
  {
    title: 'Blog',
    description: 'Laatste artikelen over verzorgingsproducten.',
    url: '/blog/',
    type: 'page',
  },
  {
    title: 'Contact',
    description: 'Neem contact op met degroteverzorginggids.nl.',
    url: '/contact/',
    type: 'page',
  },
  {
    title: 'Over ons',
    description: 'Lees meer over degroteverzorginggids.nl.',
    url: '/over-ons/',
    type: 'page',
  },
];

export function buildSearchIndex(blogPosts: BlogSearchInput[] = []): SearchEntry[] {
  const products = Object.entries(productManifest).map(([slug, meta]) => ({
    title: stripSiteSuffix(decodeHtml(meta.title)),
    description: decodeHtml(meta.description),
    url: meta.canonical || `/${slug}/`,
    type: 'product' as const,
  }));

  const posts = blogPosts.map((post) => ({
    title: stripSiteSuffix(decodeHtml(post.title)),
    description: decodeHtml(post.description.replace(/\[&hellip;\]/g, '…')),
    url: `/${post.id}/`,
    type: 'blog' as const,
  }));

  return [...staticPages, ...products, ...posts];
}

export function searchPages(query: string, index: SearchEntry[]): SearchEntry[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);

  if (!terms.length) return [];

  return index.filter((entry) => {
    const haystack = `${entry.title} ${entry.description} ${entry.url}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}
