/**
 * Blog post pages: hide broken images + related post card styling.
 */
(function () {
  function hideBrokenImage(img) {
    if (!img || img.dataset.brokenHidden === 'true') return;
    img.dataset.brokenHidden = 'true';

    const featuredWidget = img.closest('.elementor-widget-theme-post-featured-image');
    if (featuredWidget) {
      featuredWidget.classList.add('dgg-broken-hidden');
      return;
    }

    const thumbLink = img.closest('.elementor-post__thumbnail__link');
    if (thumbLink) {
      thumbLink.classList.add('dgg-broken-hidden');
      const article = img.closest('.elementor-post');
      if (article) article.classList.remove('has-post-thumbnail');
      return;
    }

    const authorAvatar = img.closest('.elementor-author-box__avatar');
    if (authorAvatar) {
      authorAvatar.classList.add('dgg-broken-hidden');
      return;
    }

    const imageWidget = img.closest('.elementor-widget-image');
    if (imageWidget) {
      imageWidget.classList.add('dgg-broken-hidden');
      return;
    }

    img.classList.add('dgg-broken-hidden');
  }

  function bindImage(img) {
    if (img.dataset.dggBound === 'true') return;
    img.dataset.dggBound = 'true';

    img.addEventListener('error', () => hideBrokenImage(img), { once: true });

    if (img.complete && img.naturalWidth === 0 && img.src) {
      hideBrokenImage(img);
    }
  }

  function initRelatedPostCards() {
    document.querySelectorAll('#content .elementor-widget-posts .elementor-post').forEach((article) => {
      article.classList.add('dgg-blog-card');
      article.querySelectorAll('.elementor-post__thumbnail img').forEach(bindImage);
    });
  }

  function initContentImages() {
    document.querySelectorAll('#content img').forEach((img) => {
      if (img.closest('.elementor-post__thumbnail')) return;
      bindImage(img);
    });
  }

  function init() {
    initRelatedPostCards();
    initContentImages();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
