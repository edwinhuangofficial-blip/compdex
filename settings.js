(() => {
  const storageKey = 'compdex.settings.v1';
  const defaults = Object.freeze({theme:'light',artwork:'hd',defaultArtwork:'hd',shiny:false,includeEvolutions:true,defaultRelated:true,includeAltForms:true,defaultSort:'id',sortDirection:'asc',pageSize:52,animations:'full',accent:'#66adff'});
  const artworkStyles = ['hd','pixel','home','animated'];
  function validate(value) {
    const v = value && typeof value === 'object' ? value : {};
    return {
      theme: ['light','dark','system'].includes(v.theme) ? v.theme : defaults.theme,
      artwork: v.artwork === '3ds' ? 'animated' : artworkStyles.includes(v.artwork) ? v.artwork : defaults.artwork,
      defaultArtwork: artworkStyles.includes(v.defaultArtwork) ? v.defaultArtwork : defaults.defaultArtwork,
      shiny: typeof v.shiny === 'boolean' ? v.shiny : defaults.shiny,
      includeEvolutions: typeof v.includeEvolutions === 'boolean' ? v.includeEvolutions : defaults.includeEvolutions,
      defaultRelated: typeof v.defaultRelated === 'boolean' ? v.defaultRelated : defaults.defaultRelated,
      includeAltForms: typeof v.includeAltForms === 'boolean' ? v.includeAltForms : defaults.includeAltForms,
      defaultSort: ['id','name','total','speed','attack','special-attack','defense','special-defense','hp'].includes(v.defaultSort) ? v.defaultSort : ['az','za'].includes(v.defaultSort) ? 'name' : defaults.defaultSort,
      sortDirection: ['asc','desc'].includes(v.sortDirection) ? v.sortDirection : ['za','id-desc'].includes(v.defaultSort) ? 'desc' : defaults.sortDirection,
      pageSize: Number.isInteger(v.pageSize) && v.pageSize >= 1 && v.pageSize <= 200 ? v.pageSize : defaults.pageSize,
      animations: ['full','reduced','off'].includes(v.animations) ? v.animations : defaults.animations,
      accent: /^#[0-9a-f]{6}$/i.test(v.accent) ? v.accent.toLowerCase() : defaults.accent,
    };
  }
  let preferences;
  try { preferences = validate(JSON.parse(localStorage.getItem(storageKey))); }
  catch { preferences = {...defaults}; }
  const relatedParam = new URLSearchParams(location.search).get('related');
  if (relatedParam === '0' || relatedParam === '1') preferences.includeEvolutions = relatedParam === '1';
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  let syncCardAppearance = () => {};
  function logoUrl() {
    if (preferences.accent === defaults.accent) return 'favicon.svg';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#0f172a"/><circle cx="256" cy="256" r="172" fill="#f8fafc" stroke="#020617" stroke-width="22"/><path d="M84 256a172 172 0 0 1 344 0H84Z" fill="${preferences.accent}"/><rect x="84" y="244" width="344" height="24" fill="#020617"/><circle cx="256" cy="256" r="58" fill="#f8fafc" stroke="#020617" stroke-width="18"/><circle cx="256" cy="256" r="22" fill="${preferences.accent}"/></svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }
  function applyAppearance() {
    const root = document.documentElement;
    const theme = preferences.theme === 'system' ? (systemTheme.matches ? 'dark' : 'light') : preferences.theme;
    root.dataset.theme = theme;
    root.dataset.animations = preferences.animations;
    root.style.setProperty('--accent', preferences.accent);
    const rgb = [1,3,5].map(index => parseInt(preferences.accent.slice(index,index+2),16));
    root.style.setProperty('--accent-rgb',rgb.join(' '));
    const barBase=theme==='dark'?[25,33,44]:[255,255,255];
    const barRgb=rgb.map((channel,index)=>Math.round(channel*.1+barBase[index]*.9));
    root.style.setProperty('--bar-bg',`rgb(${barRgb.join(' ')})`);
    const luminance=barRgb.map(channel=>{const value=channel/255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4;});
    root.style.setProperty('--bar-text',luminance[0]*.2126+luminance[1]*.7152+luminance[2]*.0722>.179?'#101720':'#ffffff');
    const base = theme === 'dark' ? [25,33,44] : [255,255,255];
    const subtle = preferences.accent === defaults.accent && theme === 'light' ? '#f0edff' : `rgb(${rgb.map((c,i)=>Math.round(c*.13+base[i]*.87)).join(' ')})`;
    root.style.setProperty('--accent-subtle',subtle);
    const url = logoUrl();
    document.querySelectorAll('.site-logo').forEach(image => { image.src = url; });
    const favicon = document.querySelector('link[rel="icon"]');
    if (favicon) favicon.href = url;
  }
  function publish(next) {
    const previous = preferences;
    preferences = validate(next);
    applyAppearance();
    syncCardAppearance();
    window.dispatchEvent(new CustomEvent('compdex:settings-changed',{detail:{previous,settings:{...preferences}}}));
  }
  window.CompDexSettings = { get:()=>({...preferences}), defaults:()=>({...defaults}) };
  applyAppearance();
  systemTheme.addEventListener('change',applyAppearance);
  window.addEventListener('storage',event=>{
    if (event.key !== storageKey && event.key !== null) return;
    try { publish(event.newValue ? JSON.parse(event.newValue) : defaults); } catch {}
  });
  document.addEventListener('DOMContentLoaded',()=>{
    applyAppearance();
    const artworkControl=document.getElementById('index-artwork');
    const shinyControl=document.getElementById('index-shiny');
    const relatedControl=document.getElementById('index-related');
    if (artworkControl && shinyControl && relatedControl) {
      syncCardAppearance=()=>{
        artworkControl.value=preferences.artwork;
        shinyControl.checked=preferences.shiny;
        relatedControl.checked=preferences.includeEvolutions;
      };
      const saveCardAppearance=()=>{
        const next={...preferences,artwork:artworkControl.value,shiny:shinyControl.checked};
        try { localStorage.setItem(storageKey,JSON.stringify(next)); } catch {}
        publish(next);
      };
      artworkControl.addEventListener('change',saveCardAppearance);
      shinyControl.addEventListener('change',saveCardAppearance);
      relatedControl.addEventListener('change',()=>{
        const next={...preferences,includeEvolutions:relatedControl.checked};
        try { localStorage.setItem(storageKey,JSON.stringify(next)); } catch {}
        publish(next);
      });
      syncCardAppearance();
    }
    const shareButton=document.getElementById('share-button');
    const shareUrl='https://edwinhuangofficial-blip.github.io/compdex/';
    const shareWrap=document.createElement('div');
    shareWrap.className='share-wrap';
    shareButton.before(shareWrap);
    shareWrap.append(shareButton);
    const shareNotice=document.createElement('div');
    shareNotice.className='share-notice';
    shareNotice.setAttribute('role','status');
    shareNotice.hidden=true;
    shareWrap.append(shareNotice);
    let shareTimer;
    function showShareNotice(message,manual=false) {
      clearTimeout(shareTimer);
      shareNotice.textContent=message;
      shareNotice.hidden=false;
      if(manual) {
        const input=document.createElement('input');
        input.type='text';input.readOnly=true;input.value=shareUrl;
        input.setAttribute('aria-label','Website link to copy');
        input.addEventListener('focus',()=>input.select());
        shareNotice.append(input);input.focus();input.select();
      } else shareTimer=setTimeout(()=>{shareNotice.hidden=true;},3500);
    }
    shareButton.addEventListener('click',async()=>{
      if(shareButton.disabled)return;
      shareButton.disabled=true;
      shareNotice.hidden=true;
      try {
        if(typeof navigator.share==='function') {
          try {
            await navigator.share({title:'CompDex',text:'Explore Pokémon on CompDex.',url:shareUrl});
            return;
          } catch(error) { if(error.name==='AbortError')return; }
        }
        try {
          await navigator.clipboard.writeText(shareUrl);
          showShareNotice('Website link copied!');
        } catch { showShareNotice('Copy this website link:',true); }
      } finally { shareButton.disabled=false; }
    });
    document.addEventListener('pointerdown',event=>{if(!shareWrap.contains(event.target))shareNotice.hidden=true;});
    shareWrap.addEventListener('keydown',event=>{if(event.key==='Escape'){shareNotice.hidden=true;shareButton.focus();}});
    const dialog = document.createElement('dialog');
    dialog.id='settings-dialog';
    dialog.setAttribute('aria-labelledby','settings-title');
    dialog.innerHTML=`<div class="settings-heading"><h2 id="settings-title">Settings</h2><button id="close-settings" type="button" aria-label="Close settings"><img src="assets/search-clear.png" alt="" /></button></div>
      <p class="settings-note">Saved in this browser. Press Save to apply changes, including restored defaults.</p>
      <form id="settings-form">
        <div class="settings-content">
          <div class="settings-row"><label for="setting-theme">Theme</label><select id="setting-theme"><option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option></select></div>
          <div class="settings-row"><label for="setting-default-artwork">Default rendering</label><select id="setting-default-artwork"><option value="hd">HD artwork</option><option value="pixel">Pixel art</option><option value="home">Home Model</option><option value="animated">3DS Model</option></select></div>
          <div class="settings-row"><label for="setting-color-hex">Accent color</label><div class="settings-color"><span aria-hidden="true">#</span><input id="setting-color-hex" type="text" minlength="6" maxlength="6" pattern="[0-9a-fA-F]{6}" required spellcheck="false" aria-label="Accent color hexadecimal value" /><input id="setting-color-picker" type="color" aria-label="Choose accent color" /></div></div>
          <div class="settings-row"><label for="setting-page-size">Pokémon per page</label><input id="setting-page-size" type="number" min="1" max="200" step="1" required /></div>
          <div class="settings-row"><label for="setting-default-related">Related on by default</label><input id="setting-default-related" type="checkbox" /></div>
          <div class="settings-row"><label for="setting-alt-forms">Include alternate forms</label><input id="setting-alt-forms" type="checkbox" /></div>
          <div class="settings-row"><label for="setting-sort">Default sorting</label><div class="settings-sort-controls"><select id="setting-sort"><option value="id">#</option><option value="name">Name</option><option value="total">Base Stat Total</option><option value="speed">Speed</option><option value="attack">Attack</option><option value="special-attack">Special Attack</option><option value="defense">Defense</option><option value="special-defense">Special Defense</option><option value="hp">HP</option></select><button id="setting-sort-direction" type="button" aria-label="Ascending order; switch to descending">↑</button></div></div>
          <div class="settings-row"><label for="setting-animations">Animations</label><select id="setting-animations"><option value="full">Full</option><option value="reduced">Reduced</option><option value="off">Off</option></select></div>
        </div>
        <p id="settings-status" role="status" aria-live="polite"></p>
        <div class="settings-actions"><button id="restore-settings" type="button">Restore defaults</button><button id="save-settings" type="submit">Save</button></div>
      </form>`;
    document.body.append(dialog);
    const control=id=>dialog.querySelector('#'+id);
    const form=control('settings-form');
    const status=control('settings-status');
    let draftSortDirection='asc';
    let restoringDefaults=false;
    function syncDirection() {
      control('setting-sort-direction').textContent=draftSortDirection==='asc'?'↑':'↓';
      const statSort=!['id','name'].includes(control('setting-sort').value);
      control('setting-sort-direction').setAttribute('aria-label',statSort
        ? draftSortDirection==='asc'?'Highest first; switch to lowest first':'Lowest first; switch to highest first'
        : draftSortDirection==='asc'?'Ascending order; switch to descending':'Descending order; switch to ascending');
    }
    control('setting-sort').addEventListener('change',syncDirection);
    control('setting-sort-direction').addEventListener('click',()=>{draftSortDirection=draftSortDirection==='asc'?'desc':'asc';syncDirection();});
    const dropdowns=[];
    function createSettingsDropdown(select) {
      const label=dialog.querySelector(`label[for="${select.id}"]`);
      const name=label.textContent;
      const wrapper=document.createElement('div');
      wrapper.className='settings-dropdown';
      const trigger=document.createElement('button');
      trigger.type='button';
      trigger.id=select.id+'-trigger';
      trigger.className='settings-dropdown-trigger';
      trigger.setAttribute('aria-haspopup','menu');
      trigger.setAttribute('aria-expanded','false');
      const menu=document.createElement('div');
      menu.id=select.id+'-menu';
      menu.className='settings-dropdown-menu';
      menu.setAttribute('role','menu');
      menu.setAttribute('aria-labelledby',trigger.id);
      menu.inert=true;
      trigger.setAttribute('aria-controls',menu.id);
      select.before(wrapper);
      wrapper.append(trigger,menu);
      select.hidden=true;
      label.htmlFor=trigger.id;
      const options=[...select.options];
      const buttons=options.map(option=>{
        const item=document.createElement('button');
        item.type='button';
        item.className='settings-dropdown-option';
        item.textContent=option.textContent;
        item.setAttribute('role','menuitemradio');
        item.tabIndex=-1;
        item.addEventListener('click',()=>{
          select.value=option.value;
          sync();close();trigger.focus();
          select.dispatchEvent(new Event('change',{bubbles:true}));
        });
        menu.append(item);
        return item;
      });
      function sync() {
        const shortNames={total:'BST','special-attack':'Sp Atk','special-defense':'Sp Def'};
        trigger.textContent=select.id==='setting-sort'&&shortNames[select.value]?shortNames[select.value]:select.selectedOptions[0].textContent;
        trigger.setAttribute('aria-label',name+': '+trigger.textContent);
        buttons.forEach((item,i)=>item.setAttribute('aria-checked',String(options[i].value===select.value)));
      }
      function close() {
        wrapper.classList.remove('open');
        trigger.setAttribute('aria-expanded','false');
        menu.inert=true;
      }
      function open() {
        dropdowns.forEach(dropdown=>dropdown.close());
        const roomBelow=dialog.getBoundingClientRect().bottom-wrapper.getBoundingClientRect().bottom;
        wrapper.classList.toggle('opens-up',roomBelow<menu.scrollHeight+16);
        wrapper.classList.add('open');
        trigger.setAttribute('aria-expanded','true');
        menu.inert=false;
        buttons[select.selectedIndex].focus();
      }
      trigger.addEventListener('click',()=>wrapper.classList.contains('open')?close():open());
      trigger.addEventListener('keydown',event=>{
        if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();open();}
      });
      wrapper.addEventListener('keydown',event=>{
        if(event.key==='Escape') {event.preventDefault();event.stopPropagation();close();trigger.focus();}
        const index=buttons.indexOf(document.activeElement);
        if(index>=0&&['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
          event.preventDefault();
          const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;
          buttons[next].focus();
        }
      });
      wrapper.addEventListener('focusout',event=>{if(!wrapper.contains(event.relatedTarget))close();});
      select.addEventListener('change',sync);
      dropdowns.push({sync,close,wrapper});
      sync();
    }
    dialog.querySelectorAll('select').forEach(createSettingsDropdown);
    dialog.addEventListener('pointerdown',event=>{
      dropdowns.forEach(dropdown=>{if(!dropdown.wrapper.contains(event.target))dropdown.close();});
    });
    function fill(settings) {
      control('setting-theme').value=settings.theme;
      control('setting-default-artwork').value=settings.defaultArtwork;
      control('setting-page-size').value=settings.pageSize;
      control('setting-default-related').checked=settings.defaultRelated;
      control('setting-alt-forms').checked=settings.includeAltForms;
      control('setting-sort').value=settings.defaultSort;
      draftSortDirection=settings.sortDirection;
      syncDirection();
      control('setting-animations').value=settings.animations;
      control('setting-color-hex').value=settings.accent.slice(1);
      control('setting-color-picker').value=settings.accent;
      dropdowns.forEach(dropdown=>{dropdown.sync();dropdown.close();});
    }
    control('setting-color-picker').addEventListener('input',()=>{
      control('setting-color-hex').value=control('setting-color-picker').value.slice(1);
    });
    control('setting-color-hex').addEventListener('input',()=>{
      const color='#'+control('setting-color-hex').value;
      if (/^#[0-9a-f]{6}$/i.test(color)) control('setting-color-picker').value=color;
    });
    form.addEventListener('submit',event=>{
      event.preventDefault();
      if (!form.reportValidity()) return;
      const defaultArtwork=control('setting-default-artwork').value;
      const defaultRelated=control('setting-default-related').checked;
      const next=validate({defaultArtwork,defaultRelated,artwork:restoringDefaults||defaultArtwork!==preferences.defaultArtwork?defaultArtwork:preferences.artwork,shiny:restoringDefaults?defaults.shiny:preferences.shiny,theme:control('setting-theme').value,pageSize:Number(control('setting-page-size').value),includeEvolutions:restoringDefaults||defaultRelated!==preferences.defaultRelated?defaultRelated:preferences.includeEvolutions,includeAltForms:control('setting-alt-forms').checked,defaultSort:control('setting-sort').value,sortDirection:draftSortDirection,animations:control('setting-animations').value,accent:'#'+control('setting-color-hex').value});
      let saved=true;
      try { localStorage.setItem(storageKey,JSON.stringify(next)); } catch { saved=false; }
      if (restoringDefaults) {
        const url=new URL(location.href);
        if (url.searchParams.has('related')) {
          url.searchParams.delete('related');
          history.replaceState(history.state,'',url);
        }
      }
      publish(next);
      if (restoringDefaults) window.dispatchEvent(new Event('compdex:reset-filters'));
      restoringDefaults=false;
      status.textContent=saved?'Saved.':'Applied for this visit; browser storage is unavailable.';
    });
    control('restore-settings').addEventListener('click',()=>{
      restoringDefaults=true;
      fill(defaults);
      status.textContent='Defaults selected. Press Save to apply.';
    });
    const button=document.getElementById('settings-button');
    button.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 3h5l.6 3 2.1 1.2 2.9-1 2.5 4.3-2.3 2v2.4l2.3 2-2.5 4.3-2.9-1-2.1 1.2-.6 3h-5l-.6-3-2.1-1.2-2.9 1L1.4 17l2.3-2v-2.4l-2.3-2L3.9 6.3l2.9 1L8.9 6z" transform="translate(0 -1.5) scale(1 .9)"/><circle cx="12" cy="12" r="3"/></svg><span>Settings</span>`;
    let closing=false,closeTimer;
    function closeSettings() {
      if (closing || !dialog.open) return;
      closing=true;
      dropdowns.forEach(dropdown=>dropdown.close());
      dialog.classList.add('closing');
      closeTimer=setTimeout(()=>{dialog.close();dialog.classList.remove('closing');closing=false;},preferences.animations==='off'?0:preferences.animations==='reduced'?120:350);
    }
    button.addEventListener('click',()=>{clearTimeout(closeTimer);closing=false;restoringDefaults=false;dialog.classList.remove('closing');fill(preferences);status.textContent='';dialog.showModal();});
    control('close-settings').addEventListener('click',closeSettings);
    dialog.addEventListener('cancel',event=>{event.preventDefault();closeSettings();});
    dialog.addEventListener('click',event=>{
      const bounds=dialog.getBoundingClientRect();
      if(event.target===dialog&&(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom))closeSettings();
    });
    dialog.addEventListener('close',()=>button.focus());
    fill(preferences);
  });
})();
