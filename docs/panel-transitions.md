# Panel navigation and resizing

Internal links in the home menu, account screens, recovery flow and guild
navigation use `AppLink`, a small wrapper around TanStack Router's `Link`.
It preserves query parameters, hashes, modifier/new-tab behavior and native
downloads. External links, API callbacks and asset URLs use ordinary anchors.
Client navigation keeps the shared theme provider alive, avoiding a document
reload and a flash back to the default scene.

`SceneNavigation` enables TanStack's native View Transition integration when
reduced motion is not requested. The shared `scene-panel` snapshot interpolates
position, width and height over 300ms, with a short content crossfade. The
background and page chrome do not receive a full-screen fade. Campfire setup and
welcome cards participate in the same shared-element naming. After a route
change, the new primary heading receives focus without forcing a scroll.

`ScenePanel` is the shared frame for home, account/auth/recovery and guild/interest
cards. A ResizeObserver measures its inner flow-root content, including the pixel
frame's decorative ornament and padding. Changes within a page—form steps,
validation, async character data or login state—animate the actual frame height
over 280ms, then release it back to natural sizing. Interrupted animations start
from their current height. Width/viewport reflows settle naturally rather than
starting a second resize animation. Async hash targets are aligned once after
expansion so links to guilds/account sections still scroll correctly.

Account cards are vertically centered when space allows and remain internally
scrollable on short/mobile screens. The animation does not clone interactive
forms, add focusable duplicates, or retain private content in an application
cache. Home login/signout refreshes the actual Better Auth session in place;
private auth-return destinations, expired sessions and OAuth callbacks retain
their existing clean-document/server checks. The account page avoids issuing an
expiry redirect simultaneously with its own explicit signout redirect.

Reduced-motion changes disable native route animation and cancel active frame
resizing. Browsers without View Transitions keep client-side links and natural
navigation; browsers without ResizeObserver keep naturally sized panels.
Cross-document transitions are intentionally not opted in: redirects to Google
and full authentication round-trips should not produce aborted-transition errors.

## Local verification

With local D1 migrations applied and an ignored local-only auth configuration
matching `http://localhost:3153`, start Vite on that origin, then run:

```sh
pnpm test:transitions
AUTH_TEST_ORIGIN=http://localhost:3153 pnpm test:home
AUTH_TEST_ORIGIN=http://localhost:3153 pnpm test:auth
AUTH_TEST_ORIGIN=http://localhost:3153 pnpm test:account
```

The transition script records a real native animation at its midpoint and checks
that the frame height is between its source and destination sizes. It also checks
retained document/theme state, recovery/back navigation, same-page form resizing,
reduced motion, home auth-state changes, signed-in navigation, heading focus,
mobile/landscape bounds and an unavailable View Transition API. Synthetic account
fixtures are removed; screenshots stay in ignored `test-results/`.

Browser suites should run sequentially because they share the output directory.
The existing home script waits for the recovery heading before filling its email
field: with client navigation, the old and new forms briefly have the same label.
