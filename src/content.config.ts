import { defineCollection, z } from 'astro:content';
import { htmlMdxLoader } from './content/loaders/htmlMdx';

const blogDir = new URL('./content/blog', import.meta.url);

function asText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function asDate(value: unknown): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const parsed = new Date(String(value ?? ''));
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

function asList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string' || typeof item === 'number') return String(item).trim();
      if (item && typeof item === 'object' && 'value' in item) {
        return asText((item as { value?: unknown }).value);
      }
      return asText(item);
    })
    .filter(Boolean);
}

function mediaUrl(value: unknown): string | undefined {
  const text = asText(value);
  if (text) return text;
  if (!value || typeof value !== 'object') return undefined;
  const obj = value as Record<string, unknown>;
  return mediaUrl(obj.url) || mediaUrl(obj.src) || mediaUrl(obj.filename);
}

const blog = defineCollection({
  loader: htmlMdxLoader({ base: blogDir }),
  schema: z.any().transform((raw) => {
    const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    return {
      title: asText(data.title) || asText(data.slug) || 'Artikel',
      description: asText(data.description) || asText(data.excerpt) || '',
      pubDate: asDate(data.pubDate ?? data.date),
      updatedDate: data.updatedDate ? asDate(data.updatedDate) : undefined,
      author: asText(data.author) || undefined,
      categories: asList(data.categories),
      tags: asList(data.tags),
      slug: asText(data.slug) || undefined,
      draft: data.draft === true || data.draft === 'true',
      publishStatus: asText(data.publishStatus) || asText(data._status) || undefined,
      featuredImage:
        mediaUrl(data.featuredImage) ||
        mediaUrl(data.heroImage) ||
        mediaUrl(data.image) ||
        mediaUrl(data.thumbnail),
    };
  }),
});

export const collections = { blog };
