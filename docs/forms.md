# Evolution paths and gameplay forms

The Pokémon info page keeps regional evolution routes in the upper evolution
line. A selector below the heading offers **Main**, then the available Alolan,
Galarian, Hisuian, or Paldean paths. It follows the form being viewed, including
regional descendants such as Perrserker. Families without regional branches do
not show an unnecessary selector. Eevee retains its evolution chooser.

The lower selector replaces the previous Mega-only section. It offers only
available categories for the whole displayed evolution family: Mega Evolution,
Gigantamax, Primal Reversion, Origin, fusion, appliance, type, drive, battle, and
other gameplay forms. Mega is selected first, then Gmax, then the next available
category. Opening an alternate form directly selects its category instead.
Multiple forms keep the existing card-and-arrow layout. Cosmetic palettes,
costumes, and travel poses are omitted; gameplay differences in stats, types,
abilities, and known move-dependent forms are included.

The selected regional path determines which transformations are offered.
Galarian Meowth does not get the original Meowth's Gmax. The Alolan Raichu path
still contains ordinary Pikachu, so Pikachu's Gmax remains available. Regional
base forms are not duplicated in the lower form selector.

## Requirements and divider items

Requirements appear below each form card. Item-based categories put their items
in the divider: Primal orbs, Origin items, fusion tools, masks, and other supported
items. Mega keeps the existing Mega symbol when a stone is required; Gmax uses
the Dynamax Band. At most three representative item icons occupy a category
divider, with each card's text describing its own requirement. Categories without
an item, such as Ash-Greninja, use a continuous divider with no center gap.
Mega Rayquaza also has no stone icon because it requires Dragon Ascent instead.

Requirements distinguish automatic battle changes, fixed encounter/gender/size
forms, and item changes. They include game-specific exceptions where relevant:
Ash-Greninja's transformation applies to the Alola games, Gmax to eligible
Sword/Shield battles, and Eternamax is labeled as a story boss form. These are
descriptions, not assertions that a form is available in every game. Unknown
future requirements are explicitly labeled as not yet documented instead of
inventing a condition.

Arceus/Silvally type forms and Genesect Drive forms are read from Pokémon-form
resources rather than species varieties. Their card links preserve a `form`
query parameter, and the main info page loads that form's types and artwork.
They keep their base Pokémon ID and base stats. Existing shiny/artwork settings
and image fallbacks also apply to these cards.

## Data and maintenance

- [PokéAPI species and form resources](https://pokeapi.co/docs/v2#pokemon-species)
  provide varieties, evolution paths, types, and sprites.
- [Pokémon Showdown's Pokédex metadata](https://github.com/smogon/pokemon-showdown/blob/master/data/pokedex.ts)
  provides required items, moves, abilities, source forms, and cosmetic markers.
- [Showdown abilities](https://github.com/smogon/pokemon-showdown/blob/master/data/abilities.ts),
  [Generation 7 ability behavior](https://github.com/smogon/pokemon-showdown/blob/master/data/mods/gen7/abilities.ts),
  [items](https://github.com/smogon/pokemon-showdown/blob/master/data/items.ts), and
  [moves](https://github.com/smogon/pokemon-showdown/blob/master/data/moves.ts)
  are references for the explanatory requirements in `js/forms.js`.
- [The official Gigantamax explanation](https://swordshield.pokemon.com/en-ca/gameplay/gigantamax/)
  describes eligible Pokémon and the distinction from ordinary Dynamax.
- Local item icons come from the [PokéAPI sprite repository](https://github.com/PokeAPI/sprites/tree/master/sprites/items).

Run `node scripts/update_form_requirements.mjs` to refresh the local metadata
snapshot and item icons. The updater reads public TypeScript as text; it never
executes downloaded code. Fixed, explanatory condition text lives in
`js/forms.js` and should be reviewed when game mechanics change.

The browser suite checks the family-wide category switch, Mega X/Y, Gmax
navigation, regional Meowth and Alolan Raichu, Primal orbs, Ash-Greninja's plain
divider, both Urshifu/Toxtricity Gmax variants, Rotom, Deoxys, Origin and fusion
forms, Galarian Darmanitan, Arceus type links, Genesect Drives, excluded cosmetic
forms, and unclipped mobile layouts.
