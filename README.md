# CompDex

A Pokédex for people playing and battling Pokémon, using information from PokéAPI.

## Project structure

- Root HTML files: home, Pokémon details, and not-found pages.
- `css/`: shared styles and page-specific stylesheets.
- `js/`: API access, home-page behavior, evolution display, and settings.
- `assets/`: images and their attribution and license files.
- `data/`: generated game, availability, category, and competitive data.
- `scripts/`: utilities that refresh the generated data.

`favicon.svg` stays at the root for the site icon. Page URLs stay at the root as well.

## Run locally

From the project directory, run `python -m http.server 8000`, then open
<http://localhost:8000>. No build step is required.
