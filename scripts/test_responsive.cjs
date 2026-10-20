// Run with Playwright installed: node scripts/test_responsive.cjs
// Optional: BROWSER_PATH=/path/to/chrome. Output goes in artifacts/responsive/.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts', 'responsive');
fs.mkdirSync(output, { recursive: true });
const server = http.createServer((request, response) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  fs.readFile(file, (error, body) => {
    if (error) { response.writeHead(404).end(); return; }
    response.setHeader('Content-Type', { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream');
    response.end(body);
  });
});
const cases = [[1920,1080],[1536,864],[1440,900],[1366,768],[1321,900],[1320,900],[1280,720],[1201,768],[1200,768],[1121,768],[1120,768],[1025,768],[1024,768],[768,1024],[761,768],[760,768],[390,844],[375,667]].map(([width,height]) => ({name:`${width}×${height}`,width,height,dpr:1}));
for (const [width,height] of [[2880,1800],[3072,1920]]) {
  for (const dpr of [1,1.25,1.5,1.75,2]) {
    const css = {width:Math.round(width/dpr),height:Math.round(height/dpr),dpr};
    cases.push({name:`${width}×${height} / ${dpr*100}% OS`,...css});
    // Allow 120 CSS px for browser tabs, address bar, and taskbar as well.
    cases.push({name:`${width}×${height} / ${dpr*100}% OS, browser chrome`,...css,height:css.height-120});
  }
}
for (const zoom of [1.25,1.5]) for (const [width,height] of [[1920,1080],[1440,900],[1280,720]]) {
  cases.push({name:`${width}×${height} at ${zoom*100}% zoom equivalent`,width:Math.round(width/zoom),height:Math.round(height/zoom),dpr:zoom});
}
cases.push({name:'short window',width:1280,height:500,dpr:1});
let browser;
const results = [];
const errors = [];
async function check(name, run) {
  try { const detail = await run(); results.push({name,pass:true,...detail}); }
  catch (error) { results.push({name,pass:false,error:error.message}); console.error(name, error.message); }
}
(async () => {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({headless:true,...(process.env.BROWSER_PATH ? {executablePath:process.env.BROWSER_PATH} : {})});
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { if (!localStorage.getItem('compdex.settings.v1')) localStorage.setItem('compdex.settings.v1',JSON.stringify({animations:'off',includeEvolutions:false})); });
  await page.goto(`${base}/index.html?related=0`);
  await page.waitForFunction(() => document.querySelectorAll('.pokecard').length > 5, null, {timeout:60000});
  await page.evaluate(() => document.fonts.ready);
  await check('welcome: once per tab visit, navigation, reloads, and saved opt-out', async () => {
    assert.equal(await page.locator('#welcome-dialog').isVisible(),true);
    assert.equal(await page.locator('#hide-welcome').isChecked(),false);
    assert.equal(await page.locator('#close-welcome img').getAttribute('src'),await page.locator('#close-settings img').getAttribute('src'));
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#welcome-dialog').isVisible(),false);
    await page.reload();
    assert.equal(await page.locator('#welcome-dialog').isVisible(),false,'reload must not repeat the welcome popup');
    await page.goto(`${base}/notfound.html`);
    await page.goto(`${base}/index.html?related=0`);
    assert.equal(await page.locator('#welcome-dialog').isVisible(),false,'returning Home must not repeat the popup');
    const fresh=await context.newPage();
    try {
      await fresh.goto(`${base}/index.html?related=0`);
      assert.equal(await fresh.locator('#welcome-dialog').isVisible(),true,'a new tab visit should show the popup');
      await fresh.locator('#welcome-get-started').click();
      await fresh.reload();
      assert.equal(await fresh.locator('#welcome-dialog').isVisible(),false);
    } finally { await fresh.close(); }
    await page.evaluate(()=>sessionStorage.removeItem('compdex.welcome.seen.v1'));
    await page.reload();
    assert.equal(await page.locator('#welcome-dialog').isVisible(),true);
    await page.locator('#hide-welcome').check();
    await page.locator('#welcome-get-started').click();
    await page.reload();
    assert.equal(await page.locator('#welcome-dialog').isVisible(),false);
  });
  async function closeSettings() {
    await page.locator('#close-settings').click();
    await page.waitForSelector('#settings-dialog',{state:'hidden'});
  }
  await check('welcome: checkbox under Animations, Save, and discarded drafts', async () => {
    await page.locator('#settings-button').click();
    const show=page.locator('#setting-show-welcome');
    assert.equal(await show.isChecked(),false);
    await page.locator('#setting-see-welcome').click();
    assert.equal(await page.locator('#welcome-dialog').isVisible(),true,'See must preview the popup even when automatic display is disabled');
    await page.locator('#close-welcome').click();
    assert.equal(await page.locator('#settings-dialog').isVisible(),true,'Settings must remain available after preview');
    assert.equal(await show.isChecked(),false,'Preview must not change the display preference');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'setting-see-welcome');
    assert.equal(await show.evaluate(el=>el.closest('.settings-row').previousElementSibling.contains(document.querySelector('#setting-animations'))),true);
    await show.check();
    await closeSettings();
    await page.reload();
    assert.equal(await page.locator('#welcome-dialog').isVisible(),false,'unsaved draft should not change popup preference');
    await page.locator('#settings-button').click();
    await show.check();
    await page.locator('#save-settings').click();
    await closeSettings();
    await page.reload();
    assert.equal(await page.locator('#welcome-dialog').isVisible(),false,'enabling the setting should apply to the next visit');
    await page.evaluate(()=>sessionStorage.removeItem('compdex.welcome.seen.v1'));
    await page.reload();
    assert.equal(await page.locator('#welcome-dialog').isVisible(),true);
    await page.locator('#hide-welcome').check();
    await page.locator('#welcome-get-started').click();
  });
  await check('welcome: desktop/mobile sizing, theme, accent, and outside dismissal', async () => {
    await page.setViewportSize({width:1440,height:900});
    await page.locator('#settings-button').click();
    const settingsWidth=await page.locator('#settings-dialog').evaluate(el=>el.getBoundingClientRect().width);
    await page.locator('#setting-show-welcome').check();
    await page.locator('#save-settings').click();
    await closeSettings();
    await page.evaluate(()=>sessionStorage.removeItem('compdex.welcome.seen.v1'));
    await page.reload();
    const welcomeWidth=await page.locator('#welcome-dialog').evaluate(el=>el.getBoundingClientRect().width);
    assert(Math.abs(welcomeWidth-settingsWidth*1.1)<1,'welcome should be 10% wider than Settings');
    assert.equal(await page.locator('.welcome-features li').count(),3);
    assert.equal(await page.locator('.welcome-updates article').count(),2);
    await page.screenshot({path:path.join(output,'welcome-desktop.png')});
    await page.locator('#close-welcome').click();
    await page.locator('#settings-button').click();
    await page.locator('#setting-theme-trigger').click();
    await page.getByRole('menuitemradio',{name:'Dark',exact:true}).click();
    await page.locator('#setting-color-hex').fill('d967a8');
    await page.locator('#save-settings').click();
    await closeSettings();
    await page.setViewportSize({width:375,height:667});
    await page.evaluate(()=>sessionStorage.removeItem('compdex.welcome.seen.v1'));
    await page.reload();
    const styles=await page.locator('#welcome-dialog').evaluate(el=>({border:getComputedStyle(el).borderTopColor,background:getComputedStyle(el).backgroundColor,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,top:el.getBoundingClientRect().top}));
    assert.equal(styles.border,'rgb(217, 103, 168)');
    assert.equal(styles.background,'rgb(25, 33, 44)');
    assert(styles.width<=375 && styles.height<=667 && styles.top>=0,'welcome exceeds viewport');
    await page.locator('#hide-welcome').scrollIntoViewIfNeeded();
    const checkbox=await page.locator('#hide-welcome').boundingBox();
    assert(checkbox.y>=0 && checkbox.y+checkbox.height<=667,'welcome checkbox is inaccessible');
    await page.screenshot({path:path.join(output,'welcome-mobile-dark.png')});
    await page.mouse.click(1,1);
    assert.equal(await page.locator('#welcome-dialog').isVisible(),false);
    await page.evaluate(()=>{
      localStorage.setItem('compdex.welcome.hidden.v1','true');
      localStorage.setItem('compdex.settings.v1',JSON.stringify({animations:'off',includeEvolutions:false}));
    });
    await page.reload();
  });
  await page.waitForFunction(() => document.querySelectorAll('.pokecard').length > 5, null, {timeout:60000});
  await page.evaluate(() => document.fonts.ready);
  const cdp = await page.context().newCDPSession(page);
  await check('settings: full/reduced/off animations and stable dropdown layout',async()=>{
    await page.setViewportSize({width:1440,height:900});
    for (const animations of ['full','reduced','off']) {
      await page.evaluate(mode=>localStorage.setItem('compdex.settings.v1',JSON.stringify({animations:mode,includeEvolutions:false})),animations);
      await page.reload();
      await page.locator('#settings-button').click();
      assert.equal(await page.locator('#settings-dialog').evaluate(el=>getComputedStyle(el).animationName),animations==='full'?'settings-float-in':'none');
      await page.locator('#settings-dialog').evaluate(el=>Promise.all(el.getAnimations().map(animation=>animation.finished.catch(()=>{}))));
      const positions=()=>page.evaluate(()=>['#settings-dialog','#save-settings','#setting-show-welcome','.homepagebar'].map(selector=>{
        const {x,y,width,height}=document.querySelector(selector).getBoundingClientRect();
        return {x,y,width,height};
      }));
      const before=await positions();
      for (const id of ['setting-theme','setting-default-artwork','setting-sort','setting-animations']) {
        await page.locator('#'+id+'-trigger').click();
        const after=await positions();
        for(let index=0;index<before.length;index++) for(const key of ['x','y','width','height']) assert(Math.abs(before[index][key]-after[index][key])<1,`${id} shifts the layout in ${animations} mode`);
        const menu=page.locator('#'+id+'-menu');
        if (animations==='full') assert((await menu.evaluate(el=>getComputedStyle(el).transitionDuration)).includes('0.22s'),'dropdown fade transition missing');
        await menu.evaluate(el=>Promise.all(el.getAnimations().map(animation=>animation.finished.catch(()=>{}))));
        const bounds=await menu.boundingBox();
        assert(bounds.y>=0 && bounds.y+bounds.height<=900,'floating dropdown exceeds viewport');
        if (animations==='full' && id==='setting-default-artwork') await page.screenshot({path:path.join(output,'settings-floating-menu.png')});
        await page.keyboard.press('Escape');
      }
      await closeSettings();
    }
    await page.evaluate(()=>localStorage.setItem('compdex.settings.v1',JSON.stringify({animations:'off',includeEvolutions:false})));
    await page.reload();
    await page.waitForFunction(()=>document.querySelectorAll('.pokecard').length>5);
  });
  async function resize(test) {
    await page.setViewportSize({width:test.width,height:test.height});
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:test.width,height:test.height,deviceScaleFactor:test.dpr,mobile:false});
    await page.evaluate(() => { window.scrollTo(0,0); return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  }
  await check('theme switch: exact icons, persistence, Settings, system mode, and other tabs',async()=>{
    const toggle=page.locator('#theme-toggle');
    assert.equal(await toggle.getAttribute('aria-checked'),'false');
    assert.equal(await page.locator('.theme-sun').textContent(),'🌤️');
    assert.equal(await page.locator('.theme-moon').textContent(),'☾✦');
    const track=await page.locator('.theme-track').boundingBox();
    const thumb=await page.locator('.theme-thumb').boundingBox();
    assert.equal(track.width,52); assert.equal(track.height,23); assert.equal(thumb.width,31);
    await page.locator('.bar-right').screenshot({path:path.join(output,'theme-switch-light.png')});
    await toggle.focus();
    await page.keyboard.press('Space');
    assert.equal(await toggle.getAttribute('aria-checked'),'true');
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('compdex.settings.v1')).theme),'dark');
    await page.locator('.bar-right').screenshot({path:path.join(output,'theme-switch-dark.png')});
    await page.locator('#settings-button').click();
    assert.equal(await page.locator('#setting-theme').inputValue(),'dark');
    assert.equal(await page.locator('#setting-theme-trigger').textContent(),'Dark');
    await page.locator('#setting-theme-trigger').click();
    await page.getByRole('menuitemradio',{name:'Light',exact:true}).click();
    await page.locator('#save-settings').click();
    assert.equal(await toggle.getAttribute('aria-checked'),'false');
    await page.emulateMedia({colorScheme:'dark'});
    await page.locator('#setting-theme-trigger').click();
    await page.getByRole('menuitemradio',{name:'System',exact:true}).click();
    await page.locator('#save-settings').click();
    assert.equal(await toggle.getAttribute('aria-checked'),'true');
    await page.emulateMedia({colorScheme:'light'});
    await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
    assert.equal(await toggle.getAttribute('aria-checked'),'false');
    assert.equal(await page.locator('#setting-theme').inputValue(),'system');
    await closeSettings();
    await toggle.click();
    await page.reload();
    assert.equal(await toggle.getAttribute('aria-checked'),'true');
    await page.locator('#settings-button').click();
    assert.equal(await page.locator('#setting-theme').inputValue(),'dark');
    const other=await page.context().newPage();
    try {
      await other.goto(`${base}/notfound.html`);
      assert.equal(await other.locator('#theme-toggle').getAttribute('aria-checked'),'true');
      await other.locator('#theme-toggle').click();
      await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
      assert.equal(await toggle.getAttribute('aria-checked'),'false');
      assert.equal(await page.locator('#setting-theme').inputValue(),'light');
      assert.equal(await page.locator('#setting-theme-trigger').textContent(),'Light');
    } finally { await other.close(); }
    await closeSettings();
  });
  for (const test of cases) await check(`home: ${test.name}`, async () => {
    await resize(test);
    const compact = test.width <= 1024;
    const header = await page.evaluate(() => ['#homebutton','.page-label','.searchbarbut','#random-pokemon','.bar-right'].map(selector => {
      const {left,right,top,bottom} = document.querySelector(selector).getBoundingClientRect();
      return {selector,left,right,top,bottom};
    }));
    for (const [index, a] of header.entries()) {
      assert(a.left>=0 && a.right<=test.width+1, `${a.selector} exceeds viewport`);
      for (const b of header.slice(index+1)) assert(!(a.left<b.right && a.right>b.left && a.top<b.bottom && a.bottom>b.top), `${a.selector} overlaps ${b.selector}`);
    }
    if (compact) await page.locator('#filters-toggle').click();
    assert.equal(await page.locator('#filters-dialog').isVisible(), true);
    const last = page.locator('#game-filter-trigger');
    await last.scrollIntoViewIfNeeded();
    const measurements = await page.evaluate(() => {
      const rect = el => el.getBoundingClientRect();
      const panel=rect(document.querySelector('#filters-dialog'));
      const last=rect(document.querySelector('#game-filter-trigger'));
      const layout=rect(document.querySelector('.homepage-layout'));
      return {viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,zoom:visualViewport.scale,overflow:document.documentElement.scrollWidth-innerWidth,layoutWidth:layout.width,layoutLeft:layout.left,cardText:parseFloat(getComputedStyle(document.querySelector('.pokecard')).fontSize),artworkWidth:rect(document.querySelector('.pokecard img')).width,cardWidth:rect(document.querySelector('.pokecard')).width,columns:getComputedStyle(document.querySelector('#poke-grid')).gridTemplateColumns.split(' ').length,panelBottom:panel.bottom,lastTop:last.top,lastBottom:last.bottom,panelTop:panel.top};
    });
    assert.equal(measurements.zoom,1);
    assert(measurements.overflow <= 1, `horizontal overflow: ${measurements.overflow}px`);
    assert(measurements.cardWidth >= 149, `card too small: ${measurements.cardWidth}`);
    assert(measurements.layoutWidth<=1580,'content consumes reserved side space');
    assert(Math.abs(measurements.layoutLeft-(test.width-measurements.layoutWidth)/2)<1,'content is not centered');
    assert(measurements.columns<=5,'more than five cards per row');
    if(test.width>=1580) assert.equal(measurements.columns,5,'desktop should default to five cards');
    if(test.width>760) {
      assert(Math.abs(measurements.cardWidth-236.5)<1,'published card width changed');
      assert.equal(measurements.cardText,22,'published card text size was reduced');
      assert.equal(measurements.artworkWidth,112,'published artwork size was reduced');
    }
    assert(measurements.lastTop >= measurements.panelTop && measurements.lastBottom <= measurements.panelBottom+1,'last filter is clipped');
    assert(measurements.panelBottom <= test.height+1,'panel exceeds viewport');
    await last.click();
    await page.locator('#game-filter-menu .filter-option').last().scrollIntoViewIfNeeded();
    const optionBounds=await page.locator('#game-filter-menu .filter-option').last().boundingBox();
    assert(optionBounds.y >= 0 && optionBounds.y+optionBounds.height <= test.height+1,'last game menu option is clipped');
    await page.keyboard.press('Escape');
    if (compact) {
      assert.equal(await page.locator('#filters-dialog').isVisible(),true,'Escape in menu should only close menu');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#filters-dialog').isVisible(),false);
      assert.equal(await page.locator('#filters-toggle').evaluate(el=>el===document.activeElement),true);
    }
    if (['1920×1080','1440×900','375×667'].includes(test.name)) {
      await page.evaluate(() => window.scrollTo(0,0));
      await page.screenshot({path:path.join(output,`home-${test.width}.png`),scale:'css'});
    }
    return measurements;
  });
  await check('filter state, focus trap, backdrop, resize, reset, search, navigation', async () => {
    await resize({width:390,height:844,dpr:1});
    await page.locator('#filters-toggle').click();
    await page.locator('#name-filter').fill('bulbasaur');
    await page.waitForFunction(()=>document.querySelectorAll('.pokecard').length===1);
    await page.locator('#close-filters').click();
    await page.locator('#filters-toggle').click();
    assert.equal(await page.locator('#name-filter').inputValue(),'bulbasaur');
    await page.locator('#close-filters').focus();
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(()=>document.querySelector('#filters-dialog').contains(document.activeElement)),true,'focus escaped dialog');
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('#close-filters').evaluate(el=>el===document.activeElement),true,'forward focus did not wrap');
    await page.mouse.click(1,1);
    assert.equal(await page.locator('#filters-dialog').isVisible(),false);
    await resize({width:1440,height:900,dpr:1});
    assert.equal(await page.locator('#name-filter').inputValue(),'bulbasaur');
    assert.equal(await page.locator('#filters-dialog').isVisible(),true);
    await page.locator('#name-filter').focus();
    await resize({width:390,height:844,dpr:1});
    assert.equal(await page.locator('#filters-toggle').evaluate(el=>el===document.activeElement),true);
    await page.locator('#filters-toggle').click();
    await page.locator('#reset-filters').click();
    await page.waitForFunction(()=>document.querySelectorAll('.pokecard').length>5);
    assert.equal(await page.locator('#name-filter').inputValue(),'');
    await page.locator('#type-filter-trigger').click();
    await page.locator('#type-filter-menu .filter-option').filter({hasText:/^Fire$/i}).click();
    assert.equal(await page.locator('#type-filter-menu [aria-checked="true"]').count(),1);
    await page.keyboard.press('Escape');
    await page.locator('#close-filters').click();
    await page.locator('#searchbarid').fill('bulbasaur');
    await page.waitForSelector('#search-dropdown.active .dropdown-item');
    await page.locator('#searchbutton').click();
    await page.waitForURL(/pokemoninfo.html/);
    await page.waitForSelector('.stats');
  });
  await page.goto(`${base}/pokemoninfo.html?pokemon=bulbasaur`);
  await page.waitForSelector('.stats',{timeout:60000});
  await page.waitForSelector('.evolution-card',{timeout:60000});
  await check('welcome: preference is available in detail-page Settings',async()=>{
    assert.equal(await page.locator('#welcome-dialog').isVisible(),false);
    await page.locator('#settings-button').click();
    assert.equal(await page.locator('#setting-show-welcome').isChecked(),false);
    await closeSettings();
  });
  for (const test of cases) await check(`details: ${test.name}`,async()=>{
    await resize(test);
    const overlaps=await page.evaluate(()=>{
      const selectors=['#homebutton','.page-label','.searchbarbut','#random-pokemon','.bar-right'];
      return selectors.flatMap((a,i)=>selectors.slice(i+1).filter(b=>{
        const x=document.querySelector(a).getBoundingClientRect(),y=document.querySelector(b).getBoundingClientRect();
        return x.left<y.right && x.right>y.left && x.top<y.bottom && x.bottom>y.top;
      }).map(b=>`${a} overlaps ${b}`));
    });
    assert.equal(overlaps.length,0,overlaps.join(', '));
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    assert(overflow<=1, `horizontal overflow: ${overflow}px`);
    const stats=await page.locator('.stats').boundingBox();
    assert(stats.width<=test.width && stats.x>=0 && stats.x+stats.width<=test.width+1,'stats clipped');
    const primary=await page.locator('.info-primary').boundingBox();
    const evolution=await page.locator('.info-evolution').boundingBox();
    assert(primary.x<=22.1,'primary panels should stay on the left');
    if (test.width>1320) {
      assert(evolution.x>=primary.x+primary.width,'evolution should be to the right of the primary panels');
      assert(Math.abs(evolution.y-primary.y)<1,'evolution should align with the top of the primary panels');
      const cards=await page.locator('.evolution-chain .evolution-card').evaluateAll(elements=>elements.slice(0,3).map(el=>({x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y})));
      assert.equal(cards.length,3);
      assert(cards[0].x<cards[1].x && cards[1].x<cards[2].x && Math.abs(cards[0].y-cards[2].y)<1,'evolution stages should run horizontally');
    }
    if (['1440×900','375×667'].includes(test.name)) await page.screenshot({path:path.join(output,`details-${test.width}.png`),fullPage:true,scale:'css'});
    return {overflow};
  });
  await check('small settings dialog and final controls',async()=>{
    await resize({width:375,height:667,dpr:1});
    await page.locator('#settings-button').click();
    for (const trigger of await page.locator('.settings-dropdown-trigger').all()) {
      await trigger.click();
      const last=trigger.locator('..').locator('.settings-dropdown-option').last();
      await last.scrollIntoViewIfNeeded();
      const option=await last.boundingBox();
      assert(option.y>=0 && option.y+option.height<=667,'settings option clipped');
      await page.keyboard.press('Escape');
    }
    await page.locator('#save-settings').scrollIntoViewIfNeeded();
    const save=await page.locator('#save-settings').boundingBox();
    assert(save.y>=0 && save.y+save.height<=667,'save settings clipped');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.keyboard.press('Escape');
  });
  for (const pokemon of ['eevee','wurmple','tyrogue']) {
    await page.goto(`${base}/pokemoninfo.html?pokemon=${pokemon}`);
    await page.waitForSelector('.evolution-card',{timeout:60000});
    for (const [width,height] of [[1440,900],[768,1024],[375,667]]) await check(`${pokemon} evolution: ${width}×${height}`,async()=>{
      await resize({width,height,dpr:1});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'evolution overflows page');
    });
  }
  const openPokemon=async name=>{
    await resize({width:1440,height:900,dpr:1});
    await page.goto(`${base}/pokemoninfo.html?pokemon=${name}`);
    await page.waitForFunction(()=>document.querySelector('#evolution-content')?.getAttribute('aria-busy')==='false'&&document.querySelector('.evolution-card'),null,{timeout:60000});
  };
  const chooseForm=async(id,value)=>{
    await page.locator('#'+id+'-trigger').click();
    await page.locator('#'+id+'-menu button[data-value="'+value+'"]').click();
  };
  const alternateLinks=()=>page.locator('#alternate-form-cards .evolution-card').evaluateAll(elements=>elements.map(el=>el.getAttribute('href')));
  const captureForms=async name=>{
    await page.waitForFunction(()=>[...document.querySelectorAll('.info-evolution .evolution-card img')].every(image=>image.complete&&image.naturalWidth>0),null,{timeout:15000});
    await page.locator('.info-evolution').screenshot({path:path.join(output,`forms-${name}.png`)});
  };
  await check('forms: family-wide Mega/Gmax switch preserves the normal evolution chain',async()=>{
    await openPokemon('bulbasaur');
    assert.equal(await page.locator('#forms-category').inputValue(),'mega');
    assert((await alternateLinks()).some(link=>link.includes('venusaur-mega')));
    assert((await page.locator('#alternate-form-cards').textContent()).includes('Venusaurite'));
    assert.equal(await page.locator('#alternate-form-cards .evolution-requirement').textContent(),'Venusaurite');
    assert.deepEqual(await page.locator('#alternate-form-cards .evolution-requirement').evaluate(el=>[getComputedStyle(el).fontSize,getComputedStyle(el).fontWeight]),['16px','700']);
    assert.equal(await page.locator('.evolution-mega-symbol img').evaluate(el=>getComputedStyle(el).imageRendering),'auto');
    const top=await page.locator('#alternate-form-cards').evaluate(el=>el.getBoundingClientRect().top);
    await page.locator('#forms-category-trigger').click();
    assert.equal(await page.locator('#alternate-form-cards').evaluate(el=>el.getBoundingClientRect().top),top);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#forms-category-trigger').getAttribute('aria-expanded'),'false');
    await captureForms('venusaur-mega-restored');
    await chooseForm('forms-category','gmax');
    await captureForms('venusaur-gmax');
    assert((await alternateLinks()).some(link=>link.includes('venusaur-gmax')));
    assert.equal(await page.locator('#evolution-route .evolution-card').count(),3);
    assert.equal(await page.locator('.evolution-mega-symbol img').getAttribute('alt'),'Dynamax Band');
  });
  await check('forms: Mega X/Y cards, requirements, and Gmax navigation',async()=>{
    await openPokemon('charizard');
    const links=await alternateLinks();
    assert(links.some(link=>link.includes('charizard-mega-x'))&&links.some(link=>link.includes('charizard-mega-y')));
    assert((await page.locator('#alternate-form-cards').textContent()).includes('Charizardite X'));
    await chooseForm('forms-category','gmax');
    await page.locator('#alternate-form-cards .evolution-card').click();
    await page.waitForURL(/pokemon=charizard-gmax/);
    await page.waitForFunction(()=>document.querySelector('#forms-category')?.value==='gmax');
  });
  await check('forms: Main/Alolan/Galarian Meowth paths and Gmax compatibility',async()=>{
    await openPokemon('meowth');
    assert.equal(await page.locator('#evolution-region').inputValue(),'main');
    assert.equal(await page.locator('#forms-category').inputValue(),'gmax');
    assert.equal(await page.locator('.evolution-region-dropdown').evaluate(el=>getComputedStyle(el).position),'absolute');
    const top=await page.locator('#evolution-route').evaluate(el=>el.getBoundingClientRect().top);
    await page.locator('#evolution-region-trigger').click();
    assert.equal(await page.locator('#evolution-route').evaluate(el=>el.getBoundingClientRect().top),top);
    await page.keyboard.press('Escape');
    await chooseForm('evolution-region','galar');
    assert.equal(await page.locator('#evolution-route a[href*="meowth-galar"]').count(),1);
    assert.equal(await page.locator('#evolution-route a[href*="perrserker"]').count(),1);
    assert.equal(await page.locator('.alternate-forms').isVisible(),false,'Galarian Meowth must not receive the original Meowth’s Gmax');
    await captureForms('meowth-galar');
    await chooseForm('evolution-region','alola');
    assert.equal(await page.locator('#evolution-route a[href*="persian-alola"]').count(),1);
    assert.equal(await page.locator('#evolution-route a[href*="meowth-galar"]').count(),0);
  });
  await check('forms: regional selection follows the current Pokémon and later-stage regions',async()=>{
    await openPokemon('perrserker');
    assert.equal(await page.locator('#evolution-region').inputValue(),'galar');
    await openPokemon('raichu-alola');
    assert.equal(await page.locator('#evolution-region').inputValue(),'alola');
    assert.equal(await page.locator('#evolution-route a[href*="raichu-alola"]').count(),1);
    assert.equal(await page.locator('#forms-category option[value="mega"]').count(),0);
    assert.equal(await page.locator('#forms-category option[value="gmax"]').count(),1,'Pikachu on this path still supports Gmax');
  });
  for(const [name,item] of [['kyogre','Blue Orb'],['groudon','Red Orb']]) await check(`forms: ${name} Primal item and requirement`,async()=>{
    await openPokemon(name);
    assert.equal(await page.locator('#forms-category').inputValue(),'primal');
    assert((await page.locator('#alternate-form-cards').textContent()).includes(item));
    assert.equal((await page.locator('.evolution-mega-symbol img').getAttribute('alt')).toLowerCase(),item.toLowerCase());
  });
  await check('forms: Ash-Greninja ability requirement and uninterrupted divider',async()=>{
    await openPokemon('greninja');
    await chooseForm('forms-category','battle');
    assert((await alternateLinks()).some(link=>link.includes('greninja-ash')));
    assert((await page.locator('#alternate-form-cards').textContent()).includes('Battle Bond'));
    assert.equal(await page.locator('.evolution-mega-symbol img').count(),0);
    assert.equal(await page.locator('.evolution-mega-symbol').evaluate(el=>getComputedStyle(el).gap),'0px');
    await captureForms('greninja-ash');
  });
  await check('forms: Rayquaza uses its move requirement without a stone icon',async()=>{
    await openPokemon('rayquaza');
    assert.equal(await page.locator('#forms-category').inputValue(),'mega');
    assert.equal(await page.locator('#forms-category-trigger').count(),0,'Mega-only families should use a plain heading');
    assert.equal(await page.locator('.evolution-mega-heading > span:first-child').evaluate(el=>el.firstChild.textContent),'Mega Evolution');
    assert((await page.locator('#alternate-form-cards').textContent()).includes('Dragon Ascent'));
    assert.equal(await page.locator('.evolution-mega-symbol img').count(),0);
  });
  for(const name of ['urshifu','toxtricity']) await check(`forms: both ${name} Gmax variants`,async()=>{
    await openPokemon(name==='urshifu'?'urshifu-single-strike':'toxtricity-amped');
    await chooseForm('forms-category','gmax');
    assert.equal((await alternateLinks()).filter(link=>link.includes('gmax')).length,2);
    await resize({width:375,height:667,dpr:1});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  });
  for(const [name,category,count] of [['rotom','appliance',5],['deoxys-normal','other',3],['giratina-altered','origin',1],['necrozma','fusion',2]]) await check(`forms: ${name} gameplay variants`,async()=>{
    await openPokemon(name);
    await chooseForm('forms-category',category);
    assert.equal(await page.locator('#alternate-form-cards .evolution-card').count(),count);
    assert(!(await page.locator('#alternate-form-cards').textContent()).includes('not yet documented'));
    if(name==='necrozma')assert.equal(await page.locator('.evolution-mega-symbol img').count(),2);
  });
  await check('forms: regional battle transformations use the matching base',async()=>{
    await openPokemon('darmanitan-galar-standard');
    assert.equal(await page.locator('#evolution-region').inputValue(),'galar');
    assert((await alternateLinks()).some(link=>link.includes('darmanitan-galar-zen')));
    assert(!(await alternateLinks()).some(link=>link.endsWith('pokemon=darmanitan-zen')));
  });
  await check('forms: typed Arceus cards open the correct type and artwork',async()=>{
    await openPokemon('arceus');
    assert.equal(await page.locator('#forms-category').inputValue(),'type');
    await page.locator('#alternate-form-cards a[href*="form=arceus-bug"]').click();
    await page.waitForURL(/form=arceus-bug/);
    await page.waitForSelector('.info-artwork-types .type-bug');
    await page.waitForFunction(()=>document.querySelector('#evolution-content')?.getAttribute('aria-busy')==='false');
    assert.equal(await page.locator('#alternate-form-cards .current').count(),1);
    await resize({width:375,height:667,dpr:1});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  });
  await check('forms: cosmetic palettes excluded and species without forms stay clean',async()=>{
    await openPokemon('alcremie');
    assert.equal(await page.locator('#forms-category option').count(),1);
    assert.equal(await page.locator('#forms-category').inputValue(),'gmax');
    await openPokemon('ditto');
    assert.equal(await page.locator('.alternate-forms').isVisible(),false);
    assert.equal(await page.locator('#evolution-region').count(),0);
  });
  await check('forms: Genesect drive forms include their move requirement',async()=>{
    await openPokemon('genesect');
    assert.equal(await page.locator('#forms-category').inputValue(),'drive');
    assert.equal(await page.locator('#alternate-form-cards .evolution-card').count(),4);
    assert.deepEqual((await page.locator('#alternate-form-cards .evolution-requirement').allTextContents()).sort(),['Burn Drive','Chill Drive','Douse Drive','Shock Drive']);
  });
  await page.goto(`${base}/notfound.html?pokemon=test`);
  for(const [width,height] of [[1440,900],[375,667]]) await check(`not found: ${width}×${height}`,async()=>{
    await resize({width,height,dpr:1});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  });
  assert.equal(errors.length,0,JSON.stringify(errors));
})().catch(error=>{results.push({name:'runner',pass:false,error:error.message});console.error(error);}).finally(async()=>{
  await browser?.close(); server.close();
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({results,errors},null,2));
  const failures=results.filter(result=>!result.pass);
  console.log(`${results.length-failures.length}/${results.length} checks passed. Results: ${output}`);
  process.exitCode=failures.length?1:0;
});
