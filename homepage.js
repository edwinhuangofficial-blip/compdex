const PAGE_SIZE = 50;
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
const generationFilter = document.getElementById("generation-filter");
sortFilter.value = window.CompDexSettings.get().defaultSort;
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
function createFilterDropdown(select, isType = false) {
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
  select.hidden = true;
  const label = document.querySelector(`label[for="${select.id}"]`);
  if (label) label.htmlFor = trigger.id;
  const options = [...select.options];
  const buttons = options.map(option => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-option";
    button.setAttribute("role", "menuitemradio");
    button.tabIndex = -1;
    if (isType && option.value) {
      const badge = document.createElement("span");
      badge.className = `type-badge type-${option.value}`;
      badge.textContent = option.textContent;
      button.append(badge);
    } else button.textContent = option.textContent;
    button.addEventListener("click", () => {
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
    if (isType && option.value) {
      const badge = document.createElement("span");
      badge.className = `type-badge type-${option.value}`;
      badge.textContent = option.textContent;
      trigger.append(badge);
    } else trigger.textContent = select === generationFilter && option.value
      ? `Generation ${option.textContent}` : option.textContent;
    trigger.setAttribute("aria-label", `${select.getAttribute("aria-label") || "Sort by"}: ${option.textContent}`);
    buttons.forEach((button, index) => button.setAttribute("aria-checked", String(options[index].value === select.value)));
  }
  function close() {
    wrapper.classList.remove("open");
    trigger.setAttribute("aria-expanded", "false");
    menu.inert = true;
  }
  function open() {
    filterDropdowns.forEach(dropdown => dropdown.close());
    wrapper.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");
    menu.inert = false;
    buttons[Math.max(0, options.findIndex(option => option.value === select.value))].focus();
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
        sprites: { front_default: data.sprites.front_default,
          other: { "official-artwork": { front_default: data.sprites.other["official-artwork"].front_default } } },
      };
      if (/\/pokemon-species\/[^/]+\/?$/.test(url)) return { varieties: data.varieties, evolution_chain: data.evolution_chain };
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
      const data = await fetchPokemon(`https://pokeapi.co/api/v2/generation/${generation}`);
      const names = new Set();
      let index = 0;
      // Species varieties include alternate forms; use API relationships rather than guessed name prefixes.
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

async function forEachLimited(items, visit) {
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(6, items.length) }, async () => {
    while (index < items.length) await visit(items[index++]);
  }));
}

async function getEvolutionFamily(chainUrl) {
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
    })().catch(error => { evolutionFamilyCache.delete(chainUrl); throw error; });
    evolutionFamilyCache.set(chainUrl, request);
  }
  return evolutionFamilyCache.get(chainUrl);
}

async function getSearchEvolutionNames(query, number, includeEvolutions) {
  // Numeric family expansion starts from the exact ID, retaining prefix matching separately.
  if (!includeEvolutions || (number === null && query.length < 3)) return { names: null, failed: false };
  const matches = allPokemonNames.filter(pokemon => number !== null
    ? pokemon.id === number : pokemon.displayName.includes(query));
  const names = new Set(matches.map(pokemon => pokemon.api));
  let failed = false;
  await forEachLimited(matches, async pokemon => {
    try {
      const details = await fetchPokemon(`https://pokeapi.co/api/v2/pokemon/${pokemon.id}`);
      const species = await fetchPokemon(details.species.url);
      if (species.evolution_chain) {
        const family = await getEvolutionFamily(species.evolution_chain.url);
        family.forEach(name => names.add(name));
      }
    } catch { failed = true; }
  });
  return { names, failed };
}

async function loadPage(page, replaceSearch = false) {
  if ((loadingPage && !replaceSearch) || !Number.isFinite(page)) return;
  const request = ++pageRequest;
  const query = gridQuery;
  const selectedType = typeFilter.value;
  const selectedSecondType = secondTypeFilter.value;
  const selectedSort = sortFilter.value;
  const selectedFavoritesOnly = favoritesOnly && favoriteIds.size > 0;
  const selectedFavoriteIds = new Set(favoriteIds);
  const selectedGeneration = generationFilter.value;
  const preferences = window.CompDexSettings.get();
  page = Math.max(1, Math.min(totalPages, Math.trunc(page)));
  loadingPage = true;
  updatePageControls();
  status.textContent = `Loading page ${page}…`;
  try {
    const offset = (page - 1) * PAGE_SIZE;
    let data;
    let evolutionSearchFailed = false;
    if (!filteredResults) {
      await pokemonNamesReady;
      if (request !== pageRequest) return;
      if (!allPokemonNames.length) throw new Error("Search list unavailable");
      const number = pokemonNumber(query);
      const [typeData, secondTypeData, generationNames, evolutionSearch] = await Promise.all([
        selectedType ? fetchPokemon(`https://pokeapi.co/api/v2/type/${selectedType}`) : null,
        selectedSecondType ? fetchPokemon(`https://pokeapi.co/api/v2/type/${selectedSecondType}`) : null,
        selectedGeneration ? getGenerationPokemon(selectedGeneration) : null,
        getSearchEvolutionNames(query, number, preferences.includeEvolutions),
      ]);
      if (request !== pageRequest) return;
      const typeNames = typeData ? new Set(typeData.pokemon.map(entry => entry.pokemon.name)) : null;
      const secondTypeNames = secondTypeData ? new Set(secondTypeData.pokemon.map(entry => entry.pokemon.name)) : null;
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
          && (!generationNames || generationNames.has(pokemon.api));
      });
      matches.sort((a, b) => {
        if (selectedSort === "az") return a.displayName.localeCompare(b.displayName) || a.id - b.id;
        if (selectedSort === "za") return b.displayName.localeCompare(a.displayName) || a.id - b.id;
        return selectedSort === "id-desc" ? b.id - a.id : a.id - b.id;
      });
      filteredResults = { matches, evolutionSearchFailed };
    }
    evolutionSearchFailed = filteredResults.evolutionSearchFailed;
    data = {
        count: filteredResults.matches.length,
        results: filteredResults.matches.slice(offset, offset + PAGE_SIZE).map(pokemon => ({
          name: pokemon.api,
          url: `https://pokeapi.co/api/v2/pokemon/${pokemon.id}`,
        })),
      };
    if (request !== pageRequest) return;
    const cards = await Promise.all(data.results.map(async (pokemon, index) => {
      const card = document.createElement("article");
      card.className = "pokecard";
      card.style.animationDelay = `${(index % 5) * 25}ms`;
      const link = document.createElement("a");
      link.className = "pokecard-link";
      link.href = `pokemoninfo.html?pokemon=${encodeURIComponent(pokemon.name)}`;
      try {
        const details = await fetchPokemon(pokemon.url);
        const officialArtwork = details.sprites.other["official-artwork"].front_default;
        const artwork = preferences.artwork === "pixel" ? details.sprites.front_default || officialArtwork : officialArtwork || details.sprites.front_default;
        const pixelArtwork = artwork && artwork === details.sprites.front_default;
        const displayArtwork = pixelArtwork ? await cropPixelArtwork(artwork) : artwork;
        link.innerHTML = `${artwork ? `<img class="${pixelArtwork ? 'pixel-artwork' : 'official-artwork'}" src="${displayArtwork}" alt="${pokemon.name}" loading="lazy" />` : '<div class="artwork-placeholder">No artwork</div>'}
          <p><span class="pokemon-name">${reverseTransformName(details.name)}</span><span class="pokemon-id">#${details.id}</span></p>
          <div class="card-types">${details.types.map(({type}) => `<span class="type-badge type-${type.name}">${type.name}</span>`).join("")}</div>`;
      } catch {
        link.textContent = `${reverseTransformName(pokemon.name)} — details unavailable`;
      }
      card.append(link);
      addFavoriteButton(card, Number(pokemon.url.split("/").filter(Boolean).pop()), pokemon.name);
      return card;
    }));
    if (request !== pageRequest) return;
    grid.replaceChildren(...cards);
    currentPage = page;
    totalPages = Math.max(1, Math.ceil(data.count / PAGE_SIZE));
    totalResults = data.count;
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
sortFilter.addEventListener("change", filterHomepage);
generationFilter.addEventListener("change", filterHomepage);
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
document.getElementById("reset-filters").addEventListener("click", () => {
  nameFilter.value = "";
  typeFilter.value = "";
  secondTypeFilter.value = "";
  sortFilter.value = window.CompDexSettings.get().defaultSort;
  generationFilter.value = "";
  favoritesOnly = false;
  showEmptyFavoritesNotice = false;
  updateFavoritesNotice();
  filterDropdowns.forEach(dropdown => { dropdown.sync(); dropdown.close(); });
  filterHomepage();
});
window.addEventListener("compdex:settings-changed", event => {
  const { previous, settings } = event.detail;
  if (previous.defaultSort !== settings.defaultSort) {
    sortFilter.value = settings.defaultSort;
    filterDropdowns.forEach(dropdown => dropdown.sync());
  }
  if (["defaultSort", "artwork", "includeEvolutions", "includeAltForms"].some(key => previous[key] !== settings[key])) filterHomepage();
});
loadPage(1);
