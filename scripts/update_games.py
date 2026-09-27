"""Save version-group regional Pokedex rosters. Not encounter/transfer legality."""
import csv
import io
import json
from pathlib import Path
from update_competitive import read

BASE = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/'
EXCLUDED_GAMES = {
    'red-green-japan', 'blue-japan', 'the-isle-of-armor', 'the-crown-tundra',
    'the-teal-mask', 'the-indigo-disk', 'mega-dimension',
}

def rows(filename):
    return list(csv.DictReader(io.StringIO(read(BASE + filename + '.csv'))))

def main():
    pokemon = {row['id']: int(row['species_id']) for row in rows('pokemon')}
    dex_species = {}
    for row in rows('pokemon_dex_numbers'):
        dex_species.setdefault(row['pokedex_id'], set()).add(int(row['species_id']))
    group_species = {}
    for row in rows('pokedex_version_groups'):
        if row['pokedex_id'] == '1':
            continue  # National dex is not a regional game roster.
        group_species.setdefault(row['version_group_id'], set()).update(dex_species.get(row['pokedex_id'], set()))
    games = []
    for row in rows('version_groups'):
        if row['identifier'] in EXCLUDED_GAMES:
            continue
        species = sorted(group_species.get(row['id'], set()))
        if not species:
            continue
        games.append({'id': row['id'], 'name': row['identifier'], 'species': species})
    if len(games) < 15:
        raise ValueError('Unexpected game source')
    path = Path(__file__).resolve().parents[1] / 'data' / 'games.json'
    path.write_text(json.dumps({'games': games, 'pokemonSpecies': pokemon}, separators=(',', ':')), encoding='utf-8')
    print('Saved game Pokedexes:', ', '.join(game['name'] for game in games))

if __name__ == '__main__':
    main()
