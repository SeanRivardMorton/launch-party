# PRD: ai-zeroth

> **Agent handoff:** Read this document, `AGENTS.md`, and the relevant source files before starting work. This PRD describes the next product milestone; it is not a claim that the features below already exist. Implement one small story at a time and report what was actually verified.

**Product:** ai-zeroth  
**Tagline:** Your people. Your next adventure.  
**Prepared:** 1 November 2026  
**Project root:** `/Users/sean/code/launch-party`  
**Current public URL:** https://launchparty.thunkoid.com  
**Status:** Validation landing page deployed; full product not implemented.  
**Event:** DevDay Exchange Community Hackathon, London — https://luma.com/dde-ldn-hack  
**Submission deadline:** 1 November 2026, 17:00 Europe/London (GMT on this date).

### Latest owner scope update — post-hackathon home

The hackathon is over. Remove the large presentation QR code and replace it with
a centered, session-aware home panel. Signed-out visitors should see email/password
login, Google sign-in, a registration option and password recovery. Signed-in
users should see **Characters**, **Guild** and **Calendar** navigation. Reuse saved
character data and approved memberships; keep the separate interest form available
without promoting submissions into accounts. Preserve the animated scenery and
race-based themes. Calendar initially provides an authenticated month view, with
event scheduling still a separate feature. Google OAuth and recovery email require
the operator's credentials/sender setup documented in `AUTH.md`; unconfigured
providers must not pretend to work. This supersedes the QR presentation requirement
and earlier blanket exclusion of password recovery below.

### Earlier owner scope update — character signup and guild discovery

The owner subsequently requested a text-free presentation landing screen with a large signup QR code, followed by signup collecting faction (Alliance/Horde), planned race/class, multiple fulfillable roles and professions. Prospects must also be able to list their guild publicly or discover a guild to join. This supersedes the guild-directory exclusion below for this lightweight milestone; full guild administration remains out of scope.

Implemented locally: four-step private interest signup, additive migrations `0003_character_and_guilds.sql` and `0004_guild_interest.sql`, a public guild directory at `/guilds`, and account-free guild publication at `/guilds/new` with explicit consent. The owner subsequently requested that Launchparty host guild invites: publication now generates an internal page at `/guilds/<id>` and a copyable link. Guild-page visitors register private joining interest through `/signup?guild=<id>`, with guild faction preselected and explicit joining consent. Repeated submissions create one signup/guild association. External invite links are no longer required or used. No player-interest records become public. This does not create in-game membership or an approval inbox, and is independent of the future authenticated player-matching milestone described below. See README for verification and deployment instructions. The new mobile form/directory screens support internal scrolling at constrained sizes; the presentation landing remains a single fixed viewport.

**Character-choice correction:** Race must be a dropdown filtered by faction, and class must be filtered by the selected faction/race. Use classic combinations plus Forever's confirmed Human Hunter, Dwarf Shaman, Gnome Priest, Orc Mage, Troll Warlock and Undead Paladin additions. Skyborne is available to both factions, with Mage only for Alliance Skyborne and Shaman only for Horde Skyborne; both also have Warrior, Hunter, Rogue and Druid. Exclude Death Knight, Monk, Demon Hunter and Evoker, as well as non-classic professions Inscription and Jewelcrafting. The shared options and server validation implement this; README and source comments link the official announcements verified November 1, 2026. Preserve “Undecided” for plans and do not reinterpret old free-text signup records.

**Guild recruitment update:** Guild creators can publish a list of missing roles, professions and custom needs, with quantities and short notes, so undecided prospects can choose what to roll. New guilds receive a private, account-free management link for maintaining that list. The public page, directory summary and guild-specific signup show the needs; only the private capability key permits editing. The URL fragment keeps the key out of server request URLs, D1 stores only its hash, and public APIs explicitly exclude owner credentials. Migration `0005_guild_recruitment.sql` adds the needs and hash columns without replacing existing data. The owner chose to create a new guild rather than attach management access to an older listing. This limited recruitment editor does not imply that a full guild administration or approval system exists.

**Delivery:** Raise pull requests and use the existing CI/CD pipeline for production migrations and Cloudflare deployment after changes reach `main`. Do not deploy directly. Local database migrations, builds and browser checks are appropriate verification.

**Authenticated guild-management milestone:** The owner now requests lead/officer-managed initiatives and recruitment needs, an approval queue, and a private member roster. Guild creation requires an account and makes the creator the lead. Leads can appoint officers; both lead and officers can approve/decline applicants, maintain needs and create/update/delete initiatives. Approved members can read the roster, needs and initiatives and update their own character. Applicants do not gain membership or roster access until approval. Existing private owner links support a one-time authenticated leadership claim; once owned, management permissions come from current membership. Migration `0006_guild_community.sql` supplies this model. This supersedes the earlier exclusion of lightweight guild management while leaving player matching, generated artwork and in-game membership integration separate. See `GUILD_COMMUNITY.md` for contracts and verification.

## 1. Overview

ai-zeroth helps people preparing to play **World of Warcraft: Forever** find compatible people to play and trade with. It is aimed especially at adults with jobs, families, existing friends and limited play windows.

The founder has two friends planning to play and wants to meet more players at the hackathon for future dungeons and raids. Useful introductions should consider shared availability, expectations and complementary professions—not simply whether two people play the same class.

A personalised pixel-art character makes onboarding engaging and gives players an identity they want to share. The actual payoff is a mutually accepted connection and a practical way to contact one another.

### Confirmed product decisions

The owner explicitly selected:

1. **Player-to-player matching** as the next milestone, rather than crew/guild management.
2. **Personalised OpenAI image generation as a core feature**, with fallback artwork when unavailable.
3. **Better Auth email/password** for the first product. Battle.net integration is a later investigation.
4. **ai-zeroth** as the product name.
5. A **single-screen, non-scrolling interface**. The owner rejected the earlier long-form landing page.
6. TanStack Start, Cloudflare hosting, Cloudflare SQLite/D1, shadcn-based components and RPG styling/themes.

## 2. Problem and target users

### Primary users

- Returning or continuing WoW players who want compatible company for launch.
- Busy adults who have specific play windows and need expectations around interruptions and hard stops to be understood.
- Players with an existing small friendship group who want additional contacts.
- Crafters seeking people with professions they need or can mutually help.

Hackathon attendees are the initial recruitment channel, not a permanent eligibility restriction.

### Problems to solve

- “I know people who play, but we are never online at the same time.”
- “I’m a leatherworker/skinner and would like an enchanter or alchemist to trade with.”
- “I want a healer to play with, but I don’t want a second job disguised as a guild.”
- “I’d like to meet people nearby who could become real friends.”

### Product promise

**Find a person, a concrete reason to connect, and a genuine shared play window.**

Availability and profession matching must be real, explainable calculations. Artwork and humour support that usefulness.

## 3. Goals and success criteria

### First product milestone

- Two independent users can sign up, publish player cards, discover each other, send/accept a request and reveal their chosen contact handles.
- A user can request an original pixel avatar based on their planned character, save it and see it reused on their card.
- Failure or lack of image-generation access does not prevent completing a profile or connecting.
- Recommendations show a dated shared play window and specific compatibility reasons derived from saved data.
- All main screens fit one viewport using short steps and pagination rather than stacked content.
- The deployed product works without judges requesting access to the site.

### Validation targets, not claims about current usage

- Speak to at least five potential players and record their most important matching need privately.
- Aim for at least three real published player profiles and one genuine accepted connection.
- A new user should be able to publish a usable profile within three minutes, excluding optional image-generation waiting time.
- Demonstrate the complete two-user journey in a video of **90 seconds or less**.

Real-user targets are learning goals, not release blockers. Functional acceptance uses clearly labelled synthetic accounts when necessary.

## 4. Current implementation baseline

Inspect these files before implementing replacements:

| Area | Exists today | Entry points |
|---|---|---|
| Landing experience | Fixed-viewport pixel forest/campfire, interactive illustrative characters, theme toggle | `src/routes/index.tsx`, `src/styles.css`, `src/components/world-scene.tsx` |
| Interest capture | Account-free two-step dialog; name, email, planned role, primary interest, consent | `src/routes/index.tsx`, `src/lib/interest.ts` |
| Persistence | D1 interest table and auth tables; local/remote migrations | `migrations/0001_interest.sql`, `migrations/0002_auth.sql` |
| Interest endpoint | JSON validation, origin check, request-size limit, honeypot, duplicate-email handling | `src/routes/api/interest.ts` |
| Authentication | Better Auth server/client foundation and email/password endpoints; no sign-in UI | `src/lib/auth.server.ts`, `src/lib/auth-client.ts`, `src/lib/auth-schema.ts`, `src/routes/api/auth/$.ts` |
| Artwork | Original hand-authored SVG portraits and environment; **not generated images** | `src/components/pixel-character.tsx`, `src/components/world-scene.tsx`, `public/favicon.svg` |
| UI foundation | Locally adapted shadcn-style Button/Input, Radix Slot, CVA, Tailwind, registry config | `src/components/ui/`, `components.json` |
| Hosting | Cloudflare Worker with D1 binding `DB` and custom domain | `wrangler.jsonc` |

**Not yet built:** player profiles, availability, discovery, matching, connection requests, contact sharing, image generation/storage or Battle.net integration.

### Existing configuration to preserve

- Product branding is ai-zeroth. Existing folder, Worker and database names still use `launch-party`; changing resource identifiers is not required to rename the product.
- The custom domain is `launchparty.thunkoid.com`. Do not rename it without the owner's instruction.
- Workers.dev and version-preview URLs are disabled. Do not restore the old longevi-branded address.
- The existing `thunkoid.com` homepage must remain intact.
- Keep existing interest submissions. An interest signup is **not** an authenticated account, public profile or consent to publish a profile.
- `BETTER_AUTH_SECRET` is a Cloudflare secret. `BETTER_AUTH_URL` is the deployed origin; local setup uses `.dev.vars`.
- There is no automatic mailing service, password recovery flow or Battle.net provider configured.

## 5. Complete core user journey

1. **Arrive:** Read the one-screen pitch and choose to create a player card. Keep the validation interest list available as a secondary action until the product is ready.
2. **Authenticate:** Create an email/password account or sign in using Better Auth.
3. **Describe your plan:** Choose a nickname, planned race/class, role, region, timezone, availability, professions and play expectations. This is a launch plan, not an imported existing character.
4. **Create your pixel self:** Request a portrait; show progress and a usable fallback. Continue without waiting if desired.
5. **Publish:** Preview the player card and explicitly make it discoverable to other signed-in players.
6. **Discover:** See one recommended player at a time, with shared availability and concrete match reasons. Advance to another suggestion without scrolling.
7. **Connect:** Send a request with a short optional introduction. The recipient sees it in their inbox and accepts or declines.
8. **Act:** After acceptance, both users see the other's chosen contact handle and a copyable introduction containing the shared play window.

**Example:** A London-time leatherworker/skinner who plays Thursday 20:30–22:00 finds an enchanter with an overlapping window and compatible casual expectations. They accept a connection and exchange manually supplied BattleTags or Discord usernames.

## 6. Scope and prioritisation

### P0 — required for the first complete product

- Email/password account UI and authenticated server operations.
- One player profile per account, editable and explicitly publishable/unpublishable.
- Planned character, professions, preferred play style and weekly availability.
- Personalised avatar generation attempt, persistent asset and fallback/error states.
- Deterministic, explainable player recommendations.
- Request, accept/decline and accepted-contact handoff.
- No-scroll screen system, meaningful verification and repeatable two-user demo.

### P1 — only after P0 works

- Optional coarse city and “open to meeting locally” preference.
- Additional avatar variation/regeneration beyond the initial bounded allowance.
- More elaborate sharing cards, calendar exports or convenience filters.

### Later / non-goals

- Crew creation, guild administration, party-size optimisation or raid rosters.
- Live chat, direct email campaigns, push notifications or real-time presence.
- Battle.net OAuth, friend-list access, automatic friend requests or WoW character imports.
- In-game addons, game-client integration, scraping, combat logs, gear scoring or auction-house tools.
- Social swiping as a substitute for meaningful compatibility.
- Animated sprite sheets, walk cycles, combat systems or a playable game.
- Exact addresses, real-world employer/profession matching, birth dates or mandatory age collection.
- Payments, subscriptions, advertising or an analytics platform.

Do not infer the availability of Forever APIs or game rules from the official marketing page. Confirm current documentation before implementing game-dependent restrictions.

## 7. User stories and acceptance criteria

All stories start **not implemented** unless the baseline table explicitly says otherwise. For UI verification, use the dev-browser skill if available; otherwise use a browser automation tool such as Playwright and record the equivalent evidence. A missing skill must not prevent actual browser verification.

### US-001 — Product schema and migrations (P0)

**As a developer, I need persisted profiles, availability, artwork and requests so the product works across sessions.**

- [ ] Add new forward-only migrations without rewriting existing migrations or deleting interest records.
- [ ] Enforce one profile per Better Auth user, valid references and a unique connection pair.
- [ ] Separate discoverable profile data from private contact data.
- [ ] Define shared validation/types for profile input and connection states.
- [ ] Local migrations run on a fresh database and an existing database containing an interest signup.
- [ ] `pnpm check` and `pnpm build` pass.

### US-002 — Account creation, sign-in and sign-out (P0)

**As a player, I want an account so my profile and connections belong to me.**

- [ ] Provide labelled signup/sign-in UI using the existing Better Auth client, not custom password handling.
- [ ] Reuse the configured 12-character minimum password length.
- [ ] Successful authentication creates a session and returns to the appropriate onboarding/app step.
- [ ] Invalid credentials, duplicate signup and unavailable auth produce actionable states without losing unrelated profile input.
- [ ] Signing out makes protected screens and server mutations inaccessible.
- [ ] Account email is private and is not presented as a verified Battle.net identity.
- [ ] `pnpm check` and `pnpm build` pass.
- [ ] Verify in browser using dev-browser skill (or equivalent browser automation).

### US-003 — Planned player card (P0)

**As a player, I want to describe my planned character so others know what I bring and need.**

- [ ] Collect nickname, planned race/class, role, region, play style, interruption tolerance and a short optional bio.
- [ ] Collect up to two planned professions and an explicit list of professions/roles sought.
- [ ] Support “undecided” character choices; do not invent Forever-specific class/race restrictions.
- [ ] Save a draft to the signed-in user's profile and restore it after refresh.
- [ ] Use bounded short steps with Next/Back rather than a long form.
- [ ] Only the owner can edit the profile; enforce this server-side.
- [ ] `pnpm check` and `pnpm build` pass.
- [ ] Verify in browser using dev-browser skill (or equivalent browser automation).

### US-004 — Timezone-aware weekly availability (P0)

**As a busy player, I want to specify real play windows so recommendations are practical.**

- [ ] Save an IANA timezone, such as `Europe/London`, and 1–7 weekly windows.
- [ ] Each window has weekday, start time and end time; split overnight windows explicitly at midnight or ask the user to enter two windows.
- [ ] Reject zero-length/invalid windows and normalise overlapping windows to avoid double counting.
- [ ] Preview a dated upcoming window in the user's timezone.
- [ ] Cover different timezones, no overlap, midnight boundaries and a daylight-saving transition with meaningful tests.
- [ ] `pnpm check` and `pnpm build` pass.
- [ ] Verify in browser using dev-browser skill (or equivalent browser automation).

### US-005 — Personalised pixel character generation (P0)

**As a player, I want a pixel character based on my plan so my card feels like me.**

- [ ] Check current OpenAI image API documentation and actual model access before selecting a model or request parameters.
- [ ] Generate server-side from race/class, a fixed shared art direction and an optional bounded cosmetic detail.
- [ ] Keep API credentials server-side. Derive account identity from the session.
- [ ] Persist generation state: `not_requested`, `pending`, `ready` or `failed`.
- [ ] Store the generated image durably and reuse it across refreshes; never regenerate merely because a card renders.
- [ ] Limit the first milestone to two generation attempts per account, including failed requests; prevent concurrent duplicate attempts atomically.
- [ ] Show failure/fallback artwork and allow onboarding to finish without a generated image. Expire stale pending states rather than leaving an endless spinner.
- [ ] Validate with one real successful generation and one forced error path. Label any demo fallback honestly.
- [ ] `pnpm check` and `pnpm build` pass.
- [ ] Verify in browser using dev-browser skill (or equivalent browser automation).

### US-006 — Preview, publish and edit a profile (P0)

**As a player, I want to choose when my card becomes discoverable.**

- [ ] Show a compact preview containing avatar/fallback, character plan, professions, expectations and availability.
- [ ] Publishing requires a valid completed profile, at least one availability window and a manually supplied contact method.
- [ ] Make clear that publishing shares the player card with signed-in players; contacts remain hidden until a connection is accepted.
- [ ] Unpublished profiles are excluded from discovery, including server queries.
- [ ] Edits persist and affect subsequent recommendations. Unpublishing does not silently delete existing connections.
- [ ] Interest-list records are never automatically published or converted to accounts.
- [ ] `pnpm check` and `pnpm build` pass.
- [ ] Verify in browser using dev-browser skill (or equivalent browser automation).

### US-007 — Compatibility engine (P0)

**As a player, I want recommendations based on facts so I can understand who fits.**

- [ ] Implement the eligibility and ranking contract in Section 9 as a pure, testable module.
- [ ] Exclude self, unpublished profiles, different regions and already-requested/connected pairs.
- [ ] Return at least one dated shared window of 30 minutes or more for each recommendation.
- [ ] Include specific reasons, such as an explicitly sought profession, mutual profession needs or overlapping evenings.
- [ ] Do not equate a complementary profession with guaranteed game trading compatibility.
- [ ] Tests cover directed profession needs, mutual needs, region mismatch, stable tie-breaking, excluded pairs and availability edge cases.
- [ ] No language model is used to decide factual eligibility or calculate time overlap.
- [ ] `pnpm check` and `pnpm build` pass.

### US-008 — Discover one player at a time (P0)

**As a player, I want to inspect compatible people without browsing a sprawling directory.**

- [ ] Render one recommended card with Next/Previous controls, a concrete shared time and up to three grounded reasons.
- [ ] Show pending/accepted connection state where relevant; never show email or private contact fields.
- [ ] Provide a no-results state with actions to edit availability or invite a friend; never fabricate live players.
- [ ] Clearly label synthetic profiles in any dedicated demo dataset.
- [ ] Refreshing or navigating back restores a usable screen; no scrolling is required.
- [ ] `pnpm check` and `pnpm build` pass.
- [ ] Verify in browser using dev-browser skill (or equivalent browser automation).

### US-009 — Send a connection request (P0)

**As a player, I want to introduce myself to someone compatible.**

- [ ] Allow one optional plain-text introduction of at most 280 characters.
- [ ] Create a `pending` request using the authenticated sender identity, never a client-supplied sender ID.
- [ ] Reject self-requests and requests involving unpublished/nonexistent profiles.
- [ ] Enforce one canonical pair record, including simultaneous requests in opposite directions.
- [ ] A repeated send does not produce a duplicate request or notification.
- [ ] Do not expose contact data while pending.
- [ ] `pnpm check` and `pnpm build` pass.
- [ ] Verify in browser using dev-browser skill (or equivalent browser automation).

### US-010 — Accept or decline from an inbox (P0)

**As a recipient, I want to choose whom to connect with.**

- [ ] Show paginated incoming/outgoing requests with current state and a link to the relevant card.
- [ ] Only the recipient can transition `pending` to `accepted` or `declined`; enforce the transition atomically on the server.
- [ ] Refresh preserves the state; repeated actions do not corrupt it.
- [ ] Sender cannot accept their own request or update another user's requests.
- [ ] Declined requests do not reveal contacts and cannot be resent in this milestone.
- [ ] `pnpm check` and `pnpm build` pass.
- [ ] Verify in browser using dev-browser skill (or equivalent browser automation).

### US-011 — Accepted contact handoff (P0)

**As a connected player, I want an actionable next step so we actually play together.**

- [ ] After acceptance, both participants can see the other person's chosen manual BattleTag or Discord username.
- [ ] Only the two participants can retrieve these contact details through the accepted-connection endpoint.
- [ ] Provide copyable text containing an introduction and a currently valid shared play window; show a fallback if clipboard access fails.
- [ ] If profile edits remove all overlap, say so and suggest arranging a time; do not display an obsolete window as current.
- [ ] Never expose account emails or imply that a Battle.net friend request was automatically sent.
- [ ] `pnpm check` and `pnpm build` pass.
- [ ] Verify in browser using dev-browser skill (or equivalent browser automation).

### US-012 — Single-screen app shell and release evidence (P0)

**As a player or judge, I want a coherent, working experience on one screen at a time.**

- [ ] Preserve ai-zeroth's current visual direction, names and Tavern/Moonwell themes across new screens.
- [ ] Fit primary controls and content without document scrolling or clipped fields at 1440×900, 1280×720, 390×844, 320×568 and 844×390.
- [ ] Use pagination and additional short steps when content does not fit. Do not satisfy the requirement merely by hiding overflow.
- [ ] Check keyboard navigation, visible focus, dialog Escape/focus restoration, reduced motion and mobile input/keyboard behaviour.
- [ ] Make the whole journey demonstrable using two separate browser contexts and persisted data.
- [ ] Run the Section 12 release checks and update README/setup/attribution to match reality.
- [ ] `pnpm check` and `pnpm build` pass.
- [ ] Verify in browser using dev-browser skill (or equivalent browser automation).

## 8. Functional requirements

- **FR-01:** Provide email/password authentication using Better Auth and the existing D1-backed auth schema.
- **FR-02:** Require an authenticated session for all player data, matching, artwork and connection operations. Keep the landing and interest form public.
- **FR-03:** Maintain one editable planned player profile per account.
- **FR-04:** Collect up to two planned professions, sought professions and optional sought roles. Do not assume these are imported or verified in-game facts.
- **FR-05:** Store weekly availability in an IANA timezone and calculate dated intersections.
- **FR-06:** Offer personalised OpenAI pixel-art generation with a persisted result, bounded attempts and a non-blocking fallback.
- **FR-07:** Make discoverability explicit through publish/unpublish controls.
- **FR-08:** Recommend only eligible profiles, explain recommendations and show one at a time.
- **FR-09:** Support `pending → accepted` and `pending → declined` connection transitions.
- **FR-10:** Reveal manually provided contact handles only to accepted participants; account emails remain private.
- **FR-11:** Keep facts deterministic; do not invent availability, professions, users, connection success or API integration.
- **FR-12:** Preserve the no-scroll, one-screen-at-a-time interaction model throughout the main journey.
- **FR-13:** Keep current interest data and deployed database bindings intact through migrations.
- **FR-14:** Treat user text as plain text; validate bounded inputs server-side and use parameterised queries.
- **FR-15:** Distinguish operational product features, labelled demo data, fallback assets and future plans in both UI and pitch.

## 9. Matching contract

This is the initial implementation default, not a scientific compatibility model. Keep constants in one module so the owner can tune them.

### Eligibility

1. Both accounts have published, valid profiles.
2. Profiles are distinct and have the same selected play region.
3. No existing connection-pair record exists between them in this milestone.
4. There is at least one overlap of **30 minutes** in their actual upcoming availability over a rolling **14-day** horizon.

Game version is fixed to Forever for this milestone. Faction/realm restrictions are not silently guessed; confirm official rules before introducing hard exclusions. Until then, explain that recommendations concern social/schedule fit and players must confirm in-game compatibility.

### Availability calculation

- Expand recurring weekly windows into dated intervals using each user's timezone for the next 14 days.
- Convert intervals into instants and intersect them. Merge duplicates/overlaps before scoring.
- Use a maintained timezone-aware library or supported Temporal implementation; do not hand-code fixed UTC offsets.
- Present the next qualifying overlap with a date and local timezone label. In two-user views, each user sees their own local time.
- Explicitly define behaviour for nonexistent/ambiguous DST wall times in implementation notes and tests; never shift them silently without a policy.

### Initial ranking

Rank eligible candidates using:

- `+3` per distinct profession the viewer seeks that the candidate plans to offer, capped at `+6`.
- `+2` per distinct profession the candidate seeks that the viewer offers, capped at `+4`.
- `+2` if the candidate fills an explicitly sought role; no bonus when no role is sought.
- `+2` for the same play style.
- `+1` for the same interruption-tolerance preference.
- `+1` per complete shared hour over the 14-day horizon, capped at `+4`.

Sort by total descending, then earliest qualifying overlap, then stable profile ID. Undecided values never count as a concrete profession/role match. Do not display the score as a percentage. Reasons must be constructed from the actual facts that contributed.

## 10. Data and technical considerations

### Retained stack

- TanStack Start + React + TypeScript; use server routes/functions and existing routing patterns.
- Cloudflare Workers with D1/SQLite; Drizzle where useful, consistent with existing auth integration.
- Tailwind + local shadcn-style components for the themed screen/dialog system.
- Better Auth email/password and server-side session checks.
- OpenAI Image API or another currently documented OpenAI image-generation path, selected after a live feasibility check.

### Proposed entities

| Entity | Minimum responsibility |
|---|---|
| Existing auth tables | Identity, credentials and sessions; owned by Better Auth |
| Existing `interest` | Private validation signups; independent of profile publication |
| `player_profiles` | Owner ID, nickname, character plan, region, timezone, role, style, interruption preference, bio, offered/sought professions and roles, publish state, timestamps |
| `availability_windows` | Owner/profile ID, weekday, local start/end time; validated and normalised |
| `player_contacts` | Owner ID, method (`battletag` or `discord`), handle; private until accepted |
| `avatar_generations` | Owner ID, state, attempt reservation/count, bounded prompt inputs, provider/model metadata, asset key, safe error state, timestamps |
| `connection_requests` | Canonical low/high profile IDs with unique constraint, sender, recipient, optional introduction, state and timestamps |

Profession arrays may use validated JSON for this small milestone. Avoid accepting arbitrary JSON without schema validation. Do not expose raw database rows as discovery DTOs; explicitly select safe fields.

### Artwork storage and reliability

- **Recommended new binding:** Cloudflare R2 for generated image bytes. It is not provisioned in the current project; account access and setup are implementation dependencies.
- Keep D1 for asset keys/state, not base64 image blobs. Do not rely on temporary provider URLs remaining valid.
- Serve artwork through a controlled Worker endpoint: owners can view drafts; signed-in players can view published-card artwork. Keep the bucket private by default.
- Use a shared art direction: static full-body fantasy adventurer, chunky pixel style, limited palette, consistent framing, no text. Support the existing SVGs as fallback.
- Keep names/stats in HTML, not baked into images. Actual perfect pixel-grid alignment is not guaranteed by generation; inspect outputs.
- Generation must have a bounded provider timeout, bounded retries/attempts, durable state and recovery for abandoned/stale requests. Do not add a queue platform unless required by a demonstrated constraint.
- Confirm model access, latency and a small spend cap early. The provider may require organisation verification.

### Auth and privacy boundaries

- Check sessions and ownership at the server operation, not only at the page.
- Contact retrieval requires the requester to be a participant in an accepted pair.
- Email-list consent does not authorise public player publication or social contact disclosure.
- Manual BattleTags/Discord handles are self-declared, not verified integrations.
- Use database constraints and conditional updates for duplicate requests, generation limits and state races.
- Keep keys in Cloudflare secrets/local gitignored variables. Avoid logging credentials, handles, private profile data or provider payloads.

### Scope of the no-scroll requirement

The landing and primary app screens must not document-scroll at the supported sizes. Pagination and small multi-step forms are the default solution. The project currently uses a global `overflow: hidden`; new screens must be sized deliberately so this does not simply conceal inaccessible content. Test zoom/text scaling and the mobile keyboard; split steps further if required.

## 11. Suggested implementation sequence and agent handoff

### Dependency order

1. **US-001:** Agree on shared types, schema and endpoint contracts.
2. **US-002:** Enable a real account journey.
3. **US-003/004/006:** Persist a usable, publishable profile and availability.
4. **US-005:** Run the image feasibility spike early; integrate generation/storage after the profile owner contract exists.
5. **US-007/008:** Match and display actual profiles.
6. **US-009/010/011:** Complete the mutually accepted contact handoff.
7. **US-012:** Verify and package the full journey; apply the single-screen design throughout, not only at the end.

### Work suitable for independent agents

After shared contracts are agreed, avatar generation/storage and the pure matching module can proceed independently. UI/profile work and request/contact work need explicit file ownership to avoid collisions. Follow `AGENTS.md` for orchestration; do not overwrite another worker's source or migrations.

Every handoff should contain:

- Story IDs and dependencies.
- Owned files and shared interfaces.
- Changes made and migrations/configuration added.
- Exact verification commands and results.
- Screenshots or browser findings for UI work, with synthetic data only.
- Remaining blockers and required owner decisions.

Do not mark a story complete because its components render. Confirm persistence, permission boundaries and the relevant end-to-end outcome. Do not add speculative infrastructure, unrelated refactors or unrequested integrations.

## 12. Release verification and demo

### Required checks

```sh
pnpm check
pnpm build
pnpm db:local
```

Add meaningful automated tests for timezone intersections, matching reasons and ranking, duplicate/state races and contact access. Choose a test runner consistent with the installed stack and record its command in README; there is currently no product test command to assume.

Use two independent browser contexts to verify:

1. User A and B create accounts and publish profiles with an actual shared time.
2. A sees B with correct profession/availability reasons and a persistent avatar/fallback.
3. A requests; B accepts; both receive the right contact handoff.
4. Pending/declined requests and unrelated User C cannot retrieve contacts.
5. Image failure, no matches, invalid login, refresh and duplicate actions have working outcomes.
6. No required content is clipped and no document scrolling occurs at supported viewports.

For release, check the deployed site without an existing Cloudflare/login session. Re-run the core journey against the production configuration using synthetic accounts and remove only those test records afterward.

### Submission deliverables

- Public GitHub repository with current README, local setup, migrations, deployment instructions and `.dev.vars.example`; publish when instructed by the owner.
- Working public demo URL under the approved thunkoid subdomain.
- Working demo video no longer than 90 seconds; verify its link without permission requests.
- Credit existing code, libraries, templates, artwork and image-generation tools accurately.
- Include a concrete, genuine example of how **Codex** helped, with task, resulting change and verification evidence. Current implementation assistance used OpenCode; do not relabel it as a Codex contribution.
- Keep secrets and real personal data out of the public repo and demo.

### Suggested 90-second demo

- **0–10s:** “Three friends want to return to WoW, but our calendars are the real raid boss.”
- **10–30s:** Show one planned character, professions, availability and generated pixel self.
- **30–50s:** Show a compatible person, why they fit and the actual shared play window.
- **50–70s:** Send a request, switch to the second account and accept it.
- **70–90s:** Show the unlocked contact handoff and explain one genuine Codex contribution. Use a prepared generated asset if generation itself would exceed the demo window, and describe it honestly.

## 13. Deadline risks and fallback decisions

The original build window is 11:00–17:00 London time on 1 November 2026. **Check the actual remaining time before starting implementation; do not assume six hours remain.**

- Authentication UI, timezone-aware matching, generated assets and a two-user request system are a substantial expansion from the current landing page.
- Reserve approximately the final 45–60 minutes for verification, README/repo preparation, video and submission. Agree any shorter buffer with the owner.
- Time-box the initial image/API/storage feasibility check to roughly 20 minutes. If blocked, retain the fallback and explicitly report that personalised generation acceptance is unmet; do not quietly remove it from P0.
- Native Battle.net integration is not required and must not consume the milestone's time.
- Avoid counting on live recruitment to complete the software demo. Label sample users clearly.
- If P0 cannot fit, ask the owner to approve a reduced milestone and identify unmet criteria. A polished interest page must not be presented as working matchmaking.

## 14. Open questions and implementation defaults

These do not block writing this PRD; agents should surface them before they affect a decision.

| Question | Default until the owner decides |
|---|---|
| Forever-specific factions, realms and profession availability? | Self-declared plans; do not enforce unverified game restrictions. Use region as the initial hard filter. |
| Which OpenAI model, budget and account access? | Verify current docs/access with one real request; owner sets budget before public generation is enabled. |
| Is R2 available and approved for this deployment? | Proposed durable artwork store; check access before provisioning. |
| Which contact channel? | One manually entered BattleTag or Discord username, revealed only after acceptance. |
| Password reset/email verification? | No mail service is configured. Surface this limitation; do not display broken reset/verification UI. |
| Local friendship discovery? | Optional city/open-to-local preference is P1; never collect exact location. |
| Product-branded subdomain? | Retain `launchparty.thunkoid.com`; branding alone does not authorise DNS changes. |
| Moderation/disconnection controls for a larger public launch? | Revisit before growth beyond the bounded hackathon MVP; do not expand into a full social platform during this milestone. |

## 15. Reference documentation

Check the current documentation and installed versions rather than copying guessed APIs from this PRD.

- [Codex](https://developers.openai.com/codex)
- [Codex quickstart](https://developers.openai.com/codex/quickstart)
- [OpenAI developer docs](https://developers.openai.com/)
- [OpenAI image generation](https://developers.openai.com/api/docs/guides/image-generation)
- [OpenAI Cookbook](https://developers.openai.com/cookbook)
- [Cloudflare: TanStack Start on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Cloudflare R2](https://developers.cloudflare.com/r2/)
- [Better Auth: TanStack Start](https://www.better-auth.com/docs/integrations/tanstack)
- [Better Auth: Drizzle adapter](https://www.better-auth.com/docs/adapters/drizzle)
- [shadcn: TanStack Start](https://ui.shadcn.com/docs/installation/tanstack)
- [Official WoW Forever page](https://worldofwarcraft.blizzard.com/en-gb/forever)
- [Battle.net developer portal — future investigation only](https://develop.battle.net/)
