"""Build a small species-category lookup, including alternate forms. Python 3."""
import csv
import io
import json
from pathlib import Path
from update_competitive import read

CSV = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/'
# Conventional pseudo-legendary final evolutions; not every 600-BST Pokemon.
PSEUDO = {149, 248, 373, 376, 445, 635, 706, 784, 887, 998}
ULTRA_BEAST = set(range(793, 800)) | set(range(803, 807))
PARADOX = set(range(984, 996)) | set(range(1005, 1011)) | set(range(1020, 1024))

def main():
    species = {}
    for row in csv.DictReader(io.StringIO(read(CSV + 'pokemon_species.csv'))):
        number = int(row['id'])
        species[number] = (int(row['is_legendary']) | (int(row['is_mythical']) << 1)
                           | (4 if number in PSEUDO else 0)
                           | (8 if number in ULTRA_BEAST else 0)
                           | (16 if number in PARADOX else 0))
    records = {row['id']: species[int(row['species_id'])]
               for row in csv.DictReader(io.StringIO(read(CSV + 'pokemon.csv')))}
    if len(records) < 1000 or records.get('150') != 1 or records.get('151') != 2:
        raise ValueError('Unexpected category source; refusing to save')
    destination = Path(__file__).resolve().parents[1] / 'data' / 'categories.json'
    destination.parent.mkdir(exist_ok=True)
    destination.write_text(json.dumps(records, separators=(',', ':')), encoding='utf-8')
    print('Updated', len(records), 'Pokemon category records')

if __name__ == '__main__':
    main()
