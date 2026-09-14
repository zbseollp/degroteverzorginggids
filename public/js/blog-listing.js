/**
 * Blog listing: card styling, full-width thumbnails, placeholder for missing/broken images.
 */
(function () {
  const PLACEHOLDER = '/images/blog-placeholder.svg';

  function markPlaceholder(thumbnail) {
    if (thumbnail) thumbnail.classList.add('elementor-post__thumbnail--placeholder');
  }

  function usePlaceholder(img) {
    if (!img || img.dataset.placeholderApplied === 'true') return;
    img.dataset.placeholderApplied = 'true';
    img.src = PLACEHOLDER;
    img.removeAttribute('srcset');
    img.removeAttribute('sizes');
    markPlaceholder(img.closest('.elementor-post__thumbnail'));
  }

  function createThumbnailLink(article, href) {
    const link = document.createElement('a');
    link.className = 'elementor-post__thumbnail__link';
    link.href = href;
    link.tabIndex = -1;
    link.setAttribute('aria-hidden', 'true');

    const thumb = document.createElement('div');
    thumb.className = 'elementor-post__thumbnail elementor-post__thumbnail--placeholder';

    const img = document.createElement('img');
    img.src = PLACEHOLDER;
    img.alt = '';
    img.loading = 'lazy';
    img.width = 400;
    img.height = 264;
    img.className = 'attachment-medium size-medium wp-post-image';
    img.dataset.placeholderApplied = 'true';

    thumb.appendChild(img);
    link.appendChild(thumb);
    article.classList.add('has-post-thumbnail');
    article.insertBefore(link, article.firstChild);
  }

  function bindImage(img) {
    if (img.dataset.dggBound === 'true') return;
    img.dataset.dggBound = 'true';

    img.addEventListener('error', () => usePlaceholder(img), { once: true });

    if (img.complete && img.naturalWidth === 0 && img.src && !img.src.includes('blog-placeholder')) {
      usePlaceholder(img);
    }
  }

  function initBlogListingCards() {
    document.querySelectorAll('.elementor-widget-posts .elementor-post').forEach((article) => {
      article.classList.add('dgg-blog-card');

      const titleLink = article.querySelector('.elementor-post__title a');
      if (!titleLink) return;

      const href = titleLink.getAttribute('href') || '#';

      if (!article.querySelector('.elementor-post__thumbnail__link')) {
        createThumbnailLink(article, href);
      }

      article.querySelectorAll('.elementor-post__thumbnail img').forEach(bindImage);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBlogListingCards);
  } else {
    initBlogListingCards();
  }
})();
