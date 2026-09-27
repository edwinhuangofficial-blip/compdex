(() => {
  const storageKey = 'compdex.settings.v1';
  const defaults = Object.freeze({theme:'light',artwork:'hd',includeEvolutions:true,includeAltForms:true,defaultSort:'id',animations:'full',accent:'#66adff'});
  function validate(value) {
    const v = value && typeof value === 'object' ? value : {};
    return {
      theme: ['light','dark','system'].includes(v.theme) ? v.theme : defaults.theme,
      artwork: ['hd','pixel'].includes(v.artwork) ? v.artwork : defaults.artwork,
      includeEvolutions: typeof v.includeEvolutions === 'boolean' ? v.includeEvolutions : defaults.includeEvolutions,
      includeAltForms: typeof v.includeAltForms === 'boolean' ? v.includeAltForms : defaults.includeAltForms,
      defaultSort: ['id','az','za','id-desc'].includes(v.defaultSort) ? v.defaultSort : defaults.defaultSort,
      animations: ['full','reduced','off'].includes(v.animations) ? v.animations : defaults.animations,
      accent: /^#[0-9a-f]{6}$/i.test(v.accent) ? v.accent.toLowerCase() : defaults.accent,
    };
  }
  let preferences;
  try { preferences = validate(JSON.parse(localStorage.getItem(storageKey))); }
  catch { preferences = {...defaults}; }
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
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
    const dialog = document.createElement('dialog');
    dialog.id='settings-dialog';
    dialog.setAttribute('aria-labelledby','settings-title');
    dialog.innerHTML=`<div class="settings-heading"><h2 id="settings-title">Settings</h2><button id="close-settings" type="button" aria-label="Close settings"><img src="assets/search-clear.png" alt="" /></button></div>
      <p class="settings-note">Saved in this browser. Changes apply when you press Save.</p>
      <form id="settings-form">
        <div class="settings-content">
          <div class="settings-row"><label for="setting-theme">Theme</label><select id="setting-theme"><option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option></select></div>
          <div class="settings-row"><label for="setting-artwork">Artwork</label><select id="setting-artwork"><option value="hd">HD artwork</option><option value="pixel">Pixel art</option></select></div>
          <div class="settings-row"><label for="setting-evolutions">Include evolutions</label><input id="setting-evolutions" type="checkbox" /></div>
          <div class="settings-row"><label for="setting-alt-forms">Include alternate forms</label><input id="setting-alt-forms" type="checkbox" /></div>
          <div class="settings-row"><label for="setting-sort">Default sorting</label><select id="setting-sort"><option value="id">#</option><option value="az">A–Z</option><option value="za">Z–A</option><option value="id-desc"># reversed</option></select></div>
          <div class="settings-row"><label for="setting-animations">Animations</label><select id="setting-animations"><option value="full">Full</option><option value="reduced">Reduced</option><option value="off">Off</option></select></div>
          <div class="settings-row"><label for="setting-color-hex">Site color</label><div class="settings-color"><span aria-hidden="true">#</span><input id="setting-color-hex" type="text" minlength="6" maxlength="6" pattern="[0-9a-fA-F]{6}" required spellcheck="false" aria-label="Site color hexadecimal value" /><input id="setting-color-picker" type="color" aria-label="Choose site color" /></div></div>
        </div>
        <p id="settings-status" role="status" aria-live="polite"></p>
        <div class="settings-actions"><button id="restore-settings" type="button">Restore defaults</button><button id="save-settings" type="submit">Save</button></div>
      </form>`;
    document.body.append(dialog);
    const control=id=>dialog.querySelector('#'+id);
    const form=control('settings-form');
    const status=control('settings-status');
    function fill(settings) {
      control('setting-theme').value=settings.theme;
      control('setting-artwork').value=settings.artwork;
      control('setting-evolutions').checked=settings.includeEvolutions;
      control('setting-alt-forms').checked=settings.includeAltForms;
      control('setting-sort').value=settings.defaultSort;
      control('setting-animations').value=settings.animations;
      control('setting-color-hex').value=settings.accent.slice(1);
      control('setting-color-picker').value=settings.accent;
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
      const next=validate({theme:control('setting-theme').value,artwork:control('setting-artwork').value,includeEvolutions:control('setting-evolutions').checked,includeAltForms:control('setting-alt-forms').checked,defaultSort:control('setting-sort').value,animations:control('setting-animations').value,accent:'#'+control('setting-color-hex').value});
      let saved=true;
      try { localStorage.setItem(storageKey,JSON.stringify(next)); } catch { saved=false; }
      publish(next);
      status.textContent=saved?'Saved.':'Applied for this visit; browser storage is unavailable.';
    });
    control('restore-settings').addEventListener('click',()=>{
      fill(defaults);
      status.textContent='Defaults restored in the form. Press Save to apply.';
    });
    const button=document.getElementById('settings-button');
    button.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 3h5l.6 3 2.1 1.2 2.9-1 2.5 4.3-2.3 2v2.4l2.3 2-2.5 4.3-2.9-1-2.1 1.2-.6 3h-5l-.6-3-2.1-1.2-2.9 1L1.4 17l2.3-2v-2.4l-2.3-2L3.9 6.3l2.9 1L8.9 6z" transform="translate(0 -1.5) scale(1 .9)"/><circle cx="12" cy="12" r="3"/></svg><span>Settings</span>`;
    let closing=false,closeTimer;
    function closeSettings() {
      if (closing || !dialog.open) return;
      closing=true;
      dialog.classList.add('closing');
      closeTimer=setTimeout(()=>{dialog.close();dialog.classList.remove('closing');closing=false;},preferences.animations==='off'?0:preferences.animations==='reduced'?120:350);
    }
    button.addEventListener('click',()=>{clearTimeout(closeTimer);closing=false;dialog.classList.remove('closing');fill(preferences);status.textContent='';dialog.showModal();});
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
