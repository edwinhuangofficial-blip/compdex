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
    const requestedForm=new URLSearchParams(location.search).get('form');
    const current=pokemon.formResource?pokemon.name===requestedForm:!requestedForm&&pokemon.id===currentId;
    const href=`pokemoninfo.html?pokemon=${encodeURIComponent(pokemon.basePokemonName||pokemon.name)}${pokemon.formResource?'&form='+encodeURIComponent(pokemon.name):''}`;
    wrapper.innerHTML = `<a class="evolution-card${current ? ' current' : ''}" href="${href}"${current ? ' aria-current="page"' : ''}><strong>${escape(name)}</strong><span class="evolution-number">#${pokemon.id}</span><img alt="${escape(name)}" decoding="async"><div class="evolution-types">${pokemon.types.map(entry => `<span class="type-badge type-${escape(entry.type.name)}">${escape(entry.type.name)}</span>`).join('')}</div></a><div class="evolution-requirement">${escape(text)}</div>`;
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
  async function limited(items,fn){
    const result=new Array(items.length);let next=0;
    await Promise.all(Array.from({length:Math.min(4,items.length)},async()=>{
      while(next<items.length){const index=next++;result[index]=await fn(items[index]);}
    }));return result;
  }
  function releaseWithin(host){
    cards.filter(entry=>host.contains(entry.image)).forEach(releaseCardImage);
    cards=cards.filter(entry=>!host.contains(entry.image));
  }
  function renderRoute(paths,currentId){
    if(paths.length!==1)return renderEvolutionPaths(paths,currentId);
    const chain=document.createElement('div');chain.className='evolution-chain';
    paths[0].forEach((step,index)=>{
      const stage=document.createElement('div');stage.className='evolution-stage';
      const branch=document.createElement('div');branch.className='evolution-branch';
      if(index){
        const connector=document.createElement('div');connector.className='evolution-connector';
        connector.innerHTML=`<strong>${escape(step.text)}</strong><span aria-hidden="true">→</span>`;
        branch.append(connector);
      }
      branch.append(card(step.pokemon,'',currentId));stage.append(branch);chain.append(stage);
    });return chain;
  }
  function formDropdown(select){
    const wrapper=document.createElement('div');wrapper.className='evolution-dropdown';
    select.hidden=true;
    const trigger=document.createElement('button');trigger.type='button';trigger.className='evolution-dropdown-trigger';trigger.id=select.id+'-trigger';
    trigger.setAttribute('aria-label',select.getAttribute('aria-label'));trigger.setAttribute('aria-haspopup','menu');
    const menu=document.createElement('div');menu.className='evolution-dropdown-menu';menu.id=select.id+'-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label',select.getAttribute('aria-label'));
    trigger.setAttribute('aria-controls',menu.id);
    function open(value){
      wrapper.classList.toggle('open',value);trigger.setAttribute('aria-expanded',String(value));menu.inert=!value;
      if(value){
        menu.style.removeProperty('margin-left');
        const rect=menu.getBoundingClientRect();
        menu.style.marginLeft=`${Math.max(8-rect.left,Math.min(0,innerWidth-8-rect.right))}px`;
        menu.style.maxHeight=`${Math.max(80,innerHeight-trigger.getBoundingClientRect().bottom-20)}px`;
      }
    }
    function sync(){
      trigger.textContent=select.selectedOptions[0].textContent;
      menu.querySelectorAll('button').forEach(button=>button.setAttribute('aria-checked',String(button.dataset.value===select.value)));
    }
    for(const option of select.options){
      const button=document.createElement('button');button.type='button';button.textContent=option.textContent;button.dataset.value=option.value;button.setAttribute('role','menuitemradio');
      button.addEventListener('click',()=>{select.value=option.value;sync();open(false);trigger.focus();select.dispatchEvent(new Event('change'));});
      menu.append(button);
    }
    trigger.addEventListener('click',()=>open(!wrapper.classList.contains('open')));
    wrapper.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();open(false);trigger.focus();}
      if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
        event.preventDefault();open(true);
        const buttons=[...menu.children],index=buttons.indexOf(document.activeElement);
        const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;
        buttons[next].focus();
      }
    });
    wrapper.addEventListener('focusout',event=>{if(!wrapper.contains(event.relatedTarget))open(false);});
    select.addEventListener('change',sync);
    wrapper.append(select,trigger,menu);sync();open(false);return wrapper;
  }
  document.addEventListener('pointerdown',event=>{
    document.querySelectorAll('.evolution-dropdown.open').forEach(wrapper=>{
      if(wrapper.contains(event.target))return;
      wrapper.classList.remove('open');wrapper.querySelector('button').setAttribute('aria-expanded','false');wrapper.querySelector('[role="menu"]').inert=true;
    });
  });
  function renderAlternates(host,entries,current){
    host.hidden=!entries.length;if(!entries.length)return;
    const Forms=window.CompDexForms;
    const heading=document.createElement('h3');heading.className='evolution-mega-heading';
    const label=document.createElement('span');
    const select=document.createElement('select');select.id='forms-category';select.className='evolution-select';select.setAttribute('aria-label','Alternate form category');
    Object.entries(Forms.categories).forEach(([value,name])=>{if(entries.some(entry=>entry.category===value))select.add(new Option(name,value));});
    select.value=entries.find(entry=>entry.pokemon.name===current.name)?.category||select.options[0].value;
    if(select.options.length===1&&select.value==='mega'){
      select.hidden=true;
      label.append(document.createTextNode('Mega Evolution'),select);
    }else label.append(formDropdown(select));
    const symbol=document.createElement('span');symbol.className='evolution-mega-symbol';
    heading.append(label,symbol);
    const grid=document.createElement('div');grid.className='evolution-megas';grid.id='alternate-form-cards';
    host.append(heading,grid);
    function render(){
      releaseWithin(grid);grid.replaceChildren();symbol.replaceChildren();
      const selected=entries.filter(entry=>entry.category===select.value);
      host.dataset.category=select.value;
      const icons=Forms.icons(select.value,selected);
      symbol.classList.toggle('continuous',!icons.length);
      icons.forEach(icon=>{const image=document.createElement('img');image.src=icon.src;image.alt=icon.alt;symbol.append(image);});
      const species=[...new Set(selected.map(entry=>entry.species))];
      for(const name of species){
        const group=document.createElement('div');group.className='evolution-mega-group';
        selected.filter(entry=>entry.species===name).forEach((entry,index)=>{
          if(index){const arrow=document.createElement('span');arrow.className='evolution-mega-arrow';arrow.textContent='↔';arrow.setAttribute('aria-label','Alternative forms');group.append(arrow);}
          const item=card(entry.pokemon,Forms.requirement(entry.pokemon,entry.metadata),current.id);
          item.querySelector('.evolution-requirement').title='Requirements and form availability depend on the game.';
          group.append(item);
        });grid.append(group);
      }
      updateArtwork();
    }
    select.addEventListener('change',render);render();
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
      const Forms=window.CompDexForms;
      const [selectedSpecies,metadata]=await Promise.all([get(pokemon.species.url),Forms.load()]);
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
        const varieties=await limited(species.varieties.filter(v=>!v.is_default),async v=>v.pokemon.name===pokemon.name&&!pokemon.formResource?pokemon:get(v.pokemon.url));
        const variants=varieties.filter(p=>Forms.gameplay(p,normalData,metadata.forms[p.name]));
        if(['arceus','silvally','genesect'].includes(species.name)){
          const formData=await limited(normalData.forms||[],form=>get(form.url));
          for(const form of formData)if(form.types?.length&&(form.types[0].type.name!==normalData.types[0].type.name||species.name==='genesect'&&!form.is_default))variants.push(Forms.fromForm(normalData,form));
        }
        return {...entry, species, normal:normalData, variants};
      }));
      const paths = await evolutionPaths(family);
      for(const entry of family)for(const variant of entry.variants){
        const data=metadata.forms[variant.name];
        if(Forms.region(variant.name)!=='main'&&!data?.battleOnly&&!/-mega(?:-|$)|-gmax$|-primal$/.test(variant.name)&&!paths.some(path=>path.some(step=>step.pokemon.id===variant.id)))paths.push([{pokemon:variant,text:''}]);
      }
      if (version !== loadVersion) return;
      panel.replaceChildren();
      const regionKeys=[...new Set(paths.map(path=>path.map(step=>Forms.region(step.pokemon.name)).find(r=>r!=='main')||'main'))].sort((a,b)=>a==='main'?-1:b==='main'?1:a.localeCompare(b));
      const regionSelect=document.createElement('select');
      regionSelect.id='evolution-region';regionSelect.className='evolution-select';regionSelect.setAttribute('aria-label','Evolution path');
      regionKeys.forEach(key=>regionSelect.add(new Option(Forms.labels[key],key)));
      const selectedPath=paths.find(path=>path.some(step=>step.pokemon.id===pokemon.id));
      const selectedRegion=selectedPath?.map(step=>Forms.region(step.pokemon.name)).find(r=>r!=='main')||Forms.region(pokemon.name);
      regionSelect.value=regionKeys.includes(selectedRegion)?selectedRegion:regionKeys[0];
      if(regionKeys.length>1){const chooser=formDropdown(regionSelect);chooser.classList.add('evolution-region-dropdown');panel.append(chooser);}
      const route=document.createElement('div');route.id='evolution-route';panel.append(route);
      const alternate=document.createElement('section');alternate.className='alternate-forms';alternate.setAttribute('aria-label','Alternate forms');panel.append(alternate);
      function render(){
        releaseWithin(route);releaseWithin(alternate);
        route.replaceChildren();alternate.replaceChildren();
        const activePaths=paths.filter(path=>(path.map(step=>Forms.region(step.pokemon.name)).find(r=>r!=='main')||'main')===regionSelect.value);
        route.append(chain.species.name==='eevee'?renderEevee(activePaths,pokemon.id):renderRoute(activePaths,pokemon.id));
        const activePokemon=activePaths.flatMap(path=>path.map(step=>step.pokemon));
        const available=[];
        for(const entry of family){
          const bases=activePokemon.filter(p=>p.species.name===entry.species.name);
          if(!bases.length)continue;
          for(const variant of entry.variants){
            const details=metadata.forms[variant.name]||{};
            if(activePokemon.some(p=>p.name===variant.name))continue;
            const expectedRegion=Forms.region(details.from?.toLowerCase()||variant.name);
            if(!bases.some(base=>Forms.region(base.name)===expectedRegion))continue;
            // Regional base forms belong to the upper path selector, not this section.
            if(Forms.region(variant.name)!=='main'&&!details.battleOnly&&!/-mega(?:-|$)|-gmax$|-primal$/.test(variant.name))continue;
            available.push({pokemon:variant,metadata:details,species:entry.species.name,category:Forms.category(variant,details)});
          }
        }
        renderAlternates(alternate,available,pokemon);
        updateArtwork();
      }
      regionSelect.addEventListener('change',render);render();
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
