let currentPage = 1;
let totalPages = 1;
let loadingPage = false;
let gridQuery = "";
let pageRequest = 0;
let filterTimer;
let totalResults = null;
let resultsPending = true;
// Only keep the active sorted list, referencing the existing name catalogue.
let filteredResults = null;
const grid = document.getElementById("poke-grid");
const visibleArtwork = new WeakSet();
const pendingArtwork = new WeakSet();
const artworkObjectUrls = new WeakMap();
const cardArtworkSprites = new WeakMap();
const artworkQueue = [];
let activeArtworkRequests = 0;
function releaseImageArtwork(image) {
  image.style.removeProperty('object-view-box');
  image.removeAttribute("src");
  const url = artworkObjectUrls.get(image);
  if (url) {
    URL.revokeObjectURL(url);
    artworkObjectUrls.delete(image);
  }
}
function queueCardArtwork(image) {
  if (pendingArtwork.has(image) || image.hasAttribute("src")) return;
  pendingArtwork.add(image);
  artworkQueue.push(image);
  pumpCardArtwork();
}
function pumpCardArtwork() {
  while (activeArtworkRequests < 4 && artworkQueue.length) {
    const image = artworkQueue.shift();
    if (!image.isConnected || !visibleArtwork.has(image)) { pendingArtwork.delete(image); continue; }
    activeArtworkRequests++;
    const source = image.dataset.artworkSource;
    const request = image.dataset.modern === 'true'
      ? resolveModernArtwork(source, JSON.parse(image.dataset.artworkFallbacks || "[]"))
      : image.dataset.animated === 'true' ? Promise.resolve(source)
      : image.classList.contains("pixel-artwork") ? cropPixelArtwork(source) : createCardThumbnail(source, image.dataset.modern === 'true');
    request.then(thumbnail => {
      if (image.isConnected && visibleArtwork.has(image) && image.dataset.artworkSource === source) {
        releaseImageArtwork(image);
        const source = thumbnail instanceof Blob ? URL.createObjectURL(thumbnail) : thumbnail;
        if (thumbnail instanceof Blob) artworkObjectUrls.set(image, source);
        image.src = source;
        if (image.dataset.animated === 'true') cropAnimatedArtwork(image, source);
      }
    }).finally(() => {
      pendingArtwork.delete(image);
      activeArtworkRequests--;
      if (image.isConnected && visibleArtwork.has(image) && !image.hasAttribute("src")) queueCardArtwork(image);
      pumpCardArtwork();
    });
  }
}
const artworkObserver = typeof IntersectionObserver === "function" ? new IntersectionObserver(entries => {
  entries.forEach(({ target: image, isIntersecting }) => {
    if (isIntersecting) { visibleArtwork.add(image); queueCardArtwork(image); }
    else { visibleArtwork.delete(image); releaseImageArtwork(image); }
  });
}, { rootMargin: "160px 0px" }) : null;
function releaseCardArtwork() {
  if (artworkObserver) artworkObserver.disconnect();
  artworkQueue.length = 0;
  grid.querySelectorAll("img").forEach(image => { visibleArtwork.delete(image); releaseImageArtwork(image); });
}
function observeCardArtwork() {
  grid.querySelectorAll("img[data-artwork-source]").forEach(image => {
    if (artworkObserver) artworkObserver.observe(image);
    else { visibleArtwork.add(image); queueCardArtwork(image); }
  });
}
function deferOffscreenCards(cards) {
  if (!CSS.supports("content-visibility", "auto")) return;
  // Measure before applying containment so skipped grid rows retain their actual size.
  const heights = cards.map(card => {
    const style = getComputedStyle(card);
    return card.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  });
  cards.forEach((card, index) => {
    card.style.containIntrinsicBlockSize = `auto ${heights[index]}px`;
    card.classList.add("deferred-card");
  });
}
const status = document.getElementById("grid-status");
const pageInput = document.getElementById("page-number");
const previousButton = document.getElementById("previous-page");
const nextButton = document.getElementById("next-page");
const topPageInput = document.getElementById("top-page-number");
const topPreviousButton = document.getElementById("top-previous-page");
const topNextButton = document.getElementById("top-next-page");
const typeFilter = document.getElementById("type-filter");
const nameFilter = document.getElementById("name-filter");
const secondTypeFilter = document.getElementById("second-type-filter");
const sortFilter = document.getElementById("sort-filter");
const statLabels = { total: "BST", speed: "Speed", attack: "Attack", "special-attack": "Sp. Atk", defense: "Defense", "special-defense": "Sp Def", hp: "HP" };
const generationFilter = document.getElementById("generation-filter");
const gameFilter = document.getElementById("game-filter");
let gameData;
function loadGameData() {
  if (!gameData) gameData = fetch("data/games.json").then(response => {
    if (!response.ok) throw new Error("Game data unavailable");
    return response.json();
  }).catch(error => { gameData = null; throw error; });
  return gameData;
}
function nameMatchRank(pokemon, query, number) {
  if (!query) return 0;
  if (number !== null) return pokemon.id === number ? 0 : String(pokemon.id).startsWith(String(number)) ? 1 : 3;
  const name = pokemon.displayName.toLowerCase();
  if (query === "mega") return /-mega(?:-|$)/.test(pokemon.api) ? 1 : name.includes(query) ? 2 : 3;
  return name === query ? 0 : name.startsWith(query) ? 1 : name.includes(query) ? 2 : 3;
}
const categoryFilter = document.getElementById("category-filter");
const categoryBits = { legendary: 1, mythical: 2, pseudo: 4, ultra: 8, paradox: 16 };
let categoryData;
function loadCategoryData() {
  if (!categoryData) categoryData = fetch("data/categories.json").then(response => {
    if (!response.ok) throw new Error("Category data unavailable");
    return response.json();
  }).catch(error => { categoryData = null; throw error; });
  return categoryData;
}
const minimumSpeed = document.getElementById("minimum-speed");
const minimumStat = document.getElementById("minimum-stat-filter");
const minimumValue = document.getElementById("minimum-stat-value");
const regulationFilter = document.getElementById("regulation-filter");
const battleFormat = document.getElementById("battle-format");
const usageNote = document.getElementById("usage-note");
let usageNoticeTimer;
let lastUsageNoticeKey = "";
function updateUsageNotice(regulation, usage, format, showUsage) {
  if (!showUsage || usage?.month) {
    clearTimeout(usageNoticeTimer);
    usageNote.hidden = true;
    lastUsageNoticeKey = "";
    return;
  }
  const key = `${regulation.name}:${format}`;
  if (key === lastUsageNoticeKey) return;
  lastUsageNoticeKey = key;
  clearTimeout(usageNoticeTimer);
  usageNote.textContent = `${regulation.name} usage is not published yet.`;
  usageNote.hidden = false;
  usageNote.classList.remove("empty-notice");
  void usageNote.offsetWidth;
  usageNote.classList.add("empty-notice");
  usageNoticeTimer = setTimeout(() => { usageNote.hidden = true; }, 4200);
}
const header = document.querySelector(".homepagebar");
function installCardArtworkFallback(image) {
  installArtworkFallbacks(image, JSON.parse(image.dataset.artworkFallbacks || "[]"), image.dataset.modern === 'true', () => releaseImageArtwork(image));
}
function refreshCardArtwork(preferences, replayAnimation = false) {
  grid.querySelectorAll(".pokecard").forEach(card => {
    const sprites = cardArtworkSprites.get(card);
    if (!sprites) return;
    const link = card.querySelector(".pokecard-link");
    let image = link.querySelector("img[data-artwork-source]");
    const { source, pixel, animated, fallbacks } = getPokemonArtwork(sprites, preferences);
    if (!source) {
      if (image) {
        artworkObserver?.unobserve(image);
        visibleArtwork.delete(image);
        releaseImageArtwork(image);
        image.replaceWith(Object.assign(document.createElement("div"), { className: "artwork-placeholder", textContent: "No artwork" }));
      }
      return;
    }
    const isNew = !image;
    if (isNew) {
      image = document.createElement("img");
      image.alt = card.dataset.pokemonName;
      image.decoding = "async";
      link.querySelector(".artwork-placeholder")?.replaceWith(image);
      installCardArtworkFallback(image);
    }
    const changed = isNew || image.dataset.artworkSource !== source || image.dataset.animated !== String(animated);
    if (changed) releaseImageArtwork(image);
    image.dataset.artworkSource = source;
    image.dataset.animated = String(animated);
    image.dataset.modern = String(preferences.artwork === 'champions');
    if (changed) {
      image.dataset.artworkFallbacks = JSON.stringify(fallbacks);
      installCardArtworkFallback(image);
    }
    if (changed) image.className = pixel ? "pixel-artwork" : "official-artwork";
    if (isNew) {
      if (artworkObserver) artworkObserver.observe(image);
      else visibleArtwork.add(image);
    }
    if (changed && visibleArtwork.has(image)) queueCardArtwork(image);
  });
  if (replayAnimation) {
    const cards = grid.querySelectorAll(".pokecard");
    cards.forEach(card => { card.style.animation = "none"; });
    // Restart the original CSS animation without rebuilding or remeasuring cards.
    void grid.offsetWidth;
    cards.forEach((card, index) => {
      card.style.removeProperty("animation");
      card.style.animationDelay = `${(index % 5) * 25}ms`;
    });
  }
}
new ResizeObserver(() => {
  document.documentElement.style.setProperty("--homepage-header-height", `${header.getBoundingClientRect().height}px`);
}).observe(header);
let competitiveData;
function loadCompetitiveData() {
  if (!competitiveData) competitiveData = fetch("data/competitive.json").then(response => {
    if (!response.ok) throw new Error("Competitive data unavailable");
    return response.json();
  }).catch(error => { competitiveData = null; throw error; });
  return competitiveData;
}
function competitiveName(name) {
  // PokéAPI explicitly names these default forms; Showdown uses the species name.
  return name.replace(/-(incarnate|altered|ordinary|disguised|amped|red-striped|plant|shield|male|midday|solo|standard|land|normal|baile|full-belly|two-segment|family-of-four)$/, "").replace(/[^a-z0-9]/g, "");
}
function minimum(input) { return input.value.trim() && Number.isFinite(Number(input.value)) ? Math.max(0, Number(input.value)) : null; }
sortFilter.value = window.CompDexSettings.get().defaultSort;
let sortDirection = window.CompDexSettings.get().sortDirection;
const sortDirectionButton = document.getElementById("sort-direction");
function syncSortDirection() {
  sortDirectionButton.textContent = sortDirection === "asc" ? "↑" : "↓";
  const statSort = !["id", "name"].includes(sortFilter.value);
  sortDirectionButton.setAttribute("aria-label", statSort
    ? sortDirection === "asc" ? "Highest first; switch to lowest first" : "Lowest first; switch to highest first"
    : sortDirection === "asc" ? "Ascending order; switch to descending" : "Descending order; switch to ascending");
}
syncSortDirection();
let statSortData;
function loadStatSortData() {
  if (!statSortData) statSortData = fetch("https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_stats.csv")
    .then(response => { if (!response.ok) throw new Error("Stat data unavailable"); return response.text(); })
    .then(text => {
      const stats = new Map();
      const names = [null, "hp", "attack", "defense", "special-attack", "special-defense", "speed"];
      for (const line of text.trim().split(/\r?\n/).slice(1)) {
        const [id, stat, value] = line.split(",").map(Number);
        if (!names[stat] || !Number.isFinite(value)) continue;
        if (!stats.has(id)) stats.set(id, { total: 0 });
        stats.get(id)[names[stat]] = value;
        stats.get(id).total += value;
      }
      return stats;
    }).catch(error => { statSortData = null; throw error; });
  return statSortData;
}
const favoritesFilter = document.getElementById("favorites-filter");
const favoritesNotice = document.getElementById("favorites-notice");
const favoritesStorageKey = "compdex.favorites.v1";
let favoriteIds = new Set();
let favoritesOnly = false;
let showEmptyFavoritesNotice = false;
let favoritesStorageUnavailable = false;
let favoritesNoticeTimer;
try {
  const saved = JSON.parse(localStorage.getItem(favoritesStorageKey) || "[]");
  if (Array.isArray(saved)) favoriteIds = new Set(saved.filter(id => Number.isInteger(id) && id > 0));
} catch { /* Continue with favorites in memory when storage is unavailable. */ }
function updateFavoritesNotice() {
  if (favoriteIds.size > 0) showEmptyFavoritesNotice = false;
  favoritesFilter.setAttribute("aria-pressed", String(favoritesOnly));
  const empty = showEmptyFavoritesNotice && favoriteIds.size === 0;
  favoritesNotice.hidden = !empty && !favoritesStorageUnavailable;
  favoritesNotice.textContent = empty ? "No Pokémon are favorited." : "Favorites are saved for this visit only; browser storage is unavailable.";
  if (empty && !favoritesNotice.classList.contains("empty-notice")) {
    clearTimeout(favoritesNoticeTimer);
    favoritesNotice.classList.add("empty-notice");
    favoritesNoticeTimer = setTimeout(() => {
      showEmptyFavoritesNotice = false;
      updateFavoritesNotice();
    }, 4200);
  } else if (!empty) {
    clearTimeout(favoritesNoticeTimer);
    favoritesNotice.classList.remove("empty-notice");
  }
}
function addFavoriteButton(card, id, name) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "favorite-toggle";
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" /></svg>';
  function sync() {
    const selected = favoriteIds.has(id);
    button.setAttribute("aria-pressed", String(selected));
    button.setAttribute("aria-label", `${selected ? "Unfavorite" : "Favorite"} ${reverseTransformName(name)}`);
  }
  button.addEventListener("click", () => {
    const wasFavoritesOnly = favoritesOnly;
    if (favoriteIds.has(id)) favoriteIds.delete(id);
    else favoriteIds.add(id);
    if (favoriteIds.size === 0 && favoritesOnly) {
      favoritesOnly = false;
      showEmptyFavoritesNotice = true;
    }
    try {
      localStorage.setItem(favoritesStorageKey, JSON.stringify([...favoriteIds]));
      favoritesStorageUnavailable = false;
    } catch { favoritesStorageUnavailable = true; }
    sync();
    updateFavoritesNotice();
    if (wasFavoritesOnly) filterHomepage();
  });
  sync();
  card.append(button);
}
const homepageDataCache = new Map();
const generationPokemonCache = new Map();
const evolutionFamilyCache = new Map();
const types = ["normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground", "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy"];
for (const filter of [typeFilter, secondTypeFilter]) {
for (const type of types) {
  const option = document.createElement("option");
  option.value = type;
  option.textContent = type[0].toUpperCase() + type.slice(1);
  filter.appendChild(option);
}
}
const romanGenerations = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"];
for (let generation = 1; generation <= 9; generation++) {
  const option = document.createElement("option");
  option.value = generation;
  option.textContent = romanGenerations[generation - 1];
  generationFilter.appendChild(option);
}

const filterDropdowns = [];
const multiFilterSelections = new Map([
  [categoryFilter, new Set()],
  [generationFilter, new Set()],
  [gameFilter, new Set()],
]);
function createFilterDropdown(select, isType = false) {
  const selections = multiFilterSelections.get(select);
  const wrapper = document.createElement("div");
  wrapper.className = "filter-dropdown";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.id = `${select.id}-trigger`;
  trigger.className = "filter-trigger";
  trigger.setAttribute("aria-haspopup", "menu");
  trigger.setAttribute("aria-expanded", "false");
  const menu = document.createElement("div");
  menu.className = `filter-menu${isType ? " type-filter-menu" : ""}`;
  menu.id = `${select.id}-menu`;
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-labelledby", trigger.id);
  menu.inert = true;
  trigger.setAttribute("aria-controls", menu.id);
  select.before(wrapper);
  wrapper.append(trigger, menu);
  if (select === regulationFilter) wrapper.append(usageNote);
  select.hidden = true;
  const label = document.querySelector(`label[for="${select.id}"]`);
  if (label) label.htmlFor = trigger.id;
  const options = [...select.options];
  if (select.id === 'index-artwork') {
    const sizeArtworkTrigger = () => {
      const style = getComputedStyle(trigger);
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      context.font = style.font;
      const labelWidth = Math.max(...options.map(option => context.measureText(option.textContent).width));
      const chrome = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
        + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
      trigger.style.width = `${Math.ceil(labelWidth + chrome + 2 + 12)}px`;
    };
    sizeArtworkTrigger();
    document.fonts?.ready.then(sizeArtworkTrigger);
    window.addEventListener('resize', sizeArtworkTrigger);
  }
  const buttons = options.map(option => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-option";
    button.setAttribute("role", selections ? "menuitemcheckbox" : "menuitemradio");
    button.tabIndex = -1;
    if (isType && option.value) {
      const badge = document.createElement("span");
      badge.className = `type-badge type-${option.value}`;
      badge.textContent = option.textContent;
      button.append(badge);
    } else button.textContent = option.textContent;
    button.addEventListener("click", () => {
      if (selections) {
        if (!option.value) selections.clear();
        else if (selections.has(option.value)) selections.delete(option.value);
        else selections.add(option.value);
        sync();
        button.focus();
        select.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }
      select.value = option.value;
      sync();
      close();
      trigger.focus();
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    menu.append(button);
    return button;
  });
  function sync() {
    const option = options.find(option => option.value === select.value) || options[0];
    trigger.replaceChildren();
    if (selections) {
      const selected = options.filter(option => selections.has(option.value));
      const label = select.getAttribute('aria-label') || options[0].textContent;
      const pluralLabel = select === categoryFilter ? 'Categories' : select === generationFilter ? 'Generations' : 'Games';
      trigger.textContent = selected.length > 1 ? `${pluralLabel} (${selected.length})`
        : selected.length === 1 ? select === generationFilter ? `Generation ${selected[0].textContent}` : selected[0].textContent
        : options[0].textContent;
      trigger.setAttribute('aria-label', `${label}: ${selected.length ? selected.map(option => option.textContent).join(', ') : 'All'}`);
      buttons.forEach((button, index) => button.setAttribute('aria-checked', String(options[index].value ? selections.has(options[index].value) : !selections.size)));
    } else if (isType && option.value) {
      const badge = document.createElement("span");
      badge.className = `type-badge type-${option.value}`;
      badge.textContent = option.textContent;
      trigger.append(badge);
    } else trigger.textContent = select === generationFilter && option.value
      ? `Generation ${option.textContent}` : [sortFilter, minimumStat].includes(select) ? statLabels[option.value] || option.textContent : option.textContent;
    if (!selections) {
      trigger.setAttribute("aria-label", `${select.getAttribute("aria-label") || "Sort by"}: ${option.textContent}`);
      buttons.forEach((button, index) => button.setAttribute("aria-checked", String(options[index].value === select.value)));
    }
  }
  function close() {
    wrapper.classList.remove("open");
    trigger.setAttribute("aria-expanded", "false");
    menu.inert = true;
  }
  function open() {
    filterDropdowns.forEach(dropdown => dropdown.close());
    wrapper.classList.add("open");
    const bounds = trigger.getBoundingClientRect();
    const above = bounds.top - header.getBoundingClientRect().height - 12;
    const below = window.innerHeight - bounds.bottom - 12;
    const opensUp = below < menu.scrollHeight && above > below;
    wrapper.classList.toggle("opens-up", opensUp);
    menu.style.maxHeight = `${Math.max(100, opensUp ? above : below)}px`;
    trigger.setAttribute("aria-expanded", "true");
    menu.inert = false;
    buttons[Math.max(0, options.findIndex(option => selections ? selections.has(option.value) : option.value === select.value))].focus();
  }
  trigger.addEventListener("click", () => wrapper.classList.contains("open") ? close() : open());
  trigger.addEventListener("keydown", event => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); open(); }
  });
  wrapper.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); close(); trigger.focus(); }
    const index = buttons.indexOf(document.activeElement);
    if (index >= 0 && ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
        : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].focus();
    }
  });
  wrapper.addEventListener("focusout", event => { if (!wrapper.contains(event.relatedTarget)) close(); });
  document.addEventListener("pointerdown", event => { if (!wrapper.contains(event.target)) close(); });
  select.addEventListener("change", sync);
  sync();
  filterDropdowns.push({ sync, close });
}
createFilterDropdown(typeFilter, true);
createFilterDropdown(secondTypeFilter, true);
createFilterDropdown(generationFilter);
createFilterDropdown(sortFilter);
createFilterDropdown(minimumStat);
createFilterDropdown(regulationFilter);
createFilterDropdown(battleFormat);
createFilterDropdown(categoryFilter);
createFilterDropdown(gameFilter);
createFilterDropdown(document.getElementById('index-artwork'));
document.addEventListener('DOMContentLoaded', () => {
  filterDropdowns.forEach(dropdown => dropdown.sync());
});
window.addEventListener('compdex:settings-changed', () => {
  filterDropdowns.forEach(dropdown => dropdown.sync());
});
const filterUrlKeys = ['q','type','type2','sort','order','reg','format','minSpeed','minStat','minValue','category','gen','game','favorites','related','page'];
function restoreFiltersFromUrl() {
  const params = new URLSearchParams(location.search);
  const selectValue = (key, select) => {
    const value = params.get(key);
    if (value !== null && [...select.options].some(option => option.value === value)) select.value = value;
  };
  selectValue('type', typeFilter);
  selectValue('type2', secondTypeFilter);
  selectValue('sort', sortFilter);
  selectValue('reg', regulationFilter);
  selectValue('format', battleFormat);
  selectValue('minStat', minimumStat);
  for (const [key, select] of [['category', categoryFilter], ['gen', generationFilter], ['game', gameFilter]]) {
    const valid = new Set([...select.options].map(option => option.value).filter(Boolean));
    const selections = multiFilterSelections.get(select);
    params.getAll(key).flatMap(value => value.split(',')).forEach(value => {
      if (valid.has(value)) selections.add(value);
    });
  }
  sortDirection = params.get('order') === 'desc' ? 'desc' : sortDirection;
  nameFilter.value = params.get('q') || '';
  for (const [key, input] of [['minSpeed', minimumSpeed], ['minValue', minimumValue]]) {
    const value = params.get(key);
    if (value !== null && Number.isFinite(Number(value)) && Number(value) >= 0) input.value = value;
  }
  favoritesOnly = params.get('favorites') === '1' && favoriteIds.size > 0;
  updateFavoritesNotice();
  syncSortDirection();
  filterDropdowns.forEach(dropdown => dropdown.sync());
  gridQuery = nameFilter.value.toLowerCase().trim();
  const page = Number(params.get('page'));
  return Number.isInteger(page) && page > 0 ? page : 1;
}
function syncFilterUrl(page = currentPage) {
  const url = new URL(location.href);
  filterUrlKeys.forEach(key => url.searchParams.delete(key));
  const add = (key, value, fallback = '') => { if (value !== fallback && value !== '') url.searchParams.set(key, String(value)); };
  add('q', nameFilter.value.trim());
  add('type', typeFilter.value);
  add('type2', secondTypeFilter.value);
  add('sort', sortFilter.value, window.CompDexSettings.get().defaultSort);
  add('order', sortDirection, window.CompDexSettings.get().sortDirection);
  add('reg', regulationFilter.value);
  add('format', battleFormat.value, 'doubles');
  add('minSpeed', minimumSpeed.value.trim());
  add('minStat', minimumStat.value, 'total');
  add('minValue', minimumValue.value.trim());
  for (const [key, select] of [['category', categoryFilter], ['gen', generationFilter], ['game', gameFilter]]) {
    const selected = multiFilterSelections.get(select);
    [...select.options].forEach(option => {
      if (selected.has(option.value)) url.searchParams.append(key, option.value);
    });
  }
  if (favoritesOnly) url.searchParams.set('favorites', '1');
  if (!window.CompDexSettings.get().includeEvolutions) url.searchParams.set('related', '0');
  if (page > 1) url.searchParams.set('page', String(page));
  if (url.href !== location.href) history.replaceState(history.state, '', url);
}
const initialFilterPage = restoreFiltersFromUrl();

function updatePageControls() {
  previousButton.disabled = loadingPage || currentPage <= 1;
  nextButton.disabled = loadingPage || currentPage >= totalPages;
  pageInput.disabled = loadingPage;
  pageInput.max = totalPages;
  pageInput.style.width = `${String(totalPages).length + 1}ch`;
  pageInput.value = currentPage;
  document.getElementById("page-total").textContent = `of ${totalPages}`;
  grid.setAttribute("aria-busy", String(loadingPage));
  document.getElementById("filter-results").textContent = loadingPage && resultsPending ? "Results: …" : `Results: ${totalResults ?? "—"}`;
  topPreviousButton.disabled = previousButton.disabled;
  topNextButton.disabled = nextButton.disabled;
  topPageInput.disabled = loadingPage;
  topPageInput.max = totalPages;
  topPageInput.style.width = `${String(totalPages).length + 1}ch`;
  topPageInput.value = currentPage;
  document.getElementById("top-page-total").textContent = `/${totalPages}`;
}

async function fetchPokemon(url) {
  if (homepageDataCache.has(url)) {
    const cached = homepageDataCache.get(url);
    homepageDataCache.delete(url);
    homepageDataCache.set(url, cached);
    return cached;
  }
  if (!homepageDataCache.has(url)) {
    const request = fetch(url).then(response => {
      if (!response.ok) throw new Error("Pokémon request failed");
      return response.json();
    }).then(data => {
      // Keep only what this page uses, rather than moves, descriptions, and every sprite.
      if (/\/pokemon\/[^/]+\/?$/.test(url)) return {
        id: data.id, name: data.name, species: data.species, types: data.types,
        stats: data.stats.map(entry => ({ name: entry.stat.name, value: entry.base_stat })),
        sprites: compactPokemonSprites(data.sprites),
      };
      if (/\/pokemon-species\/[^/]+\/?$/.test(url)) return { varieties: data.varieties, evolution_chain: data.evolution_chain };
      if (/\/type\/[^/]+\/?$/.test(url)) return { pokemon: data.pokemon };
      if (/\/generation\/[^/]+\/?$/.test(url)) return { pokemon_species: data.pokemon_species };
      if (/\/evolution-chain\/[^/]+\/?$/.test(url)) {
        const compactChain = node => ({ species: node.species, evolves_to: node.evolves_to.map(compactChain) });
        return { chain: compactChain(data.chain) };
      }
      return data;
    }).catch(error => {
      if (homepageDataCache.get(url) === request) homepageDataCache.delete(url);
      throw error;
    });
    homepageDataCache.set(url, request);
    while (homepageDataCache.size > 100) homepageDataCache.delete(homepageDataCache.keys().next().value);
  }
  return homepageDataCache.get(url);
}

async function getGenerationPokemon(generation) {
  if (!generationPokemonCache.has(generation)) {
    const request = (async () => {
      const [data, games] = await Promise.all([
        fetchPokemon(`https://pokeapi.co/api/v2/generation/${generation}`),
        loadGameData().catch(() => null),
        pokemonNamesReady,
      ]);
      const names = new Set();
      if (games && allPokemonNames.length) {
        // Reuse the official species mapping already shipped for the Game filter.
        const speciesIds = new Set(data.pokemon_species.map(species => Number(species.url.split('/').filter(Boolean).pop())));
        const unknown = [];
        allPokemonNames.forEach(pokemon => {
          const speciesId = games.pokemonSpecies[pokemon.id];
          if (speciesId === undefined) unknown.push(pokemon);
          else if (speciesIds.has(speciesId)) names.add(pokemon.api);
        });
        // New API records absent from the bundled mapping still work immediately.
        await forEachLimited(unknown, async pokemon => {
          const details = await fetchPokemon(`https://pokeapi.co/api/v2/pokemon/${pokemon.id}`);
          const speciesId = Number(details.species.url.split('/').filter(Boolean).pop());
          if (speciesIds.has(speciesId)) names.add(pokemon.api);
        });
        return names;
      }
      let index = 0;
      // Preserve live API lookup if the bundled mapping is unavailable.
      await Promise.all(Array.from({ length: Math.min(8, data.pokemon_species.length) }, async () => {
        while (index < data.pokemon_species.length) {
          const species = data.pokemon_species[index++];
          const details = await fetchPokemon(species.url);
          details.varieties.forEach(variety => names.add(variety.pokemon.name));
        }
      }));
      return names;
    })().catch(error => {
      generationPokemonCache.delete(generation);
      throw error;
    });
    generationPokemonCache.set(generation, request);
  }
  return generationPokemonCache.get(generation);
}

async function forEachLimited(items, visit, isCurrent = () => true) {
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(6, items.length) }, async () => {
    while (index < items.length && isCurrent()) {
      const position = index++;
      await visit(items[position], position);
    }
  }));
}

async function getEvolutionFamily(chainUrl) {
  if (evolutionFamilyCache.has(chainUrl)) {
    const cached = evolutionFamilyCache.get(chainUrl);
    evolutionFamilyCache.delete(chainUrl);
    evolutionFamilyCache.set(chainUrl, cached);
    return cached;
  }
  if (!evolutionFamilyCache.has(chainUrl)) {
    const request = (async () => {
      const data = await fetchPokemon(chainUrl);
      const species = [];
      function collect(node) {
        species.push(node.species);
        node.evolves_to.forEach(collect);
      }
      collect(data.chain);
      const names = new Set();
      await forEachLimited(species, async entry => {
        const details = await fetchPokemon(entry.url);
        details.varieties.forEach(variety => names.add(variety.pokemon.name));
      });
      return names;
    })().catch(error => {
      if (evolutionFamilyCache.get(chainUrl) === request) evolutionFamilyCache.delete(chainUrl);
      throw error;
    });
    evolutionFamilyCache.set(chainUrl, request);
    while (evolutionFamilyCache.size > 100) evolutionFamilyCache.delete(evolutionFamilyCache.keys().next().value);
  }
  return evolutionFamilyCache.get(chainUrl);
}

async function getSearchEvolutionNames(query, number, includeEvolutions, isCurrent = () => true) {
  // Numeric family expansion starts from the exact ID, retaining prefix matching separately.
  if (!includeEvolutions || (number === null && query.length < 3)) return { names: null, failed: false };
  const matches = allPokemonNames.filter(pokemon => number !== null
    ? pokemon.id === number : pokemon.displayName.includes(query));
  const names = new Set(matches.map(pokemon => pokemon.api));
  let failed = false;
  await forEachLimited(matches, async pokemon => {
    try {
      const details = await fetchPokemon(`https://pokeapi.co/api/v2/pokemon/${pokemon.id}`);
      if (!isCurrent()) return;
      const species = await fetchPokemon(details.species.url);
      if (!isCurrent()) return;
      if (species.evolution_chain) {
        const family = await getEvolutionFamily(species.evolution_chain.url);
        family.forEach(name => names.add(name));
      }
    } catch { failed = true; }
  }, isCurrent);
  return { names, failed };
}

async function loadPage(page, replaceSearch = false) {
  if ((loadingPage && !replaceSearch) || !Number.isFinite(page)) return;
  const request = ++pageRequest;
  const isCurrent = () => request === pageRequest;
  const query = gridQuery;
  const selectedType = typeFilter.value;
  const selectedSecondType = secondTypeFilter.value;
  const selectedSort = sortFilter.value;
  const selectedDirection = sortDirection === "asc" ? 1 : -1;
  const selectedFavoritesOnly = favoritesOnly && favoriteIds.size > 0;
  const selectedFavoriteIds = new Set(favoriteIds);
  const selectedGenerations = new Set(multiFilterSelections.get(generationFilter));
  const selectedCategories = new Set(multiFilterSelections.get(categoryFilter));
  const selectedGames = new Set(multiFilterSelections.get(gameFilter));
  const speedMinimum = minimum(minimumSpeed);
  const statMinimum = minimum(minimumValue);
  const minimumStatName = minimumStat.value;
  const selectedRegulation = regulationFilter.value || (selectedSort === "usage" ? "mc" : "");
  const selectedFormat = battleFormat.value;
  const preferences = window.CompDexSettings.get();
  const pageSize = preferences.pageSize;
  if (totalResults !== null) totalPages = Math.max(1, Math.ceil(totalResults / pageSize));
  page = Math.max(1, Math.min(totalResults === null ? Infinity : totalPages, Math.trunc(page)));
  loadingPage = true;
  updatePageControls();
  status.textContent = `Loading page ${page}…`;
  try {
    let offset = (page - 1) * pageSize;
    let data;
    let evolutionSearchFailed = false;
    if (!filteredResults) {
      await pokemonNamesReady;
      if (request !== pageRequest) return;
      if (!allPokemonNames.length) throw new Error("Search list unavailable");
      const number = pokemonNumber(query);
      const [typeData, secondTypeData, generationNames, evolutionSearch, statData, competitive, categories, games] = await Promise.all([
        selectedType ? fetchPokemon(`https://pokeapi.co/api/v2/type/${selectedType}`) : null,
        selectedSecondType ? fetchPokemon(`https://pokeapi.co/api/v2/type/${selectedSecondType}`) : null,
        selectedGenerations.size ? Promise.all([...selectedGenerations].map(getGenerationPokemon)) : null,
        getSearchEvolutionNames(query, number, preferences.includeEvolutions, isCurrent),
        (statLabels[selectedSort] || speedMinimum !== null || statMinimum !== null) ? loadStatSortData() : null,
        selectedRegulation ? loadCompetitiveData() : null,
        selectedCategories.size ? loadCategoryData() : null,
        selectedGames.size ? loadGameData() : null,
      ]);
      if (request !== pageRequest) return;
      const gameSpecies = games ? new Set(games.games.filter(game => selectedGames.has(String(game.id))).flatMap(game => game.species || [])) : null;
      const generationPokemon = generationNames ? new Set(generationNames.flatMap(names => [...names])) : null;
      const regulation = competitive?.regulations[selectedRegulation];
      const legal = regulation ? new Set(regulation.legal) : null;
      const usage = regulation?.formats[selectedFormat];
      updateUsageNotice(regulation, usage, selectedFormat, selectedSort === "usage");
      document.getElementById("regulation-filter-trigger").title = usage?.month
        ? `${regulation.name} / ${selectedFormat} / ${usage.month} / Showdown ladder, 1630 rating cutoff`
        : "";
      const typeNames = typeData ? new Set(typeData.pokemon.map(entry => entry.pokemon.name)) : null;
      const secondTypeNames = secondTypeData ? new Set(secondTypeData.pokemon.map(entry => entry.pokemon.name)) : null;
      const categoryChoices = [...selectedCategories];
      evolutionSearchFailed = evolutionSearch.failed;
      const matches = allPokemonNames.filter(pokemon => {
        const searchMatches = number !== null
          ? String(pokemon.id).startsWith(String(number)) || Boolean(evolutionSearch.names?.has(pokemon.api))
          : evolutionSearch.names ? evolutionSearch.names.has(pokemon.api) : pokemon.displayName.includes(query);
        return searchMatches && (!typeNames || typeNames.has(pokemon.api))
          // PokéAPI's alternate Pokémon records use IDs of 10000 and above.
          && (preferences.includeAltForms || pokemon.id < 10000)
          && (!selectedFavoritesOnly || selectedFavoriteIds.has(pokemon.id))
          && (!secondTypeNames || secondTypeNames.has(pokemon.api))
          && (!generationPokemon || generationPokemon.has(pokemon.api))
          && (!gameSpecies || gameSpecies.has(games.pokemonSpecies[pokemon.id]))
          && (!legal || legal.has(competitiveName(pokemon.api)))
          && (!selectedCategories.size || categoryChoices.some(category => category === "ordinary"
            ? categories[pokemon.id] === 0
            : Boolean(categories[pokemon.id] & categoryBits[category])))
          && (speedMinimum === null || (statData.get(pokemon.id)?.speed ?? -1) >= speedMinimum)
          && (statMinimum === null || (statData.get(pokemon.id)?.[minimumStatName] ?? -1) >= statMinimum);
      });
      matches.sort((a, b) => {
        const relevance = nameMatchRank(a, query, number) - nameMatchRank(b, query, number);
        if (relevance) return relevance;
        if (selectedSort === "name") return selectedDirection * a.displayName.localeCompare(b.displayName) || a.id - b.id;
        if (selectedSort === "id") return selectedDirection * (a.id - b.id);
        const first = selectedSort === "usage" ? usage?.usage[competitiveName(a.api)] : statData.get(a.id)?.[selectedSort];
        const second = selectedSort === "usage" ? usage?.usage[competitiveName(b.api)] : statData.get(b.id)?.[selectedSort];
        if (first === undefined || second === undefined) return first === second ? a.id - b.id : first === undefined ? 1 : -1;
        return -selectedDirection * (first - second) || a.id - b.id;
      });
      filteredResults = { matches, evolutionSearchFailed, usage };
    }
    evolutionSearchFailed = filteredResults.evolutionSearchFailed;
    const pageUsage = filteredResults.usage;
    page = Math.min(page, Math.max(1, Math.ceil(filteredResults.matches.length / pageSize)));
    offset = (page - 1) * pageSize;
    data = {
        count: filteredResults.matches.length,
        results: filteredResults.matches.slice(offset, offset + pageSize).map(pokemon => ({
          name: pokemon.api,
          url: `https://pokeapi.co/api/v2/pokemon/${pokemon.id}`,
        })),
      };
    if (request !== pageRequest) return;
    const cards = new Array(data.results.length);
    await forEachLimited(data.results, async (pokemon, index) => {
      const card = document.createElement("article");
      card.className = "pokecard";
      card.dataset.pokemonName = pokemon.name;
      card.style.animationDelay = `${(index % 5) * 25}ms`;
      card.addEventListener("animationend", event => {
        if (event.target === card) {
          card.style.animation = "none";
          card.style.animationDelay = "";
        }
      });
      const link = document.createElement("a");
      link.className = "pokecard-link";
      link.href = `pokemoninfo.html?pokemon=${encodeURIComponent(pokemon.name)}`;
      try {
        const details = await fetchPokemon(pokemon.url);
        if (!isCurrent()) return;
        cardArtworkSprites.set(card, details.sprites);
        const baseStatTotal = details.stats.reduce((sum, entry) => sum + entry.value, 0);
        // Add minimum stats after the sort stat, showing each stat only once.
        const displayedStats = ["total"];
        if (statLabels[selectedSort] && selectedSort !== "total") displayedStats.push(selectedSort);
        if (speedMinimum !== null) displayedStats.push("speed");
        if (statMinimum !== null) displayedStats.push(minimumStatName);
        const statLines = [...new Set(displayedStats)].map(stat => {
          if (stat === "total") {
            const value = pageUsage?.usage[competitiveName(pokemon.name)];
            const usage = selectedSort === "usage" ? `<span class="card-usage">Usage: ${value === undefined ? "\u2014" : value.toFixed(2) + "%"}</span>` : "";
            return `<span class="card-stat-first-line">BST: ${baseStatTotal}${usage}</span>`;
          }
          const value = details.stats.find(entry => entry.name === stat)?.value;
          return `<span>${statLabels[stat]}: ${value ?? "\u2014"}</span>`;
        });
        card.style.setProperty("--extra-stat-lines", statLines.length - 1);
        const { source: artwork, pixel: pixelArtwork, animated, fallbacks } = getPokemonArtwork(details.sprites, preferences);
        link.innerHTML = `<span class="card-stat">${statLines.join("")}</span>${artwork ? `<img class="${pixelArtwork ? 'pixel-artwork' : 'official-artwork'}" data-artwork-source="${artwork}" data-animated="${animated}" alt="${pokemon.name}" decoding="async" />` : '<div class="artwork-placeholder">No artwork</div>'}
          <p><span class="pokemon-name">${reverseTransformName(details.name)}</span><span class="pokemon-id">#${details.id}</span></p>
          <div class="card-types">${details.types.map(({type}) => `<span class="type-badge type-${type.name}">${type.name}</span>`).join("")}</div>`;
        const artworkImage = link.querySelector('img');
        if (artworkImage) {
          artworkImage.dataset.artworkFallbacks = JSON.stringify(fallbacks);
          artworkImage.dataset.modern = String(preferences.artwork === 'champions');
          installCardArtworkFallback(artworkImage);
        }
      } catch {
        link.textContent = `${reverseTransformName(pokemon.name)} — details unavailable`;
      }
      card.append(link);
      addFavoriteButton(card, Number(pokemon.url.split("/").filter(Boolean).pop()), pokemon.name);
      cards[index] = card;
    }, isCurrent);
    if (request !== pageRequest) return;
    releaseCardArtwork();
    grid.replaceChildren(...cards);
    deferOffscreenCards(cards);
    observeCardArtwork();
    refreshCardArtwork(window.CompDexSettings.get());
    currentPage = page;
    totalPages = Math.max(1, Math.ceil(data.count / pageSize));
    totalResults = data.count;
    syncFilterUrl(currentPage);
    resultsPending = false;
    updateFavoritesNotice();
    status.textContent = data.count
      ? `Showing ${offset + 1}–${offset + data.results.length} of ${data.count} Pokémon`
      : "No matching Pokémon found.";
    if (evolutionSearchFailed) status.textContent += " Some evolution matches could not load; try again.";
  } catch {
    if (request === pageRequest) status.textContent = "Could not load this page. Check your connection and enter a page number to retry.";
  } finally {
    if (request === pageRequest) {
      loadingPage = false;
      updatePageControls();
    }
  }
}

previousButton.addEventListener("click", () => loadPage(currentPage - 1));
nextButton.addEventListener("click", () => loadPage(currentPage + 1));
topPreviousButton.addEventListener("click", () => loadPage(currentPage - 1));
topNextButton.addEventListener("click", () => loadPage(currentPage + 1));
document.getElementById("top-page-form").addEventListener("submit", event => {
  event.preventDefault();
  loadPage(Number(topPageInput.value));
});
topPageInput.addEventListener("change", () => {
  if (topPageInput.value.trim()) loadPage(Number(topPageInput.value));
  else topPageInput.value = currentPage;
});
document.getElementById("page-form").addEventListener("submit", (event) => {
  event.preventDefault();
  loadPage(Number(pageInput.value));
});
pageInput.addEventListener("change", () => {
  if (pageInput.value.trim()) loadPage(Number(pageInput.value));
  else pageInput.value = currentPage;
});
function filterHomepage() {
  syncFilterUrl(1);
  clearTimeout(filterTimer);
  filteredResults = null;
  resultsPending = true;
  // Invalidate older results immediately so they cannot overwrite this search.
  ++pageRequest;
  loadingPage = true;
  updatePageControls();
  filterTimer = setTimeout(() => {
    gridQuery = nameFilter.value.toLowerCase().trim();
    loadPage(1, true);
  }, 200);
}
nameFilter.addEventListener("input", filterHomepage);
typeFilter.addEventListener("change", filterHomepage);
secondTypeFilter.addEventListener("change", filterHomepage);
sortFilter.addEventListener("change", () => {
  if (sortFilter.value === "usage" && !regulationFilter.value) {
    regulationFilter.value = "mc";
    filterDropdowns.forEach(dropdown => dropdown.sync());
  }
  syncSortDirection(); filterHomepage();
});
sortDirectionButton.addEventListener("click", () => {
  sortDirection = sortDirection === "asc" ? "desc" : "asc";
  syncSortDirection();
  filterHomepage();
});
generationFilter.addEventListener("change", filterHomepage);
minimumSpeed.addEventListener("input", filterHomepage);
minimumValue.addEventListener("input", filterHomepage);
minimumStat.addEventListener("change", () => {
  if (minimumValue.value.trim()) filterHomepage();
  else syncFilterUrl(currentPage);
});
categoryFilter.addEventListener("change", filterHomepage);
gameFilter.addEventListener("change", filterHomepage);
regulationFilter.addEventListener("change", () => {
  lastUsageNoticeKey = "";
  if (regulationFilter.value === "mb") {
    sortFilter.value = "usage";
    sortDirection = "asc";
    syncSortDirection();
    filterDropdowns.forEach(dropdown => dropdown.sync());
  }
  filterHomepage();
});
battleFormat.addEventListener("change", () => {
  if (regulationFilter.value || sortFilter.value === "usage") filterHomepage();
  else syncFilterUrl(currentPage);
});
favoritesFilter.addEventListener("click", () => {
  if (favoriteIds.size === 0) {
    favoritesOnly = false;
    showEmptyFavoritesNotice = true;
    favoritesNotice.classList.remove("empty-notice");
    void favoritesNotice.offsetWidth;
    updateFavoritesNotice();
    return;
  }
  favoritesOnly = !favoritesOnly;
  showEmptyFavoritesNotice = false;
  updateFavoritesNotice();
  if (favoriteIds.size === 0) return;
  filterHomepage();
});
function resetHomepageFilters() {
  const settings = window.CompDexSettings.get();
  const selectedGroups = [...multiFilterSelections.values()].some(selected => selected.size);
  const resultsAffected = nameFilter.value.trim() || typeFilter.value || secondTypeFilter.value
    || sortFilter.value !== settings.defaultSort || sortDirection !== settings.sortDirection
    || regulationFilter.value || minimumSpeed.value.trim() || minimumValue.value.trim()
    || favoritesOnly || selectedGroups;
  const hasFilters = resultsAffected || battleFormat.value !== "doubles" || minimumStat.value !== "total";
  if (!hasFilters) return;
  multiFilterSelections.forEach(selected => selected.clear());
  categoryFilter.value = "";
  gameFilter.value = "";
  minimumSpeed.value = "";
  minimumValue.value = "";
  minimumStat.value = "total";
  regulationFilter.value = "";
  battleFormat.value = "doubles";
  nameFilter.value = "";
  typeFilter.value = "";
  secondTypeFilter.value = "";
  sortFilter.value = window.CompDexSettings.get().defaultSort;
  sortDirection = window.CompDexSettings.get().sortDirection;
  syncSortDirection();
  generationFilter.value = "";
  favoritesOnly = false;
  showEmptyFavoritesNotice = false;
  updateFavoritesNotice();
  filterDropdowns.forEach(dropdown => { dropdown.sync(); dropdown.close(); });
  if (resultsAffected) filterHomepage();
  else syncFilterUrl(currentPage);
}
document.getElementById("reset-filters").addEventListener("click", resetHomepageFilters);
window.addEventListener("compdex:reset-filters", resetHomepageFilters);
window.addEventListener("compdex:settings-changed", event => {
  const { previous, settings } = event.detail;
  if (previous.defaultSort !== settings.defaultSort) {
    sortFilter.value = settings.defaultSort;
    syncSortDirection();
    filterDropdowns.forEach(dropdown => dropdown.sync());
  }
  if (previous.sortDirection !== settings.sortDirection) { sortDirection = settings.sortDirection; syncSortDirection(); }
  const relatedChanged = previous.includeEvolutions !== settings.includeEvolutions;
  const relatedQuery = nameFilter.value.toLowerCase().trim();
  const relatedCanChangeResults = pokemonNumber(relatedQuery) !== null || relatedQuery.length >= 3;
  const resultsChanged = ["defaultSort", "sortDirection", "includeAltForms"].some(key => previous[key] !== settings[key])
    || (relatedChanged && relatedCanChangeResults);
  if (resultsChanged) filterHomepage();
  else {
    if (relatedChanged) syncFilterUrl(currentPage);
    if (previous.pageSize !== settings.pageSize) {
    // Keep the matched list, but restart pagination with the new count.
      clearTimeout(filterTimer);
      loadPage(1, true);
    }
    else if (previous.artwork !== settings.artwork || previous.shiny !== settings.shiny) {
      refreshCardArtwork(settings, true);
    }
  }
});
loadPage(initialFilterPage);
