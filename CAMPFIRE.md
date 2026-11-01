# Live guild campfire

Entry point: **`/campfire`**. This branch adds a working authenticated room and a
separate compact character editor. It does not turn private interest submissions
into accounts or guild members. The landing scene and its flame animation remain
owned by the existing scene components.

## Working implementation

- Better Auth session → D1 session ownership/expiry + published profile + guild
  membership → one `GuildCampfire` Durable Object named by guild ID.
- Authenticated same-origin WebSocket upgrade; identity headers are constructed
  afresh in the gateway, never copied from the browser. No bearer tokens in URLs.
- Shared 1000×600 logical world. The server clamps destinations to x=40…960,
  y=100…560 and issues trajectories at 220 logical units/second. Interrupted
  movement starts at the interpolated server position. Clients interpolate with
  CSS; reduced-motion clients immediately show the destination. No wandering.
- Wave/cheer/heart emotes expire after three seconds; 1.5-second emote cooldown.
  Strict 256-byte message validation; a 10-message burst with five tokens/second
  refill; rate budget persists across reconnects; 50 active occupants maximum.
  One active room connection per account; a second tab replaces the first.
- Socket attachments hold public card, motion, rate and session reference for
  hibernation. No server interval or continuous movement tick. Last movement and
  rate are also saved in DO storage for reconnects after all sockets close.
- Full snapshot on join and client sync. Backoff reconnect (up to 15 seconds),
  25-second sync and a stale-snapshot watchdog. Session/membership/publication are
  checked on messages, snapshots and before broadcast to passive viewers. An
  idle revoked socket is removed on its next sync (normally within 25 seconds).
- Published DTOs include nickname, character plan, professions and short bio.
  They never contain email, contact handles, session IDs or private R2 keys.
  Native card dialogs support Escape/focus restoration. Sprites are buttons;
  the clearing supports arrow keys, click and touch.
- D1 persists character profiles and avatar state. Static SVG fallback is chosen
  from the saved class and reused; it is **hand-drawn**, not generated artwork.
- Explicit **Create animated sprite** starts an optional, saved **Codex Pets-style
  atlas**: 1536×1872 PNG, 8 columns × 9 rows, 192×208 cells and 57 used frames.
  Rows are idle, running-right, running-left, waving, jumping, failed, waiting,
  task-running and review. Timing follows OpenAI hatch-pet's published per-frame
  durations. Walking selects directional rows from the authoritative trajectory;
  wave/heart select waving and cheer selects jumping. Idle animates in place;
  there is no automatic wandering. Reduced motion displays first idle frame.
- Generation makes **up to 10 billable image requests per attempt**: one canonical
  character (optionally grounded in the previous sprite, updated for current
  character choices), then nine separate pose strips through the Images Edits API,
  each grounded in that canonical image and a layout-only guide. The UI discloses
  the request bound and progress. Generation never runs on page rendering or tests.
- Pose strips use the documented 1536×1024 size. Pure-JavaScript `fast-png` decodes
  and assembles the final exact atlas in the Worker; the image model is not trusted
  to produce final atlas geometry. One shared nearest-neighbor transform preserves
  scale/baseline across all rows and retains jumping displacement. Unused cells
  and transparent RGB are zero. Bad dimensions, non-RGBA output, empty/opaque,
  genuinely canvas-clipped, missing/extra or exactly duplicated frames fail safely.
  Extraction detects alpha-connected silhouettes, groups body/equipment fragments
  and ignores small detached noise; it does not reject a complete pose merely for
  crossing a model-generated nominal grid line. Source bounding boxes are persisted
  with each row so assembly crops the detected pose rather than guessing slots.
  A rejected raw row is retained privately under `staging/` for an owner-only
  preview link when available; old failures predating this retention have no preview.
  These checks do not
  prove correct identity/gait: real output still requires visual QA.
- Two atomic attempt reservations/account, including failed provider attempts.
  Concurrent starts are rejected; each completed/started row renews a three-minute
  stale-work lease, with a 25-minute total job deadline;
  reservation tokens fence stale completions. Prompt inputs are snapshotted at
  reservation time. There is a 110-second provider timeout, bounded response bytes,
  PNG signature/dimension validation and no automatic billable provider retry.
  Each alarm performs at most one image request, saving its step and staged R2
  sources durably. A claim per token/step prevents a retried alarm billing twice.
  Only a fully assembled atlas replaces the prior sprite. Staged files are cleaned
  on success/failure; an R2 lifecycle rule on `staging/` is recommended for outages.
- R2 stores private PNG bytes. D1 stores state/key/model/character inputs. Artwork
  is served only to its owner or signed-in members of a shared guild with a
  published target card. Provider errors are not returned or logged to clients.

## Integration handoff — unresolved dependency

At implementation time `/Users/sean/code/launch-party` has uncommitted
`0003_character_and_guilds.sql`, `0004_guild_interest.sql`, character options and
guild/signup routes owned by another agent. It was inspected **read-only**.
There is no parent branch/PR with an authenticated membership contract to stack
on. Its `guilds` is a public directory; interest records are private and do not
prove an authenticated user's membership.

During the animation follow-up, the committed guild directory/recruitment and
shared UI work landed on `main` and was merged into this task branch. Shared
README/package/lockfile conflicts were resolved and the route tree regenerated;
the full local checks passed afterward. This integrates committed work, not the
other checkout's uncommitted files. The authenticated membership grant remains
unimplemented and is still the integration blocker.

Migration `0005_live_campfire.sql` deliberately does **not** create/redefine
`guilds`, modify interest records or depend on uncommitted migrations. It owns:

| Table | Contract |
| --- | --- |
| `campfire_memberships` | `(guild_id, user_id)` primary key; user FK to Better Auth; opaque guild-directory ID |
| `campfire_profiles` | One character/user; nickname, faction, race, class, two professions, bio, explicit publish flag |
| `campfire_avatars` | One state/account; bounded attempts, reservation token, input snapshot, asset key/model |

Forward-only migration `0006_animated_sprite_atlas.sql` adds asset format/revision,
generation progress and safe error codes. Existing single-frame assets remain
usable and are never interpreted as an atlas. They need explicit regeneration to
gain animation; this migration does not reset the two-attempt allowance.

The onboarding/guild owner must supply a **trusted authenticated membership
grant/revoke operation** using real guild IDs, validating the selected guild
exists and the product's join/approval rules. That operation should parameterize
`INSERT INTO campfire_memberships(guild_id,user_id) VALUES(?,?) ON CONFLICT DO NOTHING`
using the server session's user ID. There is intentionally no public membership
grant endpoint in this branch. An operator can seed **synthetic local** members
for verification; the browser tests do this and remove their test users afterward.

After authenticated onboarding, the existing UI can call:

```text
PUT /api/campfire/profile
{ nickname, faction: "Alliance"|"Horde", race, characterClass,
  professions: string[0..2], bio: string[0..280], published: boolean }

POST /api/campfire/generate       optional; requires explicit generation enablement
GET  /api/campfire/me             saved character, memberships, avatar status
GET  /api/campfire/rooms/:guildId/socket   WebSocket upgrade
GET  /api/campfire/avatar/:userId         authorized private artwork
```

Writes require exact Origin and profile writes require a bounded JSON body.
No client user ID is accepted on save/generate. Existing onboarding should map
its bounded choices to this DTO and link to `/campfire`; do not copy its working
tree wholesale. The independent flame PR can be integrated separately.

## Required resources and deployment setup

**No remote resources were provisioned, secrets set, migrations applied remotely,
or production deployment performed for this work.** Before deploying:

1. Review/apply forward-only D1 migrations `0005_live_campfire.sql` and
   `0006_animated_sprite_atlas.sql`, alongside the
   guild owner's migrations when they land. Existing `DB` and Better Auth tables
   are retained. Grant actual authenticated memberships through the agreed flow.
2. Create a private R2 bucket named `launch-party-avatars` (or update the binding
   configuration). Bind it as `AVATAR_BUCKET`. Keep public bucket access off.
3. Review Wrangler's `campfire-v1` SQLite Durable Object migration for the
   `GuildCampfire` and `AvatarGeneration` classes. Bind `GUILD_CAMPFIRES` and
   `AVATAR_JOBS`. `src/worker.ts` exports both and delegates normal pages to
   TanStack Start. DO migrations take effect on an authorized Worker deployment.
4. Retain `BETTER_AUTH_SECRET` and the exact deployed `BETTER_AUTH_URL`. Optional
   image generation needs a server-only `OPENAI_API_KEY` with verified model
   access, an owner-approved spend limit, and `AVATAR_GENERATION_ENABLED=true`.
   **Generation defaults off.** Without these the fallback/room still work.
5. Confirm deployment token permissions cover D1, Worker/DO deployment, R2 binding
   access and the existing custom route. Keep the current domain identifiers.

The current docs (checked 1 Nov 2026) recommend the Images API for this one-image
use case. This code selects `gpt-image-2.5-flare` with medium quality, PNG/transparent
background, `n=1` and a hashed safety identifier. Canonical art is 1024-square;
grounded edits produce 1536×1024 pose strips. **The animated-atlas pipeline has
not been verified with real OpenAI outputs.** A local key is now configured by the
owner, but the implementation tests make no real billable requests. Real successful
generation, identity/gait/framing/transparency inspection, storage reuse and cost
verification remain required before claiming animated-generation acceptance.

References checked:
- https://developers.openai.com/api/docs/guides/image-generation
- https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- https://developers.cloudflare.com/durable-objects/api/alarms/
- https://developers.cloudflare.com/r2/api/workers/workers-api-usage/
- https://developers.openai.com/codex/pets.md
- https://github.com/openai/skills/tree/main/skills/.curated/hatch-pet
  (atlas contract, animation-row semantics and timings; no pet artwork copied)
- https://developers.openai.com/api/reference/resources/images/methods/generate

## Reproducible local verification

Requires Node **22.13+** (the SQLite race test uses `node:sqlite`), pnpm 10.24 and
Chromium. All bindings use local Wrangler state; no remote flags are used.

```sh
pnpm install --frozen-lockfile
pnpm db:local
# Configure .dev.vars from the example with a LOCAL auth secret and
# BETTER_AUTH_URL=http://localhost:3107 for the browser test server.
# Leave OPENAI_API_KEY unset and AVATAR_GENERATION_ENABLED off for these tests.
pnpm exec playwright install chromium
pnpm test
pnpm check
pnpm build
pnpm test:browser
```

Verified locally:
- 18 Vitest checks: malformed/spoofed/oversized frames, movement bounds/speed,
  token bucket/clock rollback, public projection, origin/session query boundary,
  new-instance attachment recovery, passive viewer revocation, emote/snapshot
  delivery, credential-unavailable and forced mocked provider-500 failure, actual SQLite duplicate/stale/attempt
  fencing behavior, atlas timings/state selection, malformed/static strips,
  exact deterministic atlas geometry/transparency/jumping displacement, complete
  poses crossing nominal slot lines with detached noise, and an
  entire mocked ten-request job resumed in a fresh instance on every step.
- Three Playwright tests, including real local Better Auth, D1, Worker and DO WebSockets:
  two accounts see movement/emotes/cards; desktop keyboard; mobile tap; reduced
  motion; native dialog Escape/focus restoration; forced WebSocket interruption
  with automatic reconnect/full snapshot; reload position recovery; unauthorized
  and cross-origin rejection; membership revocation; fallback persistence. Synthetic
  colored atlas fixtures verify actual cell/frame playback and reduced-motion
  freezing without spending API credits. A separate local-only Worker proves
  decoding and assembly run in Cloudflare's actual runtime, not just Node.
  This caught `pngjs`'s incompatible Inflate inheritance; it was replaced by
  `fast-png` before acceptance. The probe has no application bindings or credentials.
- Layout/control visibility at 1280×720, 390×844, 320×568, 844×390 and 1440×900.
  Screenshots are in ignored `test-results/campfire-{desktop,mobile}.png`.
- Local migrations applied; `pnpm check` and `pnpm build` passed. Vite reports
  its existing CSS source-map warning; Node labels its SQLite API experimental.

The hibernation unit test explicitly constructs a fresh room instance using
serialized attachments; an actual deployed eviction/recovery was **not** verified.
Production, real animated generated output, onboarding membership integration and
provider failure with real credentials remain unverified. CI checks all PR target branches
(including stacks), runs unit tests/typecheck/build, and deploys only on a main
push. Browser checks currently require the documented local auth configuration.
