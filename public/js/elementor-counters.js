function formatCounterNumber(value, delimiter) {
  const rounded = Math.round(value).toString();
  if (!delimiter) return rounded;
  return rounded.replace(/\B(?=(\d{3})+(?!\d))/g, delimiter);
}

function animateCounter(el) {
  if (el.dataset.counterAnimated === 'true') return;
  el.dataset.counterAnimated = 'true';

  const to = Number.parseFloat(el.dataset.toValue || '0');
  const from = Number.parseFloat(el.dataset.fromValue || '0');
  const duration = Number.parseInt(el.dataset.duration || '2000', 10);
  const delimiter = el.dataset.delimiter || '';
  const start = performance.now();

  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const current = from + (to - from) * progress;
    el.textContent = formatCounterNumber(current, delimiter);
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = formatCounterNumber(to, delimiter);
  }

  requestAnimationFrame(step);
}

function initElementorCounters() {
  const counters = document.querySelectorAll('.elementor-counter-number[data-to-value]');
  if (!counters.length) return;

  function isInViewport(el) {
    const rect = el.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0;
  }

  if (!('IntersectionObserver' in window)) {
    counters.forEach((el) => {
      el.textContent = formatCounterNumber(
        Number.parseFloat(el.dataset.toValue || '0'),
        el.dataset.delimiter || ''
      );
    });
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.25 }
  );

  counters.forEach((el) => {
    if (isInViewport(el)) animateCounter(el);
    else observer.observe(el);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initElementorCounters);
} else {
  initElementorCounters();
}
