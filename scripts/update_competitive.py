"""Refresh compact Champions rosters and Showdown ladder usage. Python 3; no packages.

Run: python scripts/update_competitive.py
Regulations are explicitly versioned; review official announcements before adding one.
Usage is ladder data, not attendance or usage at an actual tournament.
"""
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/'

def read(url):
    with urlopen(Request(url, headers={'User-Agent': 'CompDex-data-updater'}), timeout=30) as response:
        return response.read().decode('utf-8')

def roster(mod):
    source = BASE + f'data/mods/{mod}/formats-data.ts'
    text = read(source)
    legal = []
    for name, block in re.findall(r'^\s*([a-z0-9]+): \{(.*?)^\s*\},', text, re.M | re.S):
        if not re.search(r'isNonstandard:|tier: [\"\']Illegal[\"\']', block):
            legal.append(name)
    if len(legal) < 50:
        raise ValueError('Unexpected roster: refusing to replace saved data')
    return legal, source

def main():
    months = sorted(set(re.findall(r'href="(20\d\d-\d\d)/"', read('https://www.smogon.com/stats/'))), reverse=True)
    output = {'updated': datetime.now(timezone.utc).date().isoformat(), 'current': 'mc', 'regulations': {}}
    for regulation, mod in [('mc', 'champions'), ('mb', 'championsregmb')]:
        legal, source = roster(mod)
        entry = {'name': 'Champions M-' + regulation[-1].upper(), 'legal': legal, 'rosterSource': source, 'formats': {}}
        for kind, format_id in [('doubles', 'gen9championsvgc2026reg' + regulation), ('singles', 'gen9championsbssreg' + regulation)]:
            stats = {'usage': {}, 'month': None, 'source': None, 'rating': 1630}
            for month in months[:3]:
                index = read(f'https://www.smogon.com/stats/{month}/')
                filename = format_id + '-1630.txt'
                if filename not in index:
                    continue
                url = f'https://www.smogon.com/stats/{month}/{filename}'
                for name, percentage in re.findall(r'\|\s*\d+\s*\|\s*([^|]+?)\s*\|\s*([\d.]+)%', read(url)):
                    stats['usage'][re.sub(r'[^a-z0-9]', '', name.lower())] = float(percentage)
                if not stats['usage']:
                    raise ValueError('Unexpected usage table')
                stats.update(month=month, source=url)
                break
            entry['formats'][kind] = stats
        output['regulations'][regulation] = entry
    destination = ROOT / 'data' / 'competitive.json'
    destination.parent.mkdir(exist_ok=True)
    destination.write_text(json.dumps(output, separators=(',', ':')), encoding='utf-8')
    print('Updated', destination)
    for key, entry in output['regulations'].items():
        print(key, len(entry['legal']), 'eligible records;', {kind: stats['month'] for kind, stats in entry['formats'].items()})

if __name__ == '__main__':
    main()
