/**
 * Elementor Pro fullscreen search-form for static Astro build.
 */
(function () {
  function redirectLegacySearchUrl() {
    if (window.location.pathname !== '/') return;
    const query = new URLSearchParams(window.location.search).get('s')?.trim();
    if (query) {
      window.location.replace(`/zoeken/?s=${encodeURIComponent(query)}`);
    }
  }

  function initSearchForms() {
    document
      .querySelectorAll('.elementor-search-form--skin-full_screen .elementor-search-form')
      .forEach((form) => {
        if (form.dataset.dggSearchInit) return;
        form.dataset.dggSearchInit = '1';

        const toggle = form.querySelector('.elementor-search-form__toggle');
        const container = form.querySelector('.elementor-search-form__container');
        const closeBtn = form.querySelector('.dialog-lightbox-close-button');
        const input = form.querySelector('.elementor-search-form__input');
        if (!toggle || !container || !input) return;

        toggle.setAttribute('aria-expanded', 'false');

        function isOpen() {
          return container.classList.contains('elementor-search-form--full-screen');
        }

        function openSearch() {
          container.classList.add('elementor-search-form--full-screen');
          document.body.classList.add('dgg-search-open');
          toggle.setAttribute('aria-expanded', 'true');
          requestAnimationFrame(() => input.focus());
        }

        function closeSearch() {
          container.classList.remove('elementor-search-form--full-screen');
          document.body.classList.remove('dgg-search-open');
          toggle.setAttribute('aria-expanded', 'false');
          input.blur();
        }

        toggle.addEventListener('click', (e) => {
          e.preventDefault();
          if (isOpen()) closeSearch();
          else openSearch();
        });

        toggle.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (isOpen()) closeSearch();
            else openSearch();
          }
        });

        if (closeBtn) {
          closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            closeSearch();
          });
          closeBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              closeSearch();
            }
          });
        }

        form.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && isOpen()) closeSearch();
        });

        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const query = input.value.trim();
          if (!query) return;
          window.location.href = `/zoeken/?s=${encodeURIComponent(query)}`;
        });
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      redirectLegacySearchUrl();
      initSearchForms();
    });
  } else {
    redirectLegacySearchUrl();
    initSearchForms();
  }
})();
