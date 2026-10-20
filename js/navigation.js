document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('.homepagebar .bar-left');
  if (!header) return;
  const svg = paths => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const icons = {
    types: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" /> <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" /> <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />',
    abilities: '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" /> <path d="M20 2v4" /> <path d="M22 4h-4" /> <circle cx="4" cy="20" r="2" />',
    moves: '<path d="m13 19 6-6" /> <path d="M14.5 17.5 3.586 6.586A2 2 0 013 5.172V3h2.172a2 2 0 011.414.586L17.5 14.5" /> <path d="m14.828 6.172 2.586-2.586A2 2 0 0118.828 3H21v2.172a2 2 0 01-.586 1.414l-2.586 2.586" /> <path d="m16 16 4 4" /> <path d="m19 21 2-2" /> <path d="m5 14 4 4" /> <path d="m5 21-2-2" /> <path d="M7.5 16.5 4 20" />',
    manual: '<path d="M12 5v16" /> <path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z" />'
  };
  const arrow = svg('<path d="M5 12h14m-6-6 6 6-6 6"/>');
  const entries = [
    ['types', 'Types', 'Matchups & effectiveness', 'types.html'],
    ['abilities', 'Abilities', 'Effects & Pokémon', 'abilities.html'],
    ['moves', 'Moves', 'Power, accuracy & effects', 'moves.html'],
    ['manual', 'User manual / Tutorial', 'Learn your way around CompDex', 'tutorial.html']
  ];
  const navigation = document.createElement('div');
  navigation.className = 'site-navigation';
  navigation.innerHTML = `<button id="site-navigation-trigger" type="button" aria-expanded="false" aria-controls="site-navigation-menu"><span>Browse</span>${svg('<path d="M12 5v14M5 12h14"/>')}</button>
    <nav id="site-navigation-menu" aria-label="Browse pages" inert>${entries.map(([icon, title, description, href]) => `<a href="${href}"${location.pathname.endsWith('/'+href)?' aria-current="page"':''}>${svg(icons[icon])}<span>${title}<small>${description}</small></span>${arrow}</a>`).join('')}</nav>`;
  header.append(navigation);
  const trigger = navigation.querySelector('#site-navigation-trigger');
  const menu = navigation.querySelector('#site-navigation-menu');
  trigger.setAttribute('aria-label', 'Browse pages');
  function setOpen(open) {
    navigation.classList.toggle('open', open);
    trigger.setAttribute('aria-expanded', String(open));
    menu.inert = !open;
    if (open) {
      const left = navigation.getBoundingClientRect().left;
      menu.style.left = `${Math.max(8, Math.min(left, innerWidth - 8 - menu.offsetWidth)) - left}px`;
      menu.style.maxHeight = `${Math.max(80, innerHeight - trigger.getBoundingClientRect().bottom - 20)}px`;
    } else menu.style.removeProperty('left');
  }
  trigger.addEventListener('click', () => setOpen(!navigation.classList.contains('open')));
  document.addEventListener('pointerdown', event => { if (!navigation.contains(event.target)) setOpen(false); });
  navigation.addEventListener('focusout', event => { if (!navigation.contains(event.relatedTarget)) setOpen(false); });
  navigation.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.focus(); }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); setOpen(true);
      const buttons = [...menu.querySelectorAll('a')];
      const index = buttons.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
        : index < 0 ? (event.key === 'ArrowDown' ? 0 : buttons.length - 1)
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].focus();
    }
  });
  window.addEventListener('resize', () => setOpen(false));
});
