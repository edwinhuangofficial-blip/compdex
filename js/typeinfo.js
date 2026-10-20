document.addEventListener('DOMContentLoaded', () => {
  const types = ['normal','fire','water','electric','grass','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy'];
  const pageSize = 30, cache = new Map(), favoriteKey = 'compdex.favorites.v1';
  const control = id => document.getElementById(id);
  const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const badge = (type, suffix = '') => `<span class="type-badge type-${type}">${type}${suffix}</span>`;
  let currentType, typeData, page = 1, request = 0, favoritesOnly = false, favorites = new Set(), artwork = window.CompDexSettings.get().artwork;
  let shuffleSeed = Number(new URLSearchParams(location.search).get('shuffle')) >>> 0;
  function randomPage(pool) {
    const sample = [...pool];
    let state = shuffleSeed >>> 0;
    const random = () => {
      state = (state + 0x6D2B79F5) >>> 0;
      let value = Math.imul(state ^ state >>> 15, state | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
    for (let i = 0; i < Math.min(pageSize, sample.length); i++) {
      const j = i + Math.floor(random() * (sample.length - i));
      [sample[i], sample[j]] = [sample[j], sample[i]];
    }
    return sample.slice(0, pageSize);
  }
  let shiny = window.CompDexSettings.get().shiny, displayed = [];
  const grid = control('poke-grid'), status = control('grid-status');
  const star = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" /></svg>';
  const idOf = entry => Number(entry.pokemon.url.split('/').filter(Boolean).pop());
  function readFavorites() {
    try { const saved = JSON.parse(localStorage.getItem(favoriteKey) || '[]'); favorites = new Set(Array.isArray(saved) ? saved.filter(Number.isInteger) : []); } catch {}
  }
  readFavorites();
  async function get(url) {
    if (!cache.has(url)) cache.set(url, fetch(url).then(response => {
      if (!response.ok) throw new Error('Data unavailable');
      return response.json();
    }).catch(error => { cache.delete(url); throw error; }));
    return cache.get(url);
  }
  function dropdown(wrapper, trigger, menu) {
    const buttons = [...menu.querySelectorAll('button')];
    function open(value) {
      wrapper.classList.toggle('open', value); trigger.setAttribute('aria-expanded', String(value)); menu.inert = !value;
      if (value) menu.style.maxHeight = `${Math.max(100, innerHeight - trigger.getBoundingClientRect().bottom - 24)}px`;
    }
    open(false);
    trigger.addEventListener('click', () => open(!wrapper.classList.contains('open')));
    wrapper.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); open(false); trigger.focus(); }
      if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
        event.preventDefault(); open(true);
        const index = buttons.indexOf(document.activeElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : index < 0 ? (event.key === 'ArrowDown' ? 0 : buttons.length - 1) : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next].focus();
      }
    });
    wrapper.addEventListener('focusout', event => { if (!wrapper.contains(event.relatedTarget)) open(false); });
    document.addEventListener('pointerdown', event => { if (!wrapper.contains(event.target)) open(false); });
    menu.addEventListener('pointerdown', event => { if (event.target === menu) event.preventDefault(); });
    return () => { open(false); trigger.focus(); };
  }
  const selector = control('type-selector-trigger'), typeMenu = control('type-selector-menu');
  typeMenu.innerHTML = types.map(type => `<button class="type-choice" type="button" role="menuitemradio" data-type="${type}" aria-checked="false">${badge(type)}</button>`).join('');
  const closeTypes = dropdown(selector.parentElement, selector, typeMenu);
  typeMenu.querySelectorAll('button').forEach(button => button.addEventListener('click', () => { closeTypes(); loadType(button.dataset.type); }));
  const select = control('index-artwork'), wrapper = document.createElement('div');
  wrapper.className = 'filter-dropdown';
  wrapper.innerHTML = '<button class="filter-trigger" id="index-artwork-trigger" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="index-artwork-menu">HD artwork</button><div class="filter-menu" id="index-artwork-menu" role="menu" aria-labelledby="index-artwork-trigger" inert></div>';
  select.before(wrapper); select.hidden = true; select.value = artwork;
  const artworkTrigger = control('index-artwork-trigger'), artworkMenu = control('index-artwork-menu');
  artworkMenu.innerHTML = [...select.options].map(option => `<button class="filter-option" type="button" role="menuitemradio" data-value="${option.value}">${option.textContent}</button>`).join('');
  const closeArtwork = dropdown(wrapper, artworkTrigger, artworkMenu);
  function syncArtwork() {
    select.value = artwork; artworkTrigger.textContent = select.selectedOptions[0].textContent;
    artworkTrigger.setAttribute('aria-label', `Artwork style: ${artworkTrigger.textContent}`);
    artworkMenu.querySelectorAll('button').forEach(button => button.setAttribute('aria-checked', String(button.dataset.value === artwork)));
    control('index-shiny').checked = shiny;
  }
  function sizeArtworkTrigger() {
    const style = getComputedStyle(artworkTrigger), context = document.createElement('canvas').getContext('2d');
    context.font = style.font;
    const width = Math.max(...[...select.options].map(option => context.measureText(option.textContent).width));
    artworkTrigger.style.width = `${Math.ceil(width + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth) + 14)}px`;
  }
  document.fonts.ready.then(sizeArtworkTrigger);
  window.addEventListener('resize', sizeArtworkTrigger);
  function applyCardAppearance() {
    const previous = window.CompDexSettings.get();
    window.CompDexSettings.setArtwork(artwork, shiny);
    if (previous.artwork === artwork && previous.shiny === shiny) refreshArtwork(true);
  }
  artworkMenu.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
    artwork = button.dataset.value; closeArtwork(); syncArtwork(); applyCardAppearance();
  }));
  control('index-shiny').addEventListener('change', () => { shiny = control('index-shiny').checked; applyCardAppearance(); });
  window.addEventListener('compdex:settings-changed', event => {
    if (event.detail.previous.artwork !== event.detail.settings.artwork || event.detail.previous.shiny !== event.detail.settings.shiny) {
      artwork = event.detail.settings.artwork; shiny = event.detail.settings.shiny; syncArtwork(); refreshArtwork(true);
    }
  });
  function releaseCards() {
    displayed.forEach(({image}) => { image.artworkSwapVersion = (image.artworkSwapVersion || 0) + 1; if (image.preparedObjectUrl) URL.revokeObjectURL(image.preparedObjectUrl); });
    displayed = [];
  }
  function refreshArtwork(replayAnimation = false) {
    const preferences = {...window.CompDexSettings.get(), artwork, shiny};
    displayed.forEach(({image, sprites}) => swapPreparedArtwork(image, getPokemonArtwork(sprites, preferences), preferences, true));
    if (replayAnimation) {
      const cards = grid.querySelectorAll('.pokecard');
      cards.forEach(card => { card.style.animation = 'none'; });
      void grid.offsetWidth;
      cards.forEach((card, index) => {
        card.style.removeProperty('animation');
        card.style.animationDelay = `${(index % 5) * 25}ms`;
      });
    }
  }
  function matches() { return (typeData?.pokemon || []).filter(entry => !favoritesOnly || favorites.has(idOf(entry))); }
  function syncPages(loading = false) {
    const count = shuffleSeed ? Math.min(pageSize, matches().length) : matches().length, pages = Math.max(1, Math.ceil(count / pageSize));
    control('filter-results').textContent = `Results: ${count}`;
    for (const id of ['page-number','top-page-number']) { control(id).value = page; control(id).max = pages; control(id).disabled = loading; }
    control('page-total').textContent = `of ${pages}`; control('top-page-total').textContent = `/${pages}`;
    for (const id of ['previous-page','top-previous-page']) control(id).disabled = loading || page <= 1;
    for (const id of ['next-page','top-next-page']) control(id).disabled = loading || page >= pages;
    control('shuffle-page').disabled = loading || count === 0;
    control('favorites-filter').setAttribute('aria-pressed', String(favoritesOnly));
  }
  function setUrl(replace = true) {
    const url = new URL(location.href); url.searchParams.set('type', currentType);
    if (page > 1) url.searchParams.set('page', page); else url.searchParams.delete('page');
    if (shuffleSeed) url.searchParams.set('shuffle', shuffleSeed); else url.searchParams.delete('shuffle');
    history[replace ? 'replaceState' : 'pushState'](null, '', url);
  }
  async function loadPage(number = 1) {
    if (!typeData) return;
    const token = ++request, pool = matches(), list = shuffleSeed ? randomPage(pool) : pool;
    page = Math.min(Math.max(1, Math.floor(Number(number) || 1)), Math.max(1, Math.ceil(list.length / pageSize)));
    setUrl(); syncPages(true); grid.setAttribute('aria-busy','true'); status.textContent = 'Loading Pokémon…';
    const offset = (page - 1) * pageSize, entries = list.slice(offset, offset + pageSize), cards = new Array(entries.length);
    let next = 0;
    await Promise.all(Array.from({length:Math.min(5, entries.length)}, async () => {
      while (next < entries.length && token === request) {
        const index = next++, entry = entries[index];
        try { cards[index] = {pokemon: await get(entry.pokemon.url)}; }
        catch { cards[index] = {entry}; }
      }
    }));
    if (token !== request) return;
    // Keep the current grid in place while fetching, so Shuffle cannot collapse
    // the page and force the browser to clamp the scroll position.
    releaseCards(); grid.replaceChildren();
    cards.forEach(({pokemon, entry}) => {
      if (!pokemon) {
        const message = document.createElement('div'); message.className = 'pokecard';
        const link = document.createElement('a'); link.href = `pokemoninfo.html?pokemon=${encodeURIComponent(entry.pokemon.name)}`; link.textContent = `${reverseTransformName(entry.pokemon.name)} — details unavailable`;
        const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Retry'; retry.addEventListener('click', () => loadPage(page));
        message.append(link, retry); grid.append(message); return;
      }
      const card = document.createElement('article'); card.className = 'pokecard'; card.dataset.pokemonName = pokemon.name;
      card.style.animationDelay = `${(grid.children.length % 5) * 25}ms`;
      card.addEventListener('animationend', event => {
        if (event.target === card) { card.style.animation = 'none'; card.style.animationDelay = ''; }
      });
      const name = escape(reverseTransformName(pokemon.name));
      card.innerHTML = `<a class="pokecard-link" href="pokemoninfo.html?pokemon=${encodeURIComponent(pokemon.name)}"><span class="card-stat"><span class="card-stat-first-line">BST: ${pokemon.stats.reduce((sum, stat) => sum + stat.base_stat, 0)}</span></span><img alt="${name}" decoding="async"><p><span class="pokemon-name" title="${name}">${name}</span><span class="pokemon-id">#${pokemon.id}</span></p><div class="card-types">${pokemon.types.map(({type}) => badge(type.name)).join('')}</div></a>`;
      const favorite = document.createElement('button'); favorite.type = 'button'; favorite.className = 'favorite-toggle'; favorite.innerHTML = star;
      const sync = () => { const selected = favorites.has(pokemon.id); favorite.setAttribute('aria-pressed', String(selected)); favorite.setAttribute('aria-label', `${selected ? 'Unfavorite' : 'Favorite'} ${reverseTransformName(pokemon.name)}`); };
      favorite.addEventListener('click', () => {
        if (favorites.has(pokemon.id)) favorites.delete(pokemon.id); else favorites.add(pokemon.id);
        try { localStorage.setItem(favoriteKey, JSON.stringify([...favorites])); } catch { notice('Favorites are saved for this visit only; browser storage is unavailable.'); }
        sync(); if (favoritesOnly) loadPage(page);
      });
      sync(); card.append(favorite); displayed.push({image:card.querySelector('img'), sprites:compactPokemonSprites(pokemon.sprites)}); grid.append(card);
    });
    refreshArtwork(); syncPages(); grid.setAttribute('aria-busy','false');
    status.textContent = list.length ? `Showing ${offset + 1}–${offset + entries.length} of ${list.length} Pokémon` : 'No matching Pokémon found.';
    if (shuffleSeed && list.length) status.textContent = `Random set of ${entries.length} from ${pool.length} matching Pokémon. Shuffle again for a new set.`;
  }
  function notice(text) { control('favorites-notice').hidden = !text; control('favorites-notice').textContent = text; }
  control('favorites-filter').addEventListener('click', () => { shuffleSeed = 0; favoritesOnly = !favoritesOnly; notice(favoritesOnly && !favorites.size ? 'No Pokémon are favorited.' : ''); loadPage(1); });
  window.addEventListener('storage', event => { if (event.key === favoriteKey || event.key === null) { readFavorites(); loadPage(page); } });
  for (const id of ['previous-page','top-previous-page']) control(id).addEventListener('click', () => loadPage(page - 1));
  for (const id of ['next-page','top-next-page']) control(id).addEventListener('click', () => loadPage(page + 1));
  for (const [form, input] of [['page-form','page-number'],['top-page-form','top-page-number']]) control(form).addEventListener('submit', event => { event.preventDefault(); if (control(input).reportValidity()) loadPage(control(input).value); });
  control('shuffle-page').addEventListener('click', () => {
    shuffleSeed = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
    loadPage(1);
  });
  control('shuffle-page').title = 'Show a random set of Pokémon of this type';
  function renderMatchups(data) {
    const relations = data.damage_relations;
    const groups = [['Super effective', relations.double_damage_to, '2'],['Weaknesses', relations.double_damage_from, '2'],['Resistances', relations.half_damage_from, '0.5']];
    if (relations.no_damage_from.length) groups.push(['Immunities', relations.no_damage_from, '0']);
    control('type-matchup-rows').innerHTML = groups.map(([title, list, multiplier]) => `<div class="type-matchup-row"><h3>${title}</h3><div class="type-matchup-badges">${list.length ? list.map(({name}) => `<a class="type-badge type-${name}" href="typeinfo.html?type=${name}">${name} ${multiplier}×</a>`).join('') : '<span class="type-matchup-empty">None</span>'}</div></div>`).join('');
    control('type-matchup-rows').querySelectorAll('a').forEach(link => link.addEventListener('click', event => { if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); loadType(new URL(link.href).searchParams.get('type')); }));
  }
  async function loadType(type, number = 1, push = true) {
    const token = ++request;
    currentType = types.includes(type) ? type : 'normal'; typeData = null;
    if (push) { shuffleSeed = 0; page = 1; setUrl(false); }
    selector.className = `type-badge type-${currentType}`; selector.textContent = currentType;
    typeMenu.querySelectorAll('button').forEach(button => button.setAttribute('aria-checked', String(button.dataset.type === currentType)));
    control('type-pokemon-title').innerHTML = `${badge(currentType)} type Pokémon`;
    document.title = `${currentType[0].toUpperCase() + currentType.slice(1)} — Type Info — CompDex`;
    control('type-matchup-rows').textContent = 'Loading matchups…';
    releaseCards(); grid.replaceChildren(); grid.setAttribute('aria-busy','true'); status.textContent = 'Loading Pokémon…'; syncPages(true);
    try {
      const data = await get(`https://pokeapi.co/api/v2/type/${currentType}`);
      if (token !== request) return;
      typeData = {...data, pokemon:[...data.pokemon].sort((a,b) => idOf(a) - idOf(b))};
      renderMatchups(data); await loadPage(number);
    } catch {
      if (token !== request) return;
      control('type-matchup-rows').textContent = 'Could not load matchups.';
      const error = document.createElement('div'); error.className = 'type-load-error'; error.textContent = 'Could not load this type. ';
      const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Retry'; retry.addEventListener('click', () => loadType(currentType, number, false)); error.append(retry); grid.append(error);
      status.textContent = 'Check your connection and try again.'; grid.setAttribute('aria-busy','false'); syncPages(true);
    }
  }
  window.addEventListener('popstate', () => { closeTypes(); const params = new URLSearchParams(location.search); shuffleSeed = Number(params.get('shuffle')) >>> 0; loadType(params.get('type'), params.get('page'), false); });
  const header = document.querySelector('.homepagebar');
  new ResizeObserver(() => document.documentElement.style.setProperty('--type-header-height', `${header.getBoundingClientRect().height}px`)).observe(header);
  syncArtwork();
  const params = new URLSearchParams(location.search); loadType(params.get('type'), params.get('page'), false);
});
