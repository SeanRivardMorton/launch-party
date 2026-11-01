# ai-zeroth

**Agent handoff:** See [`PRD.md`](./PRD.md) for the next product milestone, confirmed scope, implementation stories, dependencies and acceptance criteria. Read [`AGENTS.md`](./AGENTS.md) before starting work.

**Your people. Your next adventure.** A presentation landing page, mobile interest signup and public guild directory for a WoW Forever crew finder, built during the DevDay Exchange Community Hackathon in London on 1 November 2026.

**Live:** https://launchparty.thunkoid.com

## Working journey

Scan the large QR code (or click it) → complete `/signup` → enter private contact details, faction, planned race/class, all roles you can fulfill, up to two primary professions, guild plans and email consent → get confirmation. Choose to list your guild or browse for one after signup. Submissions are saved privately in Cloudflare D1 (SQLite). Duplicate emails do not create duplicate entries or overwrite the original submission.

The QR code always points to **https://launchparty.thunkoid.com/signup**, including in local development, so a presentation audience can reach the public site. Deploy the latest routes before using it. Clicking the code uses the current site's `/signup` for local testing.

- Fixed-viewport, no-scroll landing screen with Tavern and Moonwell themes.
- Original pixel forest, campfire and clickable characters; no external image service required.
- Four-step, account-free mobile signup with character details, multiple roles, professions and explicit email consent. Race is a faction-dependent dropdown; class choices depend on faction and race. Roles are restricted by class: Mage, Hunter, Rogue and Warlock are DPS-only; Warrior can tank or DPS; Priest and Shaman can heal or DPS; Paladin and Druid can fill all three roles. DPS-only classes have their role selected automatically. Invalid selections reset when their prerequisites change, and the server validates the same combinations. “Undecided” is available for race/class plans and for role choices when more than one role is possible.
- Public `/guilds` directory with faction/region filters and one listing per page. An icon in the landing header also links to the directory.
- Three-step `/guilds/new` form publishes guild name, faction, region, description and optional recruitment needs, with explicit publication consent. Forever has no selectable servers/realms. Publishing automatically generates a guild page at `/guilds/<id>` and a copyable invite link; no external invite URL is required. Retrying the same publication with its submission ID and management key reuses the page.
- Guilds can list up to 12 role, class, profession or custom needs, with quantities and optional notes (for example, an off-tank, guild enchanter or alchemist). Quick-add presets cover supported classes, roles, primary professions and Cooking, First Aid and Fishing. These appear on the guild page, in directory summaries, and during guild-specific character/profession signup so undecided prospects can see what the crew needs.
- New guild publication also issues a private management link at `/guilds/<id>/manage#key=…`. Creators can add, edit or remove recruitment needs later, including clearing the list as gaps are filled. The key is remembered in the creating browser when local storage is available; keep the private link for another device. Only its SHA-256 hash is stored in D1. Public APIs never return keys or management links, and editing requires the key in an Authorization header. Older listings remain readable; management links are issued only with new publication, not by knowing a public guild ID.
- The directory links to the internal guild page. “Join this guild” opens `/signup?guild=<id>`, retains guild context, uses the guild's faction and records private joining interest after explicit consent. `guild_interest` links the signup and guild, with duplicate joining submissions producing one association. The interest signup and association are saved in one D1 batch. Listings are account-free, self-declared and public; joining interest and contact details are private. Approval inboxes and in-game membership integration remain planned.
- Existing guild listings also have internal pages. Old external links are no longer used in the public directory or detail API. Invite links use the current origin: localhost during development, the public domain after deployment.
- Separate `/register`, `/login` and protected `/account` screens using the existing Better Auth/D1 foundation. The header follows session state; account holders can update their account name and sign out. Registration does not convert interest submissions, publish player cards or grant guild membership.
- Player matching, personalised image generation, Battle.net linking and guild administration are **planned**, not implemented.

### Forever character choices

`src/lib/character-options.ts` contains the classic race/class combinations plus all six additions confirmed in Blizzard's [October 29 returning-player guide](https://worldofwarcraft.blizzard.com/en-gb/news/24315643): Human Hunter, Dwarf Shaman, Gnome Priest, Orc Mage, Troll Warlock and Undead Paladin. Both factions offer Skyborne: Warrior, Hunter, Rogue and Druid, plus Mage for Alliance (High Order) or Shaman for Horde (Windshaper), as confirmed in the [Skyborne overview](https://worldofwarcraft.blizzard.com/en-gb/news/24302071). Skyborne requires the Heroic Pack or higher. Death Knight, Monk, Demon Hunter and Evoker are excluded. The [Forever starter guide](https://worldofwarcraft.blizzard.com/en-gb/news/24315280) lists the nine primary professions used by the form; Inscription and Jewelcrafting are excluded. Sources checked November 1, 2026.

## Stack

TanStack Start + React + TypeScript, Vite, Tailwind CSS, shadcn-style local Button/Input components (Radix Slot and CVA), Better Auth with Drizzle's D1 adapter, Cloudflare Workers and D1. `components.json` configures the shadcn CLI for adding more components.

## Local setup

Requires Node 22.12+ and pnpm 10+. Install dependencies using the committed lockfile:

```sh
pnpm install --frozen-lockfile
pnpm db:local
pnpm dev
```

Open http://localhost:3000. Local D1 state is stored under `.wrangler/` and is not committed. The landing page and signup work without authentication credentials or an OpenAI key.

### Optional local authentication

Copy `.dev.vars.example` to `.dev.vars`. Replace its placeholder with a fresh secret generated using:

```sh
openssl rand -hex 32
```

Keep `BETTER_AUTH_URL=http://localhost:3000`, then restart the dev server. Better Auth is mounted at `/api/auth/*`; its client helper is `src/lib/auth-client.ts`. Visit `/register` to create an account with a password of at least 12 characters, `/login` to sign in, and `/account` to manage your account name or sign out. Email delivery, password recovery and OAuth providers are not configured. Linking Battle.net is a separate future integration. Missing auth configuration shows a friendly unavailable state while public interest and guild routes remain usable. See [AUTH.md](./AUTH.md) for session boundaries, repeatable local browser checks and the campfire integration handoff.

## Cloudflare deployment

The current `wrangler.jsonc` points at this project's provisioned database and the custom domain `launchparty.thunkoid.com`. Workers.dev and version preview URLs are disabled; the existing `thunkoid.com` homepage is preserved. For your own Cloudflare account:

```sh
pnpm exec wrangler login
pnpm exec wrangler d1 create launch-party
```

Replace `database_id` in `wrangler.jsonc` with the returned ID and update `BETTER_AUTH_URL` to your deployment's origin. Deliver changes through a pull request. The GitHub Actions pipeline checks the PR, then applies production migrations and deploys after the changes reach `main`.

For a fresh deployment, the authentication secret can be configured separately when explicitly requested:

```sh
pnpm exec wrangler secret put BETTER_AUTH_SECRET
```

Supply a fresh random secret at the prompt. Use local migrations and builds for development verification; production migrations and deployment are handled by CI/CD.

The compatibility date is `2026-10-30` to match the installed local Workers runtime. Do not export D1 contents or commit `.dev.vars`, tokens, local state or real signup screenshots. The database ID and deployment origin are configuration identifiers, not credentials.

### Automatic deployment with GitHub Actions

`.github/workflows/deploy.yml` runs on pull requests targeting `main` and pushes to `main`. It installs dependencies from the frozen lockfile, checks TypeScript and builds the app. After successful checks, a push to `main` also applies pending production D1 migrations and deploys the built Worker to **https://launchparty.thunkoid.com**.

In the GitHub repository, open **Settings → Secrets and variables → Actions** and add these repository secrets:

| Secret | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | A Cloudflare API token scoped to the deployment account with **Account → Workers Scripts → Edit**, **Account → D1 → Edit**, and **Zone → Workers Routes → Edit** for the `thunkoid.com` zone. |
| `CLOUDFLARE_ACCOUNT_ID` | The Cloudflare account ID that owns the Worker and D1 database. |

Create the token under **Cloudflare → My Profile → API Tokens**; the **Edit Cloudflare Workers** template is a starting point, with D1 edit access added. Use the account containing the database configured in `wrangler.jsonc`.

The existing `BETTER_AUTH_SECRET` stays in Cloudflare Workers secrets. For a fresh Worker, set it once with `pnpm exec wrangler secret put BETTER_AUTH_SECRET` as described above.

Push the repository to GitHub with `main` as the deployment branch and ensure GitHub Actions is enabled. The **Actions → Check and deploy** run shows check, migration and deployment results. Pull requests only run checks and builds. Production runs are serialized and active runs are not cancelled by newer pushes. Migrations run before deployment, so schema changes should remain compatible with the currently deployed app; a failed deployment does not roll back an applied migration.

## Checking interest

Use Cloudflare's authenticated D1 console. For a non-identifying summary:

```sh
pnpm exec wrangler d1 execute DB --remote --command "SELECT need, COUNT(*) AS total FROM interest GROUP BY need"
```

The app does not expose a public signup directory or a public admin endpoint. Private guild interest is stored in `guild_interest`, referencing `guilds` and `interest`; inspect it only through the authenticated D1 console. Migration `0004_guild_interest.sql` adds this association without rewriting existing guilds or signups. `0005_guild_recruitment.sql` adds validated recruitment-needs JSON (defaulting to an empty list for old guilds) and a nullable management-key hash. Remove a requested email with a parameterised query in a private admin tool or the authenticated D1 console. No automatic mailing service is configured; follow-up is manual.

## Verification

```sh
pnpm check
pnpm build
```

Browser smoke checks for the character/guild milestone cover the four signup steps, Back navigation retaining values, multiple roles, duplicate-profession validation, guild publication, directory faction filtering and refresh persistence. Viewports checked: 1440×900, 1280×720, 390×844, 320×568 and 844×390. Hosted-invite checks additionally cover automatic guild-page creation, copying the invite URL, an independent mobile browser opening the link and completing guild-specific signup, and return navigation to the guild. New form screens allow internal scrolling on smaller displays so controls remain accessible, while the document stays fixed. API checks cover validation, publication and guild-joining consent, cross-origin rejection, unknown guilds, faction mismatches, duplicate publications/signups and private email exclusion. SQLite was queried separately to confirm all character fields persisted and duplicate joining submissions produced one association. Existing listings with legacy external links were checked for compatibility with the new internal pages. Only synthetic `example.invalid` details are used for checks. These checks were run locally; they do not claim the latest milestone has been deployed.

Recruitment checks cover mobile creation with role/profession gaps, quantities and notes, owner editing from a separate browser using the private link, refresh persistence, public-page updates, custom needs, removal and clearing the list. Unauthenticated/wrong-key edits, public-ID takeover attempts, cross-origin requests, invalid needs and oversized request bodies were rejected. Public responses were checked to exclude management keys. Guild-specific signup was checked to display needs before character and profession choices. Guild-page layouts were checked at desktop, mobile and landscape sizes without horizontal document overflow.

The public deployment was also tested in a fresh browser without Cloudflare authentication. Production Better Auth signup, session-cookie handling, session retrieval and signout passed. Synthetic signup and authentication records were removed from production after verification. The deployed auth secret was generated and stored directly as a Cloudflare secret, without being written to this repository.

## Attribution and build record

- Product concept and requirements: Sean and the hackathon discussion.
- This project was created from scratch during the hackathon; no existing application template was copied. Cloudflare, TanStack, Better Auth and shadcn documentation informed setup.
- Pixel portraits, landscape and favicon: original SVGs authored in this project with AI coding assistance. They are **not** OpenAI-generated images or Blizzard assets.
- UI component patterns: [shadcn/ui](https://github.com/shadcn-ui/ui), MIT. Components are locally adapted; RPG styling and themes are custom.
- Icons: [Lucide](https://lucide.dev), ISC. Other dependencies retain their own licences.
- WoW, World of Warcraft and Battle.net names belong to Blizzard. This is an independent community concept, not an affiliated or endorsed service.
- Implementation assistance in this session used OpenCode. No Codex contribution is claimed yet. Record a concrete, genuine Codex task and its resulting change before using that claim in a hackathon submission.

## Current documentation used

- [Cloudflare: TanStack Start on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/)
- [Better Auth: TanStack Start](https://www.better-auth.com/docs/integrations/tanstack)
- [Better Auth: Drizzle](https://www.better-auth.com/docs/adapters/drizzle)
- [shadcn: TanStack Start](https://ui.shadcn.com/docs/installation/tanstack)

## Validation demo (under 90 seconds)

1. **0–15s:** “Three friends want to play WoW Forever. We need a crew whose schedules work in real life.”
2. **15–35s:** Show the QR code, then the character, role and profession signup steps on mobile.
3. **35–60s:** Submit synthetic details and choose to list a guild or find one.
4. **60–80s:** Open a guild's Launchparty page, copy its invite link and show the guild-specific signup. Explain that player matching and image generation are still planned.
