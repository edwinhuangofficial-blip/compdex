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
const cases = [[1920,1080],[1536,864],[1440,900],[1366,768],[1320,900],[1280,720],[1121,768],[1120,768],[1025,768],[1024,768],[768,1024],[761,768],[760,768],[390,844],[375,667]].map(([width,height]) => ({name:`${width}×${height}`,width,height,dpr:1}));
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
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('compdex.settings.v1',JSON.stringify({animations:'off',includeEvolutions:false})));
  await page.goto(`${base}/index.html?related=0`);
  await page.waitForFunction(() => document.querySelectorAll('.pokecard').length > 5, null, {timeout:60000});
  await page.evaluate(() => document.fonts.ready);
  const cdp = await page.context().newCDPSession(page);
  async function resize(test) {
    await page.setViewportSize({width:test.width,height:test.height});
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:test.width,height:test.height,deviceScaleFactor:test.dpr,mobile:false});
    await page.evaluate(() => { window.scrollTo(0,0); return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  }
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
