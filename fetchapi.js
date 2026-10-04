//loads all pokemon names for searching
let allPokemonNames = [];
let highlightedIndex = -1;
async function loadAllPokemonNames() {
  const response = await fetch("https://pokeapi.co/api/v2/pokemon?limit=100000"); //fetches every single pokemon
  const data = await response.json();                                             //stores it as an array of strings
  allPokemonNames = data.results.map(t => ({displayName:reverseTransformName(t.name), api:t.name, id: Number(t.url.split("/").filter(Boolean).pop())}));
}

const pokemonNamesReady = loadAllPokemonNames().catch(() => {});

function pokemonNumber(query) {
  return /^#?\d+$/.test(query) ? Number(query.replace(/^#/, "")) : null;
}
//changes the pokemons name to the media versions eg: api shows "charizard-mega-x" -> mega charizard x
function reverseTransformName(apiName){
  let displayName = apiName.replace(/-/g, " ")
  .replace(/(\w+) (mega|alola|galar|hisui|paldea|primal|gmax)/, "$2 $1") 
  .replace("alola", "alolan")
  .replace("galar", "galarian")
  .replace("hisui", "hisuian")
  .replace("paldea", "paldean")
  return displayName;
}

const pokemonCache = {};
// Only these front-facing sprites are used by the index and info page.
function compactPokemonSprites(sprites) {
  const front = value => value && ({ front_default: value.front_default, front_shiny: value.front_shiny });
  const artworkId = (sprites.other?.['official-artwork']?.front_default || sprites.front_default || '').match(/\/(\d+)\.png$/)?.[1];
  const versionBase = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/';
  return { ...front(sprites), other: {
    'official-artwork': front(sprites.other?.['official-artwork']),
    champions: artworkId ? { front_default: `${versionBase}generation-ix/champions/${artworkId}.png`, front_shiny: `${versionBase}generation-ix/champions/shiny/${artworkId}.png` } : null,
    scarletViolet: artworkId ? { front_default: `${versionBase}generation-ix/scarlet-violet/${artworkId}.png` } : null,
    home: front(sprites.other?.home),
    animatedPixel: front(sprites.versions?.['generation-v']?.['black-white']?.animated) || (artworkId ? { front_default: `${versionBase}generation-v/black-white/animated/${artworkId}.gif`, front_shiny: `${versionBase}generation-v/black-white/animated/shiny/${artworkId}.gif` } : null),
    showdown: front(sprites.other?.showdown),
  } };
}
function getPokemonArtwork(sprites, preferences) {
  const official = sprites.other?.["official-artwork"];
  const hd = preferences.shiny ? official?.front_shiny : official?.front_default;
  const pixel = preferences.shiny ? sprites.front_shiny : sprites.front_default;
  const field = preferences.shiny ? 'front_shiny' : 'front_default';
  const choices = {
    hd,
    pixel,
    champions: sprites.other?.scarletViolet?.[field] || sprites.other?.champions?.[field],
    animatedPixel: sprites.other?.animatedPixel?.[field],
    animated: sprites.other?.showdown?.[field],
  };
  const selected = choices[preferences.artwork];
  const fallback = hd || official?.front_default || pixel || sprites.front_default;
  // API sprite objects can exist with null URLs; choose still pixels before HD
  // both when animation is absent and when its URL fails to load.
  const source = selected || (preferences.artwork === 'animatedPixel' ? pixel || sprites.front_default || fallback : fallback);
  const fallbackSources = preferences.artwork === 'champions'
    ? [sprites.other?.scarletViolet?.[field], sprites.other?.champions?.[field], sprites.other?.home?.[field], hd, official?.front_default]
    : preferences.artwork === 'animatedPixel' ? [pixel, sprites.front_default, hd, official?.front_default] : [fallback];
  const fallbacks = [...new Set(fallbackSources.filter(candidate => candidate && candidate !== source))]
    .map(candidate => ({ source: candidate, pixel: candidate === pixel || candidate === sprites.front_default }));
  return { source, fallback, fallbacks,
    animated: Boolean(selected && ['animated', 'animatedPixel'].includes(preferences.artwork)),
    pixel: Boolean(source && (source === pixel || source === sprites.front_default || (selected && preferences.artwork === 'animatedPixel'))),
    sprite: pixel || sprites.front_default };
}
function installArtworkFallbacks(image, fallbacks, trimSpace, release = () => {}) {
  image.style.removeProperty('object-view-box');
  const remaining = [...fallbacks];
  image.onerror = () => {
    const fallback = remaining.shift();
    if (!fallback) return;
    release();
    image.style.removeProperty('object-view-box');
    image.classList.toggle("pixel-artwork", fallback.pixel);
    image.src = fallback.source;
    if (trimSpace || fallback.pixel) cropPixelArtwork(fallback.source).then(cropped => {
      if (image.getAttribute("src") === fallback.source) image.src = cropped;
    });
  };
}
// Retain only common bounds, never decoded animation frames or generated GIFs.
const animatedBoundsCache = new Map();
let animationScanQueue = Promise.resolve();
function animatedArtworkBounds(source) {
  if (!globalThis.ImageDecoder || !globalThis.CSS?.supports('object-view-box', 'inset(0px)')) return Promise.resolve(null);
  if (animatedBoundsCache.has(source)) return animatedBoundsCache.get(source);
  const request = animationScanQueue.then(async () => {
    let decoder;
    try {
      const response = await fetch(source);
      if (!response.ok) return null;
      decoder = new ImageDecoder({data: await response.arrayBuffer(), type: 'image/gif', preferAnimation: true});
      await decoder.tracks.ready;
      await decoder.completed;
      const count = decoder.tracks.selectedTrack.frameCount;
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', {willReadFrequently:true});
      let left = Infinity, top = Infinity, right = -1, bottom = -1;
      for (let index = 0; index < count; index++) {
        const {image} = await decoder.decode({frameIndex:index});
        try {
          canvas.width = image.displayWidth;
          canvas.height = image.displayHeight;
          context.drawImage(image, 0, 0);
          const bounds = pixelArtworkBounds(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
          if (bounds) {
            left = Math.min(left, bounds.x); top = Math.min(top, bounds.y);
            right = Math.max(right, bounds.x + bounds.width); bottom = Math.max(bottom, bounds.y + bounds.height);
          }
        } finally { image.close(); }
      }
      if (right < 0) return null;
      // Square framing and two source pixels of breathing room, like still sprites.
      const size = Math.max(right - left, bottom - top) + 4;
      const x = Math.floor((left + right - size) / 2);
      const y = Math.floor((top + bottom - size) / 2);
      return `inset(${y}px ${canvas.width - x - size}px ${canvas.height - y - size}px ${x}px)`;
    } catch { return null; }
    finally { decoder?.close(); }
  });
  animationScanQueue = request.then(() => {});
  animatedBoundsCache.set(source, request);
  while (animatedBoundsCache.size > 100) animatedBoundsCache.delete(animatedBoundsCache.keys().next().value);
  return request;
}
async function cropAnimatedArtwork(image, source) {
  const crop = await animatedArtworkBounds(source);
  if (crop && image.getAttribute('src') === source && image.dataset.artworkSource === source) image.style.setProperty('object-view-box', crop);
}
// Generic HD framing: measure the visible artwork, without species-specific zooms.
// Cache only the crop coordinates; the browser continues displaying the source PNG.
const hdArtworkBoundsCache = new Map();
function hdArtworkBounds(source) {
  if (!source || !globalThis.CSS?.supports('object-view-box', 'inset(0px)')) return Promise.resolve(null);
  if (hdArtworkBoundsCache.has(source)) return hdArtworkBoundsCache.get(source);
  const request = new Promise(resolve => {
    const artwork = new Image();
    artwork.crossOrigin = 'anonymous';
    artwork.onerror = () => resolve(null);
    artwork.onload = () => {
      const canvas = document.createElement('canvas');
      try {
        canvas.width = artwork.naturalWidth;
        canvas.height = artwork.naturalHeight;
        const context = canvas.getContext('2d', {willReadFrequently:true});
        context.drawImage(artwork, 0, 0);
        const bounds = pixelArtworkBounds(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
        if (!bounds) { resolve(null); return; }
        const size = Math.max(bounds.width, bounds.height);
        const x = Math.floor(bounds.x + (bounds.width - size) / 2);
        const y = Math.floor(bounds.y + (bounds.height - size) / 2);
        resolve(`inset(${y}px ${canvas.width - x - size}px ${canvas.height - y - size}px ${x}px)`);
      } catch { resolve(null); }
      finally { canvas.width = canvas.height = 0; }
    };
    artwork.src = source;
  });
  hdArtworkBoundsCache.set(source, request);
  while (hdArtworkBoundsCache.size > 100) hdArtworkBoundsCache.delete(hdArtworkBoundsCache.keys().next().value);
  return request;
}
async function cropHdArtwork(image, source) {
  const crop = await hdArtworkBounds(source);
  if (crop && image.getAttribute('src') === source && image.dataset.artworkSource === source) image.style.setProperty('object-view-box', crop);
}
// Prepare framing offscreen; keep the current artwork until the replacement is ready.
async function swapPreparedArtwork(image, artwork, preferences, thumbnail = false) {
  const version = (image.artworkSwapVersion || 0) + 1;
  image.artworkSwapVersion = version;
  const candidates = [{source:artwork.source, pixel:artwork.pixel, animated:artwork.animated}, ...artwork.fallbacks];
  for (const candidate of candidates) {
    if (!candidate.source) continue;
    let source = candidate.source, crop = null, objectUrl = null;
    try {
      if (candidate.animated) crop = await animatedArtworkBounds(source);
      else if (candidate.pixel || preferences.artwork === 'champions') source = await cropPixelArtwork(source);
      else if (preferences.artwork === 'hd') {
        if (thumbnail) {
          const result = await createCardThumbnail(source, true);
          if (result instanceof Blob) source = objectUrl = URL.createObjectURL(result);
        } else crop = await hdArtworkBounds(source);
      }
      const probe = new Image();
      await new Promise((resolve, reject) => {
        probe.onload = resolve;
        probe.onerror = reject;
        probe.src = source;
      });
      await probe.decode().catch(() => {});
      if (image.artworkSwapVersion !== version) {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        return;
      }
      const previousUrl = image.preparedObjectUrl;
      image.onerror = null;
      image.classList.toggle('pixel-artwork', !!candidate.pixel);
      if (crop) image.style.setProperty('object-view-box', crop);
      else image.style.removeProperty('object-view-box');
      image.src = source;
      image.dataset.artworkSource = candidate.source;
      image.hidden = false;
      image.preparedObjectUrl = objectUrl;
      if (previousUrl) URL.revokeObjectURL(previousUrl);
      return true;
    } catch {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (image.artworkSwapVersion !== version) return;
    }
  }
  if (image.artworkSwapVersion === version && !image.getAttribute('src')) image.hidden = true;
}
async function resolveModernArtwork(source, fallbacks) {
  for (const candidate of [source, ...fallbacks.map(entry => entry.source)]) {
    const available = await new Promise(resolve => {
      const probe = new Image();
      probe.onload = () => resolve(true);
      probe.onerror = () => resolve(false);
      probe.src = candidate;
    });
    if (available) return cropPixelArtwork(candidate);
  }
  return source;
}
async function createCardThumbnail(source, trimSpace = false) {
  // Decode HD artwork temporarily, then keep only a thumbnail in the card DOM.
  // 224px supports the 112px desktop image at double pixel density.
  if (!source || typeof createImageBitmap !== "function") return source;
  let bitmap;
  let canvas;
  try {
    const response = await fetch(source);
    if (!response.ok) return source;
    bitmap = await createImageBitmap(await response.blob());
    canvas = document.createElement("canvas");
    let bounds = { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
    if (trimSpace) {
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const scan = canvas.getContext("2d", { willReadFrequently: true });
      scan.drawImage(bitmap, 0, 0);
      bounds = pixelArtworkBounds(scan.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height) || bounds;
    }
    const scale = Math.min(1, 224 / Math.max(bounds.width, bounds.height));
    canvas.width = Math.max(1, Math.round(bounds.width * scale));
    canvas.height = Math.max(1, Math.round(bounds.height * scale));
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    bitmap = null;
    // Encode asynchronously and avoid retaining a base64 copy in the JS heap.
    return await new Promise(resolve => canvas.toBlob(blob => resolve(blob || source), "image/png"));
  } catch { return source; }
  finally {
    if (bitmap) bitmap.close();
    if (canvas) canvas.width = canvas.height = 0;
  }
}
// Tiny cropped sprite URLs only; no HD artwork or canvases are retained.
const croppedSpriteCache = new Map();
function cropPixelArtwork(source) {
  if (!source) return Promise.resolve(source);
  if (croppedSpriteCache.has(source)) {
    const cached = croppedSpriteCache.get(source);
    croppedSpriteCache.delete(source);
    croppedSpriteCache.set(source, cached);
    return cached;
  }
  const request = new Promise(resolve => {
    const sprite = new Image();
    sprite.crossOrigin = "anonymous";
    sprite.onerror = () => resolve(source);
    sprite.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = sprite.naturalWidth;
        canvas.height = sprite.naturalHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(sprite, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const bounds = pixelArtworkBounds(pixels, canvas.width, canvas.height);
        if (!bounds) { resolve(source); return; }
        const size = Math.max(bounds.width, bounds.height) + 4;
        canvas.width = canvas.height = size;
        context.imageSmoothingEnabled = false;
        context.drawImage(sprite, bounds.x, bounds.y, bounds.width, bounds.height,
          Math.floor((size - bounds.width) / 2), Math.floor((size - bounds.height) / 2), bounds.width, bounds.height);
        resolve(canvas.toDataURL("image/png"));
      } catch { resolve(source); }
    };
    sprite.src = source;
  });
  croppedSpriteCache.set(source, request);
  while (croppedSpriteCache.size > 100) croppedSpriteCache.delete(croppedSpriteCache.keys().next().value);
  return request;
}
function pixelArtworkBounds(pixels, width, height) {
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (pixels[(y * width + x) * 4 + 3] === 0) continue;
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  return right < left ? null : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}
const suggestionCacheOrder = new Map();
const pendingSuggestions = new Map();
function loadSuggestion(name) {
  if (pokemonCache[name]) {
    touchSuggestionCache(name);
    return Promise.resolve(pokemonCache[name]);
  }
  if (pendingSuggestions.has(name)) return pendingSuggestions.get(name);
  const request = fetch("https://pokeapi.co/api/v2/pokemon/" + name)
    .then(response => {
      if (!response.ok) throw new Error("Pokémon request failed");
      return response.json();
    }).then(data => {
      const summary = { spriteCache: data.sprites.front_default, typeCache: data.types.map(t => t.type.name) };
      pokemonCache[name] = summary;
      touchSuggestionCache(name);
      return summary;
    }).finally(() => pendingSuggestions.delete(name));
  pendingSuggestions.set(name, request);
  return request;
}
function touchSuggestionCache(name) {
  suggestionCacheOrder.delete(name);
  suggestionCacheOrder.set(name, true);
  while (suggestionCacheOrder.size > 100) {
    const oldest = suggestionCacheOrder.keys().next().value;
    suggestionCacheOrder.delete(oldest);
    delete pokemonCache[oldest];
  }
}

//function for the dropdown in the search bar
let dropdownVersion = 0;
async function updateDropdown(input) {
  const version = ++dropdownVersion;
  const dropdown = document.getElementById("search-dropdown");//grabs whats in the search bar

  if (!input.trim()){//if empty everything stops
    dropdown.classList.remove("active");
    dropdown.innerHTML = "";
    return;
  }

  dropdown.classList.add("active");

  const query = input.toLowerCase().trim(); //trims whats in the search bar
  await pokemonNamesReady;
  if (version !== dropdownVersion) return;
  const number = pokemonNumber(query);
  const includeAltForms = window.CompDexSettings.get().includeAltForms;
  const nameMatches = allPokemonNames
  .filter(function (pokemon) {
    if (!includeAltForms && pokemon.id >= 10000) return false;
    return number !== null ? String(pokemon.id).startsWith(String(number)) : pokemon.displayName.includes(query);
  })
  .sort(function (firstPokemon, secondPokemon) {
    if (number !== null) return firstPokemon.id - secondPokemon.id;
    const firstStarts = firstPokemon.displayName.startsWith(query);
    const secondStarts = secondPokemon.displayName.startsWith(query);

    if (firstStarts && !secondStarts) {
      return -1;
    }

    if (!firstStarts && secondStarts) {
      return 1;
    }

    return 0;
  })
  .slice(0, 7); 
//takes the first 20 pokemon that finishes the searched words
  if (nameMatches.length === 0) {
    dropdown.replaceChildren();
    dropdown.innerHTML = "<p style='padding: 8px 10px;'>No Pokémon found</p>";
    return;
  }
  const fragment = document.createDocumentFragment();

  for (const pokemon of nameMatches){
    const item = document.createElement("div");
    item.className = "dropdown-item";
    //item.innerHTML = `<span class="dropdown-item-name">${pokemon.displayName}</span>`;
    item.onclick = function() {
      window.location.href = "pokemoninfo.html?pokemon=" + pokemon.api;
    }
    fragment.appendChild(item); 
    if (pokemonCache[pokemon.api]) {
      touchSuggestionCache(pokemon.api);
      item.innerHTML = `
      <img src="${pokemonCache[pokemon.api].spriteCache}"/>
      <span class="dropdown-item-label"><span class="pokemon-name">${pokemon.displayName}</span> <span class="pokemon-id">#${pokemon.id}</span></span>
      ${pokemonCache[pokemon.api].typeCache.map(t => `<span class="type-dropdown type-${t}">${t}</span>`).join("")}
      `;
    }
    else {
      loadSuggestion(pokemon.api)
    .then(summary => {
      if (version !== dropdownVersion || !item.isConnected) return;
      item.innerHTML = `
      <img src="${summary.spriteCache}"/>
      <span class="dropdown-item-label"><span class="pokemon-name">${pokemon.displayName}</span> <span class="pokemon-id">#${pokemon.id}</span></span>
      ${summary.typeCache.map(t => `<span class="type-dropdown type-${t}">${t}</span>`).join("")}
      `}).catch(() => {
        if (version !== dropdownVersion || !item.isConnected) return;
        item.innerHTML = `<span class="dropdown-item-label"><span class="pokemon-name">${pokemon.displayName}</span> <span class="pokemon-id">#${pokemon.id}</span></span>`;
      });
  }
}
  dropdown.replaceChildren(fragment);
}                                       


let isSearching = false;
//searching function to find the pokemon and sends user to pokemon info page
async function pokeSearch() {

  if (isSearching){//if the function is already running then this stops a second instance
  return;
}
isSearching = true;
const pokeName = document.getElementById("searchbarid").value.toLowerCase().trim();//takes the value in the search bar

if (!pokeName) {//if empty it stops
isSearching = false;
return;
}

// Resolve numeric searches directly, even before the name list has loaded.
const number = pokemonNumber(pokeName);
if (number !== null) {
  try {
    const response = await fetch("https://pokeapi.co/api/v2/pokemon/" + number);
    if (response.status === 404 || number < 1) {
      window.location.href = "notfound.html?pokemon=" + encodeURIComponent(pokeName);
    } else {
      if (!response.ok) throw new Error("Pokémon request failed");
      const pokemon = await response.json();
      window.location.href = "pokemoninfo.html?pokemon=" + encodeURIComponent(pokemon.name);
    }
  } catch {
    alert("Check your connection and try again");
  } finally {
    isSearching = false;
  }
  return;
}

const items = document.querySelectorAll("#search-dropdown .dropdown-item");

if (items.length > 0) {
  if (highlightedIndex >= 0 && items[highlightedIndex]) {
    items[highlightedIndex].click();
  } else {
    items[0].click();
  }

  isSearching = false;
  return;
}

const match = allPokemonNames.find(p => p.displayName.includes(pokeName));//if its in the array of pokemon names then it runs true

if(!match){
  window.location.href = "notfound.html?pokemon=" + pokeName;//if doesnt work then brings it to the not found page
  isSearching = false;
  return;
}
const finalName = match.api;
//^if exact match is true then the final name is the input, if false then it searches for the first instance of the name
try {
  const response = await fetch(//fetches the pokemon info
    "https://pokeapi.co/api/v2/pokemon/" + finalName,
  );
  if (response.ok) {
    window.location.href = "pokemoninfo.html?pokemon=" + finalName;//if it is there then it brings it to the page
  }
  } 
catch (error) {
  alert("Check your connection and try again");//internet catch
  isSearching = false;
}
  isSearching = false;
}

// event listeners for search bar
//DOMContentLoaded so these functions only work once all the html is loaded
document.addEventListener("DOMContentLoaded", function() {
  window.addEventListener("compdex:settings-changed", () => {
    const input = document.getElementById("searchbarid");
    highlightedIndex = -1;
    if (input.value && document.activeElement === input) updateDropdown(input.value);
    else {
      document.getElementById("search-dropdown").replaceChildren();
      document.getElementById("search-dropdown").classList.remove("active");
    }
  });
  document.getElementById("clear-search").classList.toggle("visible", Boolean(document.getElementById("searchbarid").value));
  document //makes it so u can press enter to search not just button
    .getElementById("searchbarid")
    .addEventListener("keydown", function (e) {
      const items = document.querySelectorAll("#search-dropdown .dropdown-item");
      if (e.key === "Escape") {
        e.preventDefault();
        highlightedIndex = -1;
        items.forEach(item => item.classList.remove("highlighted"));
        document.getElementById("search-dropdown").classList.remove("active");
        this.blur();
        return;
      }
      
      if ((e.key === "Tab" && !e.shiftKey) || e.key === "ArrowDown" || e.key === "ArrowRight"){
        e.preventDefault()
        if (items.length === 0){
          return;
        }
        highlightedIndex = (highlightedIndex + 1) % items.length;
      }
      if ((e.key === "Tab" && e.shiftKey)  || e.key === "ArrowUp" || e.key === "ArrowLeft"){
        e.preventDefault()
        if (items.length === 0){
          return;
        }
          highlightedIndex = (highlightedIndex - 1 + items.length) % items.length;
      }
      if (e.key === "Enter"){
        if (pokemonNumber(this.value.trim()) !== null) {
          e.preventDefault();
          if (highlightedIndex >= 0 && items[highlightedIndex]) {
            items[highlightedIndex].click();
          } else {
            pokeSearch();
          }
          return;
        }
        if (items.length === 0){
          pokeSearch();
          return;
        }
        if (highlightedIndex >= 0 && items[highlightedIndex]){
          items[highlightedIndex].click();
        }
        else{
          items[0].click();
        }
      }
        items.forEach(i => i.classList.remove("highlighted"));
        if (items[highlightedIndex]) {
          items[highlightedIndex].classList.add("highlighted");
        }
    });

  
  document.addEventListener("keydown", function (e) {
    if (e.key === "/") {//so u can press "/" to open search bar like google
      e.preventDefault();
      document.getElementById("searchbarid").focus();
    }
  });
  //for the dropdown searching event listener input
  document.getElementById("searchbarid").addEventListener("input", function(){
    updateDropdown(document.getElementById("searchbarid").value);
    highlightedIndex = -1;
    if (this.value) {
  document.getElementById("clear-search").classList.add("visible");
} else {
  document.getElementById("clear-search").classList.remove("visible");
}
  });
  document.getElementById("clear-search").addEventListener("click", function () {
  const searchbar = document.getElementById("searchbarid");

  searchbar.value = "";
  document.getElementById("clear-search").classList.remove("visible");
  updateDropdown("");
  highlightedIndex = -1;
  searchbar.focus();
});
  //if mouse focused on search bar show dropdown
  document.getElementById("searchbarid").addEventListener("focus", function() {
    if (this.value) {
      document.getElementById("search-dropdown").classList.add("active");
    }
  });
  //if mouse not focused on searchbar then hide dropdown
  document.getElementById("searchbarid").addEventListener("blur", function() {
    setTimeout(() => {
      document.getElementById("search-dropdown").classList.remove("active");
    }, 150);

});
});

