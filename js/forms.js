// Gameplay varieties and their change conditions. Cosmetic palettes/costumes stay out.
(() => {
  const region=name=>String(name).match(/(?:^|-)(alola|galar|hisui|paldea)(?:-|$)/)?.[1]||'main';
  const labels={main:'Main',alola:'Alolan',galar:'Galarian',hisui:'Hisuian',paldea:'Paldean'};
  const categories={mega:'Mega Evolution',gmax:'Gigantamax',primal:'Primal Reversion',origin:'Origin formes',fusion:'Fusion forms',appliance:'Appliance forms',type:'Type forms',drive:'Drive forms',battle:'Battle transformations',other:'Other forms'};
  let metadataRequest;
  let itemIcons={};
  const load=()=>metadataRequest ||= fetch('data/form-requirements.json').then(r=>{if(!r.ok)throw new Error('Form metadata unavailable');return r.json();}).then(data=>{itemIcons=data.icons||{};return data;}).catch(error=>{metadataRequest=null;throw error;});
  const excluded=name=>/-cap$|pikachu-(?:rock-star|belle|pop-star|phd|libre|cosplay)|magearna-original|zarude-dada|(?:koraidon|miraidon)-(?:limited|sprinting|swimming|gliding|low-power|drive|aquatic|glide)|minior-(?!red$)/.test(name);
  const signature=p=>JSON.stringify([p.stats.map(s=>s.base_stat),p.types.map(t=>t.type.name),p.abilities.map(a=>[a.ability.name,a.is_hidden])]);
  function gameplay(p,normal,metadata){
    if(excluded(p.name)||metadata?.cosmetic)return false;
    return region(p.name)!=='main'||/-mega(?:-|$)|-gmax$|-primal$|-totem(?:-|$)/.test(p.name)||metadata?.battleOnly||signature(p)!==signature(normal)||/tatsugiri-(droopy|stretchy)|basculin-white-striped|keldeo-resolute/.test(p.name);
  }
  function category(p,metadata){
    if(/-mega(?:-|$)/.test(p.name))return 'mega';
    if(/-gmax$/.test(p.name))return 'gmax';
    if(/-primal$/.test(p.name))return 'primal';
    if(p.formResource)return p.species.name==='genesect'?'drive':'type';
    if(/-origin$/.test(p.name))return 'origin';
    if(/^(kyurem-(black|white)|necrozma-(dusk|dawn)|calyrex-(ice|shadow))$/.test(p.name))return 'fusion';
    if(p.species.name==='rotom')return 'appliance';
    return metadata?.battleOnly||/-ash$|-battle-bond$|-eternamax$/.test(p.name)?'battle':'other';
  }
  const conditions={
  "greninja-battle-bond": "Battle Bond",
  "greninja-ash": "Battle Bond · Defeat a Pokémon",
  "castform-sunny": "Forecast · Sunlight",
  "castform-rainy": "Forecast · Rain",
  "castform-snowy": "Forecast · Hail / Snow",
  "darmanitan-zen": "Zen Mode · HP ≤ 50%",
  "darmanitan-galar-zen": "Zen Mode · HP ≤ 50%",
  "aegislash-blade": "Stance Change · Damaging move",
  "meloetta-pirouette": "Use Relic Song",
  "wishiwashi-school": "Schooling · Level 20+ · HP > 25%",
  "mimikyu-busted": "Disguise · Take a hit",
  "mimikyu-totem-busted": "Disguise · Take a hit",
  "eiscue-noice": "Ice Face · Physical hit",
  "morpeko-hangry": "Hunger Switch · End of turn",
  "palafin-hero": "Zero to Hero · Switch out",
  "zygarde-complete": "Power Construct · HP ≤ 50%",
  "zygarde-10-power-construct": "Power Construct",
  "zygarde-50-power-construct": "Power Construct",
  "zygarde-10": "Assemble 10% Forme",
  "necrozma-dusk": "N-Solarizer · Solgaleo",
  "necrozma-dawn": "N-Lunarizer · Lunala",
  "necrozma-ultra": "Ultranecrozium Z",
  "kyurem-black": "DNA Splicers · Zekrom",
  "kyurem-white": "DNA Splicers · Reshiram",
  "calyrex-ice": "Reins of Unity · Glastrier",
  "calyrex-shadow": "Reins of Unity · Spectrier",
  "hoopa-unbound": "Prison Bottle",
  "shaymin-sky": "Gracidea · Daytime",
  "giratina-origin": "Griseous Orb / Griseous Core",
  "dialga-origin": "Adamant Crystal",
  "palkia-origin": "Lustrous Globe",
  "terapagos-terastal": "Tera Shift",
  "terapagos-stellar": "Tera Orb",
  "eternatus-eternamax": "Story encounter only",
  "cramorant-gulping": "Gulp Missile · Surf / Dive · HP > 50%",
  "cramorant-gorging": "Gulp Missile · Surf / Dive · HP ≤ 50%",
  "toxtricity-low-key": "Level 30 · Low Key nature",
  "floette-eternal": "Special event form",
  "ursaluna-bloodmoon": "Perrin’s quest · Kitakami",
  "urshifu-rapid-strike": "Scroll of Waters / Tower of Waters",
  "basculin-white-striped": "Wild encounter",
  "gimmighoul-roaming": "Pokémon GO",
  "rockruff-own-tempo": "Own Tempo",
  "lycanroc-midnight": "Level 25 · Nighttime",
  "lycanroc-dusk": "Own Tempo · Level 25 · Dusk",
  "wormadam-sandy": "Female Burmy · Sandy Cloak · Level 20",
  "wormadam-trash": "Female Burmy · Trash Cloak · Level 20"
};
  const appliance={heat:'microwave oven',wash:'washing machine',frost:'refrigerator',fan:'electric fan',mow:'lawn mower'};
  const plates={bug:'Insect',dark:'Dread',dragon:'Draco',electric:'Zap',fairy:'Pixie',fighting:'Fist',fire:'Flame',flying:'Sky',ghost:'Spooky',grass:'Meadow',ground:'Earth',ice:'Icicle',poison:'Toxic',psychic:'Mind',rock:'Stone',steel:'Iron',water:'Splash'};
  function requirement(p,metadata={}){
    if(/-mega(?:-|$)/.test(p.name))return metadata.item||metadata.items?.join(' / ')||(metadata.move?`Know ${metadata.move}`:'');
    if(conditions[p.name])return conditions[p.name];
    if(p.formResource){
      const suffix=p.name.split('-').at(-1);
      const title=value=>value.charAt(0).toUpperCase()+value.slice(1);
      if(p.species.name==='genesect')return title(suffix)+' Drive';
      const type=p.types[0].type.name;
      return p.species.name==='silvally'?title(type)+' Memory':(plates[type]||title(type))+' Plate';
    }
    if(/-gmax$/.test(p.name))return 'Dynamax Band';
    if(p.species.name==='rotom')return appliance[p.name.split('-').at(-1)]||'Matching appliance';
    if(p.species.name==='deoxys')return 'Meteorite';
    if(/-therian$/.test(p.name))return 'Reveal Glass';
    if(/-totem(?:-|$)/.test(p.name))return 'Totem encounter / Gift';
    if(/(?:pikachu|eevee)-starter/.test(p.name))return 'Let’s Go partner';
    if(p.species.name==='oricorio')return (({'pom-pom':'Yellow','pau':'Pink','sensu':'Purple'})[p.name.replace('oricorio-','')]||'Matching')+' Nectar';
    if(p.species.name==='tatsugiri')return 'Wild encounter';
    if(/^(pumpkaboo|gourgeist)-/.test(p.name))return 'Size when caught';
    if(/female$/.test(p.name))return 'Female';
    if(p.species.name==='squawkabilly'||p.name==='basculin-blue-striped')return 'Wild encounter';
    if(p.name.startsWith('minior-'))return 'Shields Down · HP ≤ 50%';
    if(metadata.item)return metadata.item;
    if(metadata.items?.length)return metadata.items.join(' / ');
    if(metadata.move)return 'Know '+metadata.move;
    if(metadata.ability)return metadata.ability;
    return 'Game-specific requirement';
  }

  function icons(group,entries){
    if(group==='mega')return entries.some(entry=>entry.metadata.item||entry.metadata.items?.length)?[{src:'assets/mega-evolution.png',alt:'Mega Evolution symbol'}]:[];
    if(group==='gmax')return [{src:'assets/forms/dynamax-band.png',alt:'Dynamax Band'}];
    const special={
      'giratina-origin':['Griseous Orb','Griseous Core'],'dialga-origin':['Adamant Crystal'],'palkia-origin':['Lustrous Globe'],
      'necrozma-dusk':['N-Solarizer'],'necrozma-dawn':['N-Lunarizer'],'necrozma-ultra':['Ultranecrozium Z'],
      'kyurem-black':['DNA Splicers'],'kyurem-white':['DNA Splicers'],'calyrex-ice':['Reins of Unity'],'calyrex-shadow':['Reins of Unity'],
      'shaymin-sky':['Gracidea'],'hoopa-unbound':['Prison Bottle'],'terapagos-stellar':['Tera Orb']
    };
    const names=new Set();
    for(const entry of entries){
      const p=entry.pokemon;
      const items=special[p.name]||(/-therian$/.test(p.name)?['Reveal Glass']:p.formResource?[p.species.name==='genesect'?'Burn Drive':p.species.name==='silvally'?'Fire Memory':'Flame Plate']:[entry.metadata.item,...(entry.metadata.items||[])]);
      items.filter(Boolean).forEach(item=>names.add(item));
    }
    return [...names].filter(item=>itemIcons[item]).slice(0,3).map(item=>({src:itemIcons[item],alt:item}));
  }
  function fromForm(base,form){
    const sprites={...form.sprites,versions:{},other:{'official-artwork':{front_default:form.sprites.front_default,front_shiny:form.sprites.front_shiny}}};
    return {...base,name:form.name,types:form.types,sprites,formResource:`https://pokeapi.co/api/v2/pokemon-form/${form.name}/`,basePokemonName:base.name};
  }
  window.CompDexForms={load,region,labels,categories,gameplay,category,requirement,icons,fromForm};
})();
