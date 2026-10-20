# CompDex

A Pokédex for people playing and battling Pokémon, using information from PokéAPI.

## Project structure

- Root HTML files: home, Pokémon details, and not-found pages.
- `css/`: shared styles and page-specific stylesheets.
- `js/`: API access, home-page behavior, evolution display, and settings.
- `assets/`: images and their attribution and license files.
- `data/`: generated game, availability, category, and competitive data.
- `scripts/`: data refresh utilities and responsive browser checks.
- `docs/`: layout behavior and testing notes.

`favicon.svg` stays at the root for the site icon. Page URLs stay at the root as well.

## Run locally

From the project directory, run `python -m http.server 8000`, then open
<http://localhost:8000>. No build step is required.

## Responsive layout

Layouts use CSS viewport dimensions rather than physical resolution. Wide windows
show a scrollable filter sidebar; windows at or below 1024 CSS pixels show a
Filters button that opens the same controls in a dialog. The centered content area
uses a 1580px maximum to fit five original-size cards while retaining side space.
Smaller windows use fewer columns. The detail page stays left-aligned and uses
the remaining desktop width for a horizontal evolution line on the right.

See [responsive testing notes](docs/responsive-testing.md) for the 3K scaling
matrix, breakpoints, local test commands, and remaining hardware verification.

## Welcome popup

The homepage introduces CompDex once per new tab visit with a popup matching the
current theme and accent color. Reloading or returning Home in that tab does not
repeat it. “Don’t show this next time” saves the choice in this browser. Open
Settings → “Display Welcome pop up?” under Animations controls future homepage visits.
Check it and press Save to show the popup on a future new tab visit, or uncheck it
to hide it.

The sun/moon slider beside Share changes the theme immediately and saves it in
this browser. It stays synchronized with the Theme setting, including System mode.

## Evolution and alternate forms

Regional evolution paths appear under Main/region choices above the evolution
cards. The lower selector covers available gameplay forms for the family, with
item dividers and change requirements. See [form behavior and data sources](docs/forms.md).
