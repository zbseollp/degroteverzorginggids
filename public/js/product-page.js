/**
 * Elementor product page interactions: tabs, accordion, table of contents.
 */
(function () {
  const ACCORDION_DURATION = 400;

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function slideDown(element, duration) {
    return new Promise((resolve) => {
      if (prefersReducedMotion() || duration === 0) {
        element.style.display = 'block';
        element.removeAttribute('hidden');
        resolve();
        return;
      }

      element.style.display = 'block';
      element.removeAttribute('hidden');
      element.style.overflow = 'hidden';
      element.style.height = '0';
      element.style.transition = `height ${duration}ms ease`;

      requestAnimationFrame(() => {
        element.style.height = `${element.scrollHeight}px`;
      });

      const onEnd = (event) => {
        if (event.propertyName !== 'height') return;
        element.removeEventListener('transitionend', onEnd);
        element.style.height = '';
        element.style.overflow = '';
        element.style.transition = '';
        resolve();
      };

      element.addEventListener('transitionend', onEnd);
      setTimeout(resolve, duration + 50);
    });
  }

  function slideUp(element, duration) {
    return new Promise((resolve) => {
      if (prefersReducedMotion() || duration === 0) {
        element.style.display = 'none';
        element.setAttribute('hidden', 'hidden');
        resolve();
        return;
      }

      element.style.overflow = 'hidden';
      element.style.height = `${element.scrollHeight}px`;
      element.style.transition = `height ${duration}ms ease`;

      requestAnimationFrame(() => {
        element.style.height = '0';
      });

      const onEnd = (event) => {
        if (event.propertyName !== 'height') return;
        element.removeEventListener('transitionend', onEnd);
        element.style.display = 'none';
        element.setAttribute('hidden', 'hidden');
        element.style.height = '';
        element.style.overflow = '';
        element.style.transition = '';
        resolve();
      };

      element.addEventListener('transitionend', onEnd);
      setTimeout(resolve, duration + 50);
    });
  }

  function setTabState(title, content, open) {
    title.classList.toggle('elementor-active', open);
    title.setAttribute('aria-selected', String(open));
    title.setAttribute('aria-expanded', String(open));
    title.setAttribute('tabindex', open ? '0' : '-1');
    content.setAttribute('aria-hidden', String(!open));
    if (open) {
      content.removeAttribute('hidden');
      content.style.display = '';
    } else {
      content.setAttribute('hidden', 'hidden');
      content.style.display = 'none';
    }
  }

  function initTabs() {
    document.querySelectorAll('.elementor-widget-tabs').forEach((widget) => {
      if (widget.dataset.htkTabsInit) return;
      widget.dataset.htkTabsInit = '1';

      const tabList = widget.querySelector('.elementor-tabs-wrapper');
      if (!tabList) return;

      const desktopTitles = widget.querySelectorAll('.elementor-tab-desktop-title');
      const mobileTitles = widget.querySelectorAll('.elementor-tab-mobile-title');
      const contents = widget.querySelectorAll('.elementor-tab-content');

      function activateTab(tabIndex) {
        desktopTitles.forEach((title) => {
          const isActive = title.getAttribute('data-tab') === tabIndex;
          title.classList.toggle('elementor-active', isActive);
          title.setAttribute('aria-selected', String(isActive));
          title.setAttribute('aria-expanded', String(isActive));
          title.setAttribute('tabindex', isActive ? '0' : '-1');
        });

        mobileTitles.forEach((title) => {
          const isActive = title.getAttribute('data-tab') === tabIndex;
          title.classList.toggle('elementor-active', isActive);
          title.setAttribute('aria-selected', String(isActive));
          title.setAttribute('aria-expanded', String(isActive));
          title.setAttribute('tabindex', isActive ? '0' : '-1');
        });

        contents.forEach((content) => {
          const isActive = content.getAttribute('data-tab') === tabIndex;
          content.classList.toggle('elementor-active', isActive);
          content.setAttribute('aria-hidden', String(!isActive));
          if (isActive) {
            content.removeAttribute('hidden');
            content.style.display = '';
          } else {
            content.setAttribute('hidden', 'hidden');
            content.style.display = 'none';
          }
        });
      }

      const allTitles = [...desktopTitles, ...mobileTitles];
      allTitles.forEach((title) => {
        title.addEventListener('click', (e) => {
          e.preventDefault();
          activateTab(title.getAttribute('data-tab'));
        });
        title.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            activateTab(title.getAttribute('data-tab'));
          }
        });
      });

      const active =
        [...desktopTitles].find((t) => t.classList.contains('elementor-active')) ||
        desktopTitles[0];
      if (active) activateTab(active.getAttribute('data-tab'));
    });
  }

  function initAccordion() {
    document.querySelectorAll('.elementor-widget-accordion').forEach((widget) => {
      if (widget.dataset.htkAccordionInit) return;
      widget.dataset.htkAccordionInit = '1';

      const items = widget.querySelectorAll('.elementor-accordion-item');
      let animating = false;

      items.forEach((item) => {
        const title = item.querySelector('.elementor-tab-title');
        const content = item.querySelector('.elementor-tab-content');
        if (!title || !content) return;

        const isOpen = title.classList.contains('elementor-active');
        if (!isOpen) {
          content.style.display = 'none';
          content.setAttribute('aria-hidden', 'true');
          content.setAttribute('hidden', 'hidden');
        } else {
          content.removeAttribute('hidden');
          content.style.display = 'block';
        }

        title.addEventListener('click', async (e) => {
          e.preventDefault();
          if (animating) return;

          const accordion = item.closest('.elementor-accordion');
          const open = title.classList.contains('elementor-active');
          animating = true;

          try {
            if (open) {
              setTabState(title, content, false);
              await slideUp(content, ACCORDION_DURATION);
            } else {
              const openItems = [...(accordion?.querySelectorAll('.elementor-accordion-item') ?? [])].filter(
                (other) => other.querySelector('.elementor-tab-title')?.classList.contains('elementor-active')
              );

              await Promise.all(
                openItems.map(async (openItem) => {
                  const openTitle = openItem.querySelector('.elementor-tab-title');
                  const openContent = openItem.querySelector('.elementor-tab-content');
                  if (!openTitle || !openContent) return;
                  setTabState(openTitle, openContent, false);
                  await slideUp(openContent, ACCORDION_DURATION);
                })
              );

              setTabState(title, content, true);
              await slideDown(content, ACCORDION_DURATION);
            }
          } finally {
            animating = false;
          }
        });

        title.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            title.click();
          }
        });
      });
    });
  }

  function slugify(text) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  function buildTocList(container, headings) {
    const list = document.createElement('ul');
    list.className = 'elementor-toc__list-wrapper';

    headings.forEach((heading) => {
      if (!heading.id) {
        heading.id = slugify(heading.textContent || '');
      }

      const li = document.createElement('li');
      li.className = 'elementor-toc__list-item';

      const level = parseInt(heading.tagName.charAt(1), 10);
      if (level > 2) {
        li.classList.add(`elementor-toc__list-item--level-${level}`);
      }

      const link = document.createElement('a');
      link.className = 'elementor-toc__list-item-text elementor-toc__list-item-text--level-' + level;
      link.href = '#' + heading.id;
      link.textContent = heading.textContent?.trim() || '';
      link.addEventListener('click', (e) => {
        e.preventDefault();
        heading.scrollIntoView({ behavior: 'smooth' });
        history.replaceState(null, '', '#' + heading.id);
      });

      li.appendChild(link);
      list.appendChild(li);
    });

    container.appendChild(list);
  }

  function initTableOfContents() {
    const content = document.getElementById('content');
    if (!content) return;

    const headings = content.querySelectorAll('h2, h3, h4, h5, h6');

    document.querySelectorAll('.elementor-widget-table-of-contents').forEach((widget) => {
      const body = widget.querySelector('.elementor-toc__body');
      const spinner = widget.querySelector('.elementor-toc__spinner-container');
      if (!body || body.dataset.htkInit) return;
      body.dataset.htkInit = '1';

      if (spinner) spinner.remove();
      buildTocList(body, headings);

      const expandBtn = widget.querySelector('.elementor-toc__toggle-button--expand');
      const collapseBtn = widget.querySelector('.elementor-toc__toggle-button--collapse');

      function setExpanded(expanded) {
        widget.classList.toggle('elementor-toc--collapsed', !expanded);
        expandBtn?.setAttribute('aria-expanded', String(expanded));
        collapseBtn?.setAttribute('aria-expanded', String(expanded));
        if (body) body.style.display = expanded ? '' : 'none';
      }

      expandBtn?.addEventListener('click', () => setExpanded(true));
      collapseBtn?.addEventListener('click', () => setExpanded(false));

      if (widget.classList.contains('elementor-toc--minimized-on-tablet')) {
        const mq = window.matchMedia('(max-width: 1024px)');
        const update = () => setExpanded(!mq.matches);
        mq.addEventListener('change', update);
        update();
      }
    });
  }

  function init() {
    initTabs();
    initAccordion();
    initTableOfContents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
