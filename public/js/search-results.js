/**
 * Client-side search results for static /zoeken/ page.
 */
(function () {
  function decodeHtml(text) {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&hellip;/g, '…')
      .replace(/&euml;/g, 'ë')
      .replace(/&Euml;/g, 'Ë');
  }

  function searchPages(query, index) {
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

  function renderResults(query, results) {
    const heading = document.getElementById('dgg-search-heading');
    const container = document.getElementById('dgg-search-results');
    if (!heading || !container) return;

    if (!query) {
      heading.textContent = 'Zoeken';
      container.innerHTML =
        '<p class="dgg-search-results__intro">Gebruik het zoekicoon in de header om te zoeken naar producten en artikelen.</p>';
      return;
    }

    heading.textContent = `Zoekresultaten voor “${query}”`;
    document.title = `Zoekresultaten voor "${query}" - degroteverzorginggids.nl`;

    if (!results.length) {
      container.innerHTML =
        '<p class="dgg-search-results__empty">Geen resultaten gevonden. Probeer een andere zoekterm.</p>';
      return;
    }

    const list = document.createElement('ul');
    list.className = 'dgg-search-results__list';

    results.forEach((result) => {
      const item = document.createElement('li');
      item.className = 'dgg-search-results__item';

      const link = document.createElement('a');
      link.className = 'dgg-search-results__link';
      link.href = result.url;

      const title = document.createElement('span');
      title.className = 'dgg-search-results__item-title';
      title.textContent = decodeHtml(result.title);

      const desc = document.createElement('span');
      desc.className = 'dgg-search-results__item-desc';
      desc.textContent = decodeHtml(result.description);

      link.append(title, desc);
      item.append(link);
      list.append(item);
    });

    container.replaceChildren(list);
  }

  function init() {
    const indexEl = document.getElementById('dgg-search-index');
    if (!indexEl) return;

    let index = [];
    try {
      index = JSON.parse(indexEl.textContent || '[]');
    } catch {
      index = [];
    }

    const query = new URLSearchParams(window.location.search).get('s')?.trim() || '';
    const results = query ? searchPages(query, index) : [];
    renderResults(query, results);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
