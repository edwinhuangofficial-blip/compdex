// Read public metadata as text, never execute downloaded TypeScript.
import {writeFile, mkdir} from 'node:fs/promises';
const source='https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/pokedex.ts';
const key=name=>String(name).toLowerCase().replace(/female/g,'f').replace(/male/g,'m').replace(/[^a-z0-9]/g,'');
const fetchText=async url=>{const r=await fetch(url);if(!r.ok)throw new Error(`${r.status}: ${url}`);return r.text();};
const [text,catalogue]=await Promise.all([fetchText(source),fetchText('https://pokeapi.co/api/v2/pokemon?limit=100000').then(JSON.parse)]);
const dex=new Map();
const cosmetics=new Set();
for(const [,block] of text.matchAll(/^\t[a-z0-9]+: \{([\s\S]*?)^\t\},/gm)){
  const field=name=>block.match(new RegExp(`^\\t\\t${name}: "([^"\\n]+)"`,'m'))?.[1];
  const list=name=>[...(block.match(new RegExp(`^\\t\\t${name}: \\[([^\\n]+)\\]`,'m'))?.[1]||'').matchAll(/"([^"]+)"/g)].map(m=>m[1]);
  const name=field('name');if(!name)continue;
  list('cosmeticFormes').forEach(n=>cosmetics.add(key(n)));
  dex.set(key(name),{name,item:field('requiredItem'),items:list('requiredItems'),move:field('requiredMove'),ability:field('requiredAbility'),from:field('battleOnly')||field('changesFrom'),battleOnly:Boolean(field('battleOnly')||list('battleOnly').length)});
}
const alias=name=>name.replace('meowstic-male-mega','meowstic-m-mega').replace('necrozma-dusk','necrozma-dusk-mane').replace('necrozma-dawn','necrozma-dawn-wings').replace('calyrex-ice','calyrex-ice-rider').replace('calyrex-shadow','calyrex-shadow-rider').replace('greninja-battle-bond','greninja-bond').replace('meowstic-male','meowstic').replace('urshifu-single-strike','urshifu').replace('toxtricity-amped','toxtricity').replace('darmanitan-galar-standard','darmanitan-galar').replace(/-mask$/,'');
const forms={};
for(const pokemon of catalogue.results){
  if(Number(pokemon.url.split('/').filter(Boolean).pop())<10000)continue;
  const metadata=dex.get(key(alias(pokemon.name)))||{};
  forms[pokemon.name]={...metadata,cosmetic:cosmetics.has(key(alias(pokemon.name)))};
}
await mkdir(new URL('../assets/forms/',import.meta.url),{recursive:true});
const items=new Set(['Blue Orb','Red Orb','Dynamax Band','Griseous Orb','Griseous Core','Adamant Crystal','Lustrous Globe','Reveal Glass','Gracidea','Prison Bottle','DNA Splicers','N-Solarizer','N-Lunarizer','Reins of Unity','Ultranecrozium Z','Yellow Nectar','Pink Nectar','Purple Nectar','Flame Plate','Fire Memory','Burn Drive','Tera Orb']);
for(const [name,entry] of Object.entries(forms))if(!name.includes('-mega'))[entry.item,...(entry.items||[])].filter(Boolean).forEach(item=>items.add(item));
const icons={},missingIcons=[];
for(const item of items){
  const slug=item.toLowerCase().replace(/[^a-z0-9]+/g,'-');
  const url=`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${slug}.png`;
  const response=await fetch(url);if(!response.ok){missingIcons.push(item);continue;}
  await writeFile(new URL(`../assets/forms/${slug}.png`,import.meta.url),new Uint8Array(await response.arrayBuffer()));
  icons[item]=`assets/forms/${slug}.png`;
}
// Some item sprites use API-specific bag/held or merge/separate identifiers.
if(missingIcons.length){
  const list=JSON.parse(await fetchText('https://pokeapi.co/api/v2/item?limit=100000')).results;
  for(const item of [...missingIcons]){
    const slug=item.toLowerCase().replace(/[^a-z0-9]+/g,'-');
    for(const candidate of list.filter(entry=>entry.name===slug||entry.name.startsWith(slug+'--'))){
      const details=JSON.parse(await fetchText(candidate.url));if(!details.sprites?.default)continue;
      const response=await fetch(details.sprites.default);if(!response.ok)continue;
      await writeFile(new URL(`../assets/forms/${slug}.png`,import.meta.url),new Uint8Array(await response.arrayBuffer()));
      icons[item]=`assets/forms/${slug}.png`;missingIcons.splice(missingIcons.indexOf(item),1);break;
    }
  }
}
await writeFile(new URL('../data/form-requirements.json',import.meta.url),JSON.stringify({source,updatedAt:new Date().toISOString(),forms,icons},null,2)+'\n');
console.log(JSON.stringify({forms:Object.keys(forms).length,icons:Object.keys(icons).length,missingIcons}));
