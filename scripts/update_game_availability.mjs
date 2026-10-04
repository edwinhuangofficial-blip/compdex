// Refresh public PokéAPI encounter, gift, and evolution records without browser scans.
import {writeFile} from 'node:fs/promises';
const base = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/';
async function rows(name) {
  const response = await fetch(base + name + '.csv');
  if (!response.ok) throw new Error(`${name}: ${response.status}`);
  const lines = (await response.text()).trim().split(/\r?\n/);
  const headers = lines.shift().split(',');
  return lines.map(line => Object.fromEntries(line.split(',').map((value, i) => [headers[i], value])));
}
const names = ['versions','version_groups','pokemon','pokemon_species','pokemon_forms','pokemon_evolution','encounters','encounter_slots','encounter_condition_values','encounter_condition_value_map','locations'];
const data = Object.fromEntries(await Promise.all(names.map(async name => [name, await rows(name)])));
const map = name => new Map(data[name].map(row => [row.id, row]));
const groups = map('version_groups'), pokemon = map('pokemon'), species = map('pokemon_species'), forms = map('pokemon_forms');
const slots = map('encounter_slots'), conditions = map('encounter_condition_values'), locations = map('locations');
const blockedEncounters = new Set(data.encounter_condition_value_map.filter(row => {
  const condition = conditions.get(row.encounter_condition_value_id)?.identifier || '';
  return condition.startsWith('slot2-') && condition !== 'slot2-none';
}).map(row => row.encounter_id));
const records = new Map();
for (const row of data.encounters) {
  const method = Number(slots.get(row.encounter_slot_id)?.encounter_method_id);
  // Exclude trades and distributions supplied by another game/device.
  if (method === 36 || (method >= 45 && method <= 50) || blockedEncounters.has(row.id)) continue;
  if (!records.has(row.version_id)) records.set(row.version_id, new Set());
  records.get(row.version_id).add(Number(row.pokemon_id));
}
const defaults = new Map(data.pokemon.filter(row => row.is_default === '1').map(row => [row.species_id, Number(row.id)]));
const familyRegion = {'1':1,'2':1,'3':2,'4':2,'5':3,'6':3,'7':1,'8':4,'9':4,'10':2,'11':5,'14':5,'15':6,'16':3,'17':7,'18':7,'19':1,'20':8};
const formPokemon = id => id ? Number(forms.get(id)?.pokemon_id) : null;
const output = data.versions.filter(version => ![12,13,21,22,26,27,28,29,31].includes(Number(version.version_group_id))).map(version => {
  const group = groups.get(version.version_group_id);
  const direct = records.get(version.id);
  if (!direct) return {...version, available:false, pokemon:[]};
  const roster = new Set(direct);
  const generation = Number(group.generation_id), order = Number(group.order);
  const region = familyRegion[version.version_group_id];
  let changed = true;
  while (changed) {
    changed = false;
    for (const evolution of data.pokemon_evolution) {
      const child = species.get(evolution.evolved_species_id);
      if (!child || Number(child.generation_id) > generation || evolution.evolution_trigger_id === '2' || evolution.needs_multiplayer === '1') continue;
      const evolutionGroup = groups.get(evolution.version_group_id);
      if (!evolutionGroup || Number(evolutionGroup.order) > order) continue;
      if (evolution.region_id && Number(evolution.region_id) !== region) continue;
      if (evolution.location_id && Number(locations.get(evolution.location_id)?.region_id) !== region) continue;
      if (evolution.is_default !== '1' && evolution.version_group_id !== version.version_group_id && (Number(evolutionGroup.generation_id) !== generation || familyRegion[evolution.version_group_id] !== region)) continue;
      const from = formPokemon(evolution.required_pokemon_form_id) || defaults.get(child.evolves_from_species_id);
      const to = formPokemon(evolution.evolved_pokemon_form_id) || defaults.get(child.id);
      if (roster.has(from) && to && !roster.has(to)) { roster.add(to); changed = true; }
    }
  }
  return {...version, available:true, pokemon:[...roster].sort((a,b) => a-b), direct:[...direct].sort((a,b) => a-b)};
});
const payload = {source:base, updatedAt:new Date().toISOString(), scope:'Recorded encounters and gifts, plus derived non-trade evolutions. Coverage is incomplete; breeding, events, and some form changes are not represented.', versions:output};
await writeFile(new URL('../data/game-availability.json', import.meta.url), JSON.stringify(payload));
console.log(`Saved ${output.filter(version => version.available).length} version rosters; ${output.filter(version => !version.available).length} versions have no encounter coverage.`);
