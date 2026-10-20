document.addEventListener('DOMContentLoaded', async () => {
  // Start after font loading, flowing left-to-right through each row, top-to-bottom.
  await document.fonts.ready;
  requestAnimationFrame(() => {
    const cards = [...document.querySelectorAll('.type-directory-card')]
      .map(card => ({card, bounds:card.getBoundingClientRect()}))
      .sort((a, b) => a.bounds.top - b.bounds.top || a.bounds.left - b.bounds.left);
    cards.forEach(({card}, index) => {
      card.addEventListener('animationend', event => {
        if (event.target === card) { card.classList.remove('entering'); card.style.removeProperty('animation-delay'); }
      });
      card.classList.add('entering');
      card.style.animationDelay = `${index * 25}ms`;
    });
    const chart = document.querySelector('.matchup-chart');
    if (!chart) return;
    chart.classList.add('awaiting-entrance');
    const revealChart = () => {
      chart.classList.remove('awaiting-entrance');
      chart.classList.add('entering');
    };
    chart.addEventListener('animationend', event => { if (event.target === chart) chart.classList.remove('entering'); });
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) { revealChart(); observer.disconnect(); }
      });
      observer.observe(chart);
    } else revealChart();
  });
});
