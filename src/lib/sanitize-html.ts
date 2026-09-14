/**
 * Strip injected/executable markup from CMS and scraped HTML.
 * JSON-LD FAQ blocks are kept; third-party and inline scripts are not.
 */
export function stripMaliciousHtml(html: string): string {
  if (!html) return html;
  return html
    .replace(/<script\b(?![^>]*type=["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b(?![^>]*type=["']application\/ld\+json["'])[^>]*\/>/gi, '')
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/document\.write\s*\((?:[^)(]+|\([^)]*\))*\)/gi, '');
}

export function hasInjectedCode(text: string): boolean {
  return /document\.write\s*\(|javascript:fotovenster|dartPosition\d|wbcr_php_snippet|<script\b(?![^>]*type=["']application\/ld\+json)/i.test(
    text || '',
  );
}
