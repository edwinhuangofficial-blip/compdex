(() => {
  const cache = new Map();
  let cards = [];
  let loadVersion = 0;
  const pretty = value => String(value || '').replace(/-/g, ' ');
  const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  async function get(url) {
    if (!cache.has(url)) {
      const request = fetch(url).then(response => {
        if (!response.ok) throw new Error('Evolution data unavailable');
        return response.json();
      }).catch(error => { cache.delete(url); throw error; });
      cache.set(url, request);
    }
    return cache.get(url);
  }
  function requirement(detail) {
    const parts = [];
    const trigger = detail.trigger?.name;
    if (detail.min_level != null) parts.push(`Level ${detail.min_level}`);
    else if (trigger === 'level-up') parts.push('Level up');
    else if (trigger === 'trade') parts.push('Trade');
    else if (trigger && trigger !== 'use-item') parts.push(pretty(trigger));
    if (detail.item) parts.push(pretty(detail.item.name));
    if (detail.held_item) parts.push(`holding ${pretty(detail.held_item.name)}`);
    if (detail.min_happiness != null) parts.push(`friendship ≥ ${detail.min_happiness}`);
    if (detail.min_beauty != null) parts.push(`beauty ≥ ${detail.min_beauty}`);
    if (detail.min_affection != null) parts.push(`affection ≥ ${detail.min_affection}`);
    if (detail.time_of_day) parts.push(pretty(detail.time_of_day));
    if (detail.gender != null) parts.push(detail.gender === 1 ? 'female' : 'male');
    if (detail.known_move) parts.push(`knowing ${pretty(detail.known_move.name)}`);
    if (detail.known_move_type) parts.push(`knowing a ${pretty(detail.known_move_type.name)} move`);
    if (detail.location) parts.push(`at ${pretty(detail.location.name)}`);
    if (detail.trade_species) parts.push(`for ${pretty(detail.trade_species.name)}`);
    if (detail.party_species) parts.push(`with ${pretty(detail.party_species.name)} in party`);
    if (detail.party_type) parts.push(`with a ${pretty(detail.party_type.name)} type in party`);
    if (detail.relative_physical_stats != null) parts.push(['Attack < Defense','Attack = Defense','Attack > Defense'][detail.relative_physical_stats + 1]);
    if (detail.needs_overworld_rain) parts.push('rain');
    if (detail.needs_multiplayer) parts.push('multiplayer');
    if (detail.turn_upside_down) parts.push('turn device upside down');
    if (detail.region) parts.push(`in ${pretty(detail.region.name)}`);
    if (detail.required_pokemon_form) parts.push(`from ${pretty(detail.required_pokemon_form.name)}`);
    if (detail.used_move) parts.push(`use ${pretty(detail.used_move.name)}${detail.min_move_count ? ` ${detail.min_move_count} times` : ''}`);
    if (detail.min_steps) parts.push(`${detail.min_steps} steps`);
    if (detail.min_damage_taken) parts.push(`take ${detail.min_damage_taken} damage`);
    if (detail.allowed_natures?.length) parts.push(detail.allowed_natures.map(n => pretty(n.name)).join(' / ') + ' nature');
    if (detail.condition_expression) parts.push('additional game-specific condition');
    return parts.join(' · ') || 'Special evolution condition';
  }
  function requirements(details) {
    return [...new Set((details || []).map(requirement))].join(' OR ');
  }
  const megaDataUrl = 'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/pokedex.ts';
  let megaRequirementsRequest;
  // Match API and Showdown form names despite punctuation or gender-token order.
  const formKey = name => String(name).toLowerCase().replace(/\bfemale\b/g, 'f').replace(/\bmale\b/g, 'm')
    .split(/[^a-z0-9]+/).filter(Boolean).sort().join('-');
  function parseMegaRequirements(source) {
    const result = new Map();
    // Read quoted metadata only. Never execute the downloaded TypeScript.
    for (const [, block] of source.matchAll(/^\t[a-z0-9]+: \{([\s\S]*?)^\t\},/gm)) {
      const field = key => block.match(new RegExp(`^\\t\\t${key}: "([^"\\n]+)"`, 'm'))?.[1];
      const name = field('name');
      if (!name || !name.split('-').includes('Mega')) continue;
      const item = field('requiredItem');
      const move = field('requiredMove');
      if (item || move) result.set(formKey(name), item || `Know ${move}`);
    }
    if (!result.size) throw new Error('Mega requirement source format changed');
    return result;
  }
  function loadMegaRequirements() {
    if (!megaRequirementsRequest) {
      megaRequirementsRequest = fetch(megaDataUrl).then(response => {
        if (!response.ok) throw new Error('Mega requirements unavailable');
        return response.text();
      }).then(parseMegaRequirements).catch(error => { megaRequirementsRequest = null; throw error; });
    }
    return megaRequirementsRequest;
  }
  function fillMegaRequirements(entries, version) {
    if (!entries.length) return;
    loadMegaRequirements().then(requirements => {
      if (version !== loadVersion) return;
      for (const {name, label} of entries) {
        label.textContent = requirements.get(formKey(name)) || 'Requirement unavailable';
        label.title = 'Mega requirements: Pokémon Showdown';
      }
    }).catch(() => {
      if (version !== loadVersion) return;
      for (const {label} of entries) {
        label.replaceChildren();
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.textContent = 'Retry requirement';
        retry.addEventListener('click', () => {
          entries.forEach(entry => { entry.label.textContent = 'Loading requirement…'; });
          fillMegaRequirements(entries, version);
        });
        label.append('Requirement unavailable. ', retry);
      }
    });
  }
  function updateArtwork(preferences = window.CompDexSettings.get(), replayEntrance = false) {
    for (const {image, sprites} of cards) {
      swapPreparedArtwork(image, getPokemonArtwork(sprites, preferences), preferences, true).then(changed => {
        if (!changed || !replayEntrance || !image.isConnected) return;
        const card = image.closest('.evolution-card');
        card.style.animation = 'none';
        void card.offsetWidth;
        card.style.removeProperty('animation');
      });
    }
  }
  function releaseCardImage(entry) {
    entry.image.artworkSwapVersion = (entry.image.artworkSwapVersion || 0) + 1;
    if (entry.image.preparedObjectUrl) URL.revokeObjectURL(entry.image.preparedObjectUrl);
    entry.image.preparedObjectUrl = null;
    entry.artworkVersion = (entry.artworkVersion || 0) + 1;
    if (entry.objectUrl) URL.revokeObjectURL(entry.objectUrl);
    entry.objectUrl = null;
  }
  function card(pokemon, text, currentId) {
    const wrapper = document.createElement('div');
    wrapper.className = 'evolution-entry';
    wrapper.style.setProperty('--evolution-entrance-delay', `${Math.min(cards.length, 8) * 60}ms`);
    const name = reverseTransformName(pokemon.name);
    wrapper.innerHTML = `<a class="evolution-card${pokemon.id === currentId ? ' current' : ''}" href="pokemoninfo.html?pokemon=${encodeURIComponent(pokemon.name)}"${pokemon.id === currentId ? ' aria-current="page"' : ''}><strong>${escape(name)}</strong><span class="evolution-number">#${pokemon.id}</span><img alt="${escape(name)}" decoding="async"><div class="evolution-types">${pokemon.types.map(entry => `<span class="type-badge type-${escape(entry.type.name)}">${escape(entry.type.name)}</span>`).join('')}</div></a><div class="evolution-requirement">${escape(text)}</div>`;
    cards.push({image:wrapper.querySelector('img'), sprites:compactPokemonSprites(pokemon.sprites)});
    return wrapper;
  }
  async function evolutionForm(form, speciesEntry) {
    if (!form) return speciesEntry.normal;
    const variety = speciesEntry.species.varieties.find(entry => entry.pokemon.name === form.name);
    const resource = variety?.pokemon || (await get(form.url)).pokemon;
    return resource.name === speciesEntry.normal.name ? speciesEntry.normal : get(resource.url);
  }
  async function evolutionPaths(family) {
    const edges = (await Promise.all(family.filter(entry => entry.parent).map(async entry => {
      const parent = family.find(candidate => candidate.node.species.name === entry.parent);
      const groups = new Map();
      for (const detail of entry.node.evolution_details || []) {
        const key = `${detail.required_pokemon_form?.name || parent.normal.name}|${detail.evolved_pokemon_form?.name || entry.normal.name}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(detail);
      }
      if (!groups.size) groups.set('default', []);
      return Promise.all([...groups.values()].map(async details => {
        const [from, to] = await Promise.all([
          evolutionForm(details[0]?.required_pokemon_form, parent),
          evolutionForm(details[0]?.evolved_pokemon_form, entry)
        ]);
        // The source card already identifies the required form.
        const text = requirements(details.map(detail => ({...detail, required_pokemon_form:null}))) || 'Special evolution condition';
        return {from, to, text};
      }));
    }))).flat();
    const paths = [];
    const extend = (pokemon, path) => {
      const next = edges.filter(edge => edge.from.id === pokemon.id);
      if (!next.length) { paths.push(path); return; }
      for (const edge of next) extend(edge.to, [...path, {pokemon:edge.to, text:edge.text}]);
    };
    const roots = new Map();
    for (const entry of family.filter(entry => !entry.parent)) {
      const outgoing = edges.filter(edge => edge.from.species.name === entry.node.species.name);
      if (!outgoing.length) roots.set(entry.normal.id, entry.normal);
      outgoing.forEach(edge => roots.set(edge.from.id, edge.from));
    }
    roots.forEach(pokemon => extend(pokemon, [{pokemon, text:''}]));
    return paths;
  }
  function renderEvolutionPaths(paths, currentId) {
    const roots = new Map();
    // Merge shared prefixes by exact Pokémon ID, keeping distinct forms separate.
    paths.forEach(path => {
      let children = roots;
      path.forEach(step => {
        if (!children.has(step.pokemon.id)) children.set(step.pokemon.id, {...step, children:new Map()});
        children = children.get(step.pokemon.id).children;
      });
    });
    const render = entry => {
      const node = document.createElement('div');
      node.className = 'evolution-tree-node';
      node.append(card(entry.pokemon, '', currentId));
      if (entry.children.size) {
        const children = document.createElement('div');
        children.className = 'evolution-tree-children';
        children.classList.toggle('evolution-tree-fork', entry.children.size > 1);
        entry.children.forEach(child => {
          const branch = document.createElement('div');
          branch.className = 'evolution-tree-branch';
          const connector = document.createElement('div');
          connector.className = 'evolution-route-connector';
          connector.innerHTML = `<strong><span class="evolution-source-label">From ${escape(reverseTransformName(entry.pokemon.name))}: </span>${escape(child.text)}</strong><span aria-hidden="true">→</span>`;
          branch.append(connector, render(child));
          children.append(branch);
        });
        node.append(children);
      }
      return node;
    };
    const tree = document.createElement('div');
    tree.className = 'evolution-tree';
    tree.classList.toggle('evolution-tree-deep', paths.some(path => path.length > 2));
    roots.forEach(entry => tree.append(render(entry)));
    return tree;
  }
  function renderEevee(paths, currentId) {
    const options = paths.map(path => path[path.length - 1]);
    const layout = document.createElement('div');
    layout.className = 'eevee-evolution';
    const base = card(paths[0][0].pokemon, '', currentId);
    base.classList.add('eevee-base');
    const chooser = document.createElement('div');
    chooser.className = 'eevee-chooser';
    const summary = document.createElement('button');
    summary.type = 'button';
    summary.className = 'eevee-trigger';
    function setOpen(open) {
      chooser.classList.toggle('open', open);
      summary.setAttribute('aria-expanded', String(open));
      menu.inert = !open;
    }
    summary.addEventListener('click', () => setOpen(!chooser.classList.contains('open')));
    summary.setAttribute('aria-label', 'Choose Eevee evolution');
    const menu = document.createElement('div');
    menu.className = 'eevee-options';
    menu.setAttribute('role', 'group');
    menu.setAttribute('aria-label', 'Eevee evolutions');
    const label = pokemon => `<span class="eevee-option-name">${escape(reverseTransformName(pokemon.name))}</span>${pokemon.types.map(entry => `<span class="type-badge type-${escape(entry.type.name)}">${escape(entry.type.name)}</span>`).join('')}`;
    const condition = document.createElement('div');
    condition.className = 'eevee-condition evolution-route-connector';
    condition.innerHTML = '<div class="eevee-condition-text" aria-live="polite"><strong class="eevee-condition-before"></strong><strong class="eevee-condition-after"></strong></div><span aria-hidden="true">→</span>';
    const target = document.createElement('div');
    target.className = 'eevee-target';
    const buttons = [];
    function select(option, refresh = true) {
      for (const entry of cards.filter(entry => target.contains(entry.image))) releaseCardImage(entry);
      cards = cards.filter(entry => !target.contains(entry.image));
      target.replaceChildren(card(option.pokemon, '', currentId));
      summary.innerHTML = label(option.pokemon) + '<span class="eevee-chevron" aria-hidden="true">⌄</span>';
      const alternatives = option.text.split(' OR ');
      let before = option.text, after = '';
      if (alternatives.length > 1) {
        const middle = Math.ceil(alternatives.length / 2);
        before = alternatives.slice(0, middle).join(' OR ');
        after = 'OR ' + alternatives.slice(middle).join(' OR ');
      } else if (option.text.length > 55) {
        const words = option.text.split(' ');
        const middle = Math.ceil(words.length / 2);
        before = words.slice(0, middle).join(' ');
        after = words.slice(middle).join(' ');
      }
      // Recreate both labels so the requirement refreshes and enters with the selected card.
      const beforeLabel = document.createElement('strong');
      beforeLabel.className = 'eevee-condition-before';
      beforeLabel.textContent = before;
      const afterLabel = document.createElement('strong');
      afterLabel.className = 'eevee-condition-after';
      afterLabel.textContent = after;
      condition.querySelector('.eevee-condition-text').replaceChildren(beforeLabel, afterLabel);
      buttons.forEach(({button, pokemon}) => button.setAttribute('aria-pressed', String(pokemon.id === option.pokemon.id)));
      setOpen(false);
      if (refresh) updateArtwork();
    }
    options.forEach(option => {
      const button = document.createElement('button');
      button.type = 'button';
      button.innerHTML = label(option.pokemon);
      button.setAttribute('aria-label', `${reverseTransformName(option.pokemon.name)}, ${option.pokemon.types.map(entry => entry.type.name).join(' / ')} type`);
      button.addEventListener('click', () => { select(option); summary.focus(); });
      buttons.push({button, pokemon:option.pokemon});
      menu.append(button);
    });
    chooser.append(summary, menu);
    chooser.addEventListener('keydown', event => {
      if (event.key === 'Escape') { setOpen(false); summary.focus(); }
      if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault();
        setOpen(true);
        const index = buttons.findIndex(entry => entry.button === document.activeElement);
        const next = index < 0 ? (event.key === 'ArrowDown' ? 0 : buttons.length - 1)
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next].button.focus();
      }
    });
    chooser.addEventListener('focusout', event => {
      if (!chooser.contains(event.relatedTarget)) setOpen(false);
    });
    layout.append(base, chooser, condition, target);
    select(options.find(option => option.pokemon.id === currentId)
      || options.find(option => option.pokemon.name === 'sylveon') || options[0], false);
    return layout;
  }
  async function load(pokemon) {
    const panel = document.getElementById('evolution-content');
    if (!panel) return;
    const version = ++loadVersion;
    cards.forEach(releaseCardImage);
    cards = [];
    panel.textContent = 'Loading evolution line…';
    panel.setAttribute('aria-busy', 'true');
    try {
      const selectedSpecies = await get(pokemon.species.url);
      const chain = selectedSpecies.evolution_chain ? (await get(selectedSpecies.evolution_chain.url)).chain : {species:pokemon.species,evolves_to:[]};
      const nodes = [];
      const walk = (node, depth = 0, parent = null) => {
        nodes.push({node,depth,parent});
        (node.evolves_to || []).forEach(child => walk(child,depth + 1,node.species.name));
      };
      walk(chain);
      const family = await Promise.all(nodes.map(async entry => {
        const species = entry.node.species.url === pokemon.species.url ? selectedSpecies : await get(entry.node.species.url);
        const normal = species.varieties.find(v => v.is_default) || species.varieties[0];
        const normalData = normal.pokemon.name === pokemon.name ? pokemon : await get(normal.pokemon.url);
        const megas = await Promise.all(species.varieties.filter(v => /-mega(?:-|$)/.test(v.pokemon.name)).map(v => v.pokemon.name === pokemon.name ? pokemon : get(v.pokemon.url)));
        return {...entry, species, normal:normalData, megas};
      }));
      const paths = await evolutionPaths(family);
      if (version !== loadVersion) return;
      panel.replaceChildren();
      const chainGrid = document.createElement('div');
      chainGrid.className = 'evolution-chain';
      const stages = new Map();
      family.forEach(entry => {
        if (!stages.has(entry.depth)) stages.set(entry.depth, []);
        stages.get(entry.depth).push(entry);
      });
      const eevee = chain.species.name === 'eevee';
      const branched = paths.length > 1 || paths.some(path => path.some(step =>
        !family.some(entry => entry.normal.id === step.pokemon.id)));
      if (!branched && !eevee) for (const [depth, entries] of stages) {
        const stage = document.createElement('div');
        stage.className = 'evolution-stage';
        entries.forEach(entry => {
          const branch = document.createElement('div');
          branch.className = 'evolution-branch';
          if (entry.parent) {
            const connector = document.createElement('div');
            connector.className = 'evolution-connector';
            const parentLabel = stages.get(depth - 1).length > 1 ? `From ${pretty(entry.parent)}: ` : '';
            connector.innerHTML = `<strong>${escape(parentLabel + requirements(entry.node.evolution_details))}</strong><span aria-hidden="true">→</span>`;
            branch.append(connector);
          }
          branch.append(card(entry.normal, '', pokemon.id));
          stage.append(branch);
        });
        chainGrid.append(stage);
      }
      panel.append(eevee ? renderEevee(paths, pokemon.id) : branched ? renderEvolutionPaths(paths, pokemon.id) : chainGrid);
      const megaEntries = family.flatMap(entry => entry.megas.map(mega => ({mega,from:entry.normal.name})));
      if (megaEntries.length) {
        const requirementLabels = [];
        const heading = document.createElement('h3');
        heading.className = 'evolution-mega-heading';
        heading.innerHTML = '<span>Mega Evolution</span><span class="evolution-mega-symbol"><img src="assets/mega-evolution.png" alt="Mega Evolution symbol"></span>';
        const megaGrid = document.createElement('div');
        megaGrid.className = 'evolution-megas';
        family.filter(entry => entry.megas.length).forEach(entry => {
          const group = document.createElement('div');
          group.className = 'evolution-mega-group';
          entry.megas.forEach((mega, index) => {
            if (index) {
              const arrow = document.createElement('span');
              arrow.className = 'evolution-mega-arrow';
              arrow.textContent = '↔';
              arrow.setAttribute('aria-label', 'Alternative Mega Evolutions');
              group.append(arrow);
            }
            const megaCard = card(mega, 'Loading requirement…', pokemon.id);
            requirementLabels.push({name:mega.name, label:megaCard.querySelector('.evolution-requirement')});
            group.append(megaCard);
          });
          megaGrid.append(group);
        });
        panel.append(heading,megaGrid);
        fillMegaRequirements(requirementLabels, version);
      }
      updateArtwork();
    } catch {
      if (version !== loadVersion) return;
      panel.textContent = 'Could not load evolution line. ';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = 'Retry';
      retry.addEventListener('click', () => load(pokemon));
      panel.append(retry);
    } finally {
      if (version === loadVersion) panel.setAttribute('aria-busy','false');
    }
  }
  window.CompDexEvolution = {load,updateArtwork};
  window.addEventListener('compdex:settings-changed', event => {
    if (event.detail.previous.artwork !== event.detail.settings.artwork || event.detail.previous.shiny !== event.detail.settings.shiny) updateArtwork(event.detail.settings, true);
  });
})();
