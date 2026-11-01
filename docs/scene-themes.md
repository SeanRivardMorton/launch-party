# Background scenery

The landing page and live `/campfire` share a palette registry, preference hook,
native keyboard/screen-reader-accessible picker, and original SVG pixel landscapes.
The room's positions, movement bounds, sprites and fire remain unchanged. A quiet
ground overlay in the live room keeps character names and bodies legible.
Portrait-only edge landmarks keep forests and mesas recognizable when the wide
scene is cropped. Short landscape rooms keep the picker visible in their header.

| Race | Automatic scenery | Visual landmarks |
| --- | --- | --- |
| Orc, Troll | Durotar | Rust-orange stratified mesas, dry scrub, sparse acacia/cactus silhouettes; a small coastal inlet nods to Echo Isles |
| Tauren | Mulgore | Layered green grasslands below mesas, flat-canopy trees, a distant neutral trail marker |
| Undead | Tirisfal Glades | Dark pines, skeletal trees, horizontal green mist |
| Night Elf | Darnassus | Violet moonlit ancient forest, hanging luminous foliage and small glowing mushrooms, inspired by Darnassus/Teldrassil |
| Human | Elwynn Forest | Warm green broadleaf woodland, golden wildflowers |
| Dwarf, Gnome | Dun Morogh | Stepped snowy peaks, snow-tipped pines and a blue-white clearing |
| Skyborne, Undecided, missing/unknown race, signed out | Moonwell | Neutral existing night clearing; no invented lore mapping |

Tavern and Moonwell remain selectable. `ai-zeroth-theme` continues to hold a
single string: old `tavern`/`moonwell` preferences remain **explicit** choices;
new visitors and invalid/missing values use `automatic`. Any manual choice wins
over race until Auto is chosen again. Storage failures only lose persistence,
not the ability to select scenery. Storage events synchronize open tabs.

Automatic mode reads only `/api/campfire/me` after the existing auth client
confirms a session. It never looks up interest records, uses email as a key, or
changes server/public DTOs. Only the race is held transiently in component state;
no private profile data is written to storage or SSR HTML. The landing page
refreshes on focus/visibility and every 15 seconds while visible in Auto mode.
The live campfire reuses its already-authorized profile and updates immediately
after a character save. Failed/missing profile data gets the neutral fallback.
The initial server/client render is always the neutral Auto state before effects
restore preferences, avoiding hydration mismatches (a brief neutral paint is
intentional).

Account/auth, signup, guild directory and guild management screens intentionally
retain their existing fixed Moonwell/card theme; these are form/document screens,
not scenery surfaces. No account/menu/auth ownership changes are included.

## Local verification

Install with `pnpm install --frozen-lockfile`, then `pnpm check`, `pnpm test`,
and `pnpm build`. For the isolated browser suite use an ignored `.dev.vars` with
`BETTER_AUTH_URL=http://localhost:3127` and a synthetic local
`BETTER_AUTH_SECRET` (at least 32 characters), then:

```sh
pnpm db:local
pnpm exec playwright test --config playwright.themes.config.ts
```

The suite runs on port 3127, creates/deletes synthetic local users, and adds a
local-only room membership. It never calls generation or production services.
Screenshots for all themes at desktop, 320px/390px portrait and 844px landscape
are written to ignored `test-results/themes/`. Unit tests cover all race mappings,
neutral fallback, legacy/corrupt preferences and manual priority. Browser tests
exercise real profile changes and saved preferences, signed-out fallback,
cross-tab updates, denied storage/API failure, keyboard selection, QR viewport
visibility and painted black modules (not just an empty white container),
scroll bounds, and reduced motion.
