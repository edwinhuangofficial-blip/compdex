# Responsive layout and verification

## What changed

The published site provides the visual baseline: 236.5px-wide desktop cards,
22px desktop body/card text, 112px card artwork, and a 48px search field with
28px text. These sizes are retained on larger CSS viewports. The main grid now
uses a centered 1580px homepage area to fit five original-size cards, with fewer columns when
space becomes limited. The intentional outer side areas remain available for
future content; wider screens do not stretch the cards or add a sixth column.
The detail page retains its 1320px content limit.

`css/responsive.css` owns responsive layout across all three pages. It replaces
fixed detail-page columns and prevents the sticky sidebar from extending beyond
the viewport. Desktop cards use 20px type labels without a scaling transform;
smaller screens use comfortable 18px card text and 100px artwork. Colors, borders,
hover effects, artwork preferences, and existing animations remain intact.
Superseded layout media queries were removed from `css/index.css`,
`css/shared.css`, and `css/pokemoninfo.css`.

`index.html` wraps the existing filter controls in a native dialog and adds its
heading and close button. `js/homepage.js` switches that single panel between a
persistent nonmodal sidebar and a modal dialog. It preserves the existing DOM,
filter values, and filtering logic. All three HTML pages load the new stylesheet.

## Layout rules

| Available CSS viewport | Behavior |
|---|---|
| Above 1024px wide | 244px sticky sidebar, independently scrollable below the measured header; results fill remaining width. |
| At or below 1024px wide | Filters button opens a scrollable modal with Close, Escape, outside-click dismissal, and focus wrapping/restoration. Detail evolution moves below primary information. |
| At or below 1120px wide | Header search moves to its own row, including space for the longer Pokémon Info label. |
| At or below 760px wide | Cards use 18px text/100px artwork; artwork/stats stack; compact header buttons retain accessible names; Pokémon number navigation moves into page flow. |
| At or below 420px wide | Card minimum width changes from 180px to 150px, allowing two readable cards on 375px/390px screens. Stats and type matchups adapt. |
| At or below 600px tall | Header and results toolbar stop pinning over content; sidebar keeps a viewport height limit. |

The sidebar's scroll limit subtracts the actual header height and panel spacing
from `100dvh`. Filter dropdowns expand inside that scroll area and have their own
height limit, including the types menu. Settings dropdowns also expand in flow
inside their scrollable dialog. Opening menus cannot place options outside an
unscrollable clipped area. Desktop page scrolling remains available.

## Automated results

On October 18, 2026, Playwright with installed Chrome 143 passed **97/97 checks**
against a local server and live PokéAPI data. No uncaught page errors occurred.
The suite records actual `innerWidth`, `innerHeight`, `devicePixelRatio`, and
`visualViewport.scale`; the last stays 1 (100% browser zoom).

Both home and Bulbasaur detail pages were checked at every viewport below:

- 1920×1080, 1536×864, 1440×900, 1366×768, 1280×720, 1024×768,
  768×1024, 390×844, and 375×667.
- Boundary cases 1320×900, 1121×768, 1120×768, 1025×768, 761×768, and 760×768; short window 1280×500.
- Every scaling equivalent in the following table, also repeated with 120 CSS
  pixels subtracted from height to allow for browser chrome and the taskbar.

| Physical display | Windows scaling equivalent | CSS viewport before browser chrome | Home columns |
|---|---|---|---|
| 2880×1800 | 100% | 2880×1800 | 5 |
| 2880×1800 | 125% | 2304×1440 | 5 |
| 2880×1800 | 150% | 1920×1200 | 5 |
| 2880×1800 | 175% | 1646×1029 | 5 |
| 2880×1800 | 200% | 1440×900 | 4 |
| 3072×1920 | 100% | 3072×1920 | 5 |
| 3072×1920 | 125% | 2458×1536 | 5 |
| 3072×1920 | 150% | 2048×1280 | 5 |
| 3072×1920 | 175% | 1755×1097 | 5 |
| 3072×1920 | 200% | 1536×960 | 4 |

Fractional viewport sizes are rounded to the nearest CSS pixel. Display scaling
is emulated through viewport dimensions and device scale factor; the suite does
not change Windows display settings.

Additional checks cover reduced CSS viewports equivalent to 125% and 150% browser
zoom from 1920×1080, 1440×900, and 1280×720. These are layout equivalents rather
than changes to Chrome's zoom setting.

Assertions check the centered 1580px homepage cap, 236.5px desktop card width,
five-column desktop default, preserved
22px text/112px artwork, page overflow, header overlap, readable card widths, panel height,
access to the final filter and final game option, Escape behavior, keyboard focus,
outside-click closing, filter state after closing/reopening/resizing, reset, type
selection, search suggestions, search navigation, stats layout, settings options,
and final settings actions. Eevee, Wurmple, and Tyrogue evolution layouts were
checked at 1440×900, 768×1024, and 375×667. The not-found page was checked at
1440×900 and 375×667. Desktop and small-mobile screenshots were visually inspected.

## Reproduce locally

No build step or runtime dependencies were added to the site. Serve this directory
with any static server, for example `python -m http.server 8000`, and open
`http://localhost:8000/index.html?related=0` at 100% browser zoom.

The optional browser suite needs Node.js and Playwright available to Node. It
starts and stops its own local server and uses the live API, so network access is
required. From the repository root:

```powershell
# With Playwright installed in your development environment:
$env:BROWSER_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
node scripts/test_responsive.cjs
```

If Playwright is installed outside normal Node module resolution, set `NODE_PATH`
to its containing `node_modules` directory. Omit `BROWSER_PATH` to use Playwright's
bundled Chromium. Results and screenshots are written to the ignored directory
`artifacts/responsive/`.

## Remaining manual verification

Actual 3K laptop hardware, Windows text rasterization/scaling, and browser chrome
vary. On each display, set Windows scaling to 100%, 125%, 150%, 175%, and 200%,
keep browser zoom at 100%, and check the actual CSS viewport in DevTools using
`({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio })`. Scroll to
the final sidebar filter, open its last menu option, resize the window, and check
the detail page. Physical comfort and visual proportions should be confirmed on
the user's desktop and laptop. Firefox, Safari, touch hardware, and screen-reader
behavior were not manually tested in this run.
