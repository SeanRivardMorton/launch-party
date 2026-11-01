# ai-zeroth

**Agent handoff:** See [`PRD.md`](./PRD.md) for the next product milestone, confirmed scope, implementation stories, dependencies and acceptance criteria. Read [`AGENTS.md`](./AGENTS.md) before starting work.

**Your people. Your next adventure.** A single-screen validation landing page for a WoW Forever crew finder, built during the DevDay Exchange Community Hackathon in London on 1 November 2026.

**Live:** https://launchparty.thunkoid.com

## Working journey

Read the pitch → meet the illustrative campfire crew → open “Find my party” → enter your name/nickname and email → choose your planned role and primary interest, then consent → get confirmation. Submissions are saved privately in Cloudflare D1 (SQLite). Duplicate emails do not create duplicate entries or overwrite existing feedback.

- Fixed-viewport, no-scroll landing screen with Tavern and Moonwell themes.
- Original pixel forest, campfire and clickable characters; no external image service required.
- Compact two-step native dialog with keyboard focus handling and Escape dismissal.
- Account-free interest capture with validation and explicit email consent.
- Better Auth server endpoints and D1 tables as the authentication foundation. There is deliberately no account-creation UI on the validation page.
- Matching, personalised image generation, Battle.net linking and crew management are **planned**, not implemented. The page labels these clearly and does not invent signup totals or testimonials.

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

Keep `BETTER_AUTH_URL=http://localhost:3000`, then restart the dev server. Better Auth is mounted at `/api/auth/*`; its client helper is `src/lib/auth-client.ts`. Email/password authentication is configured with a 12-character minimum. Email delivery, password recovery, OAuth providers and an account UI are not included in this validation page. Linking Battle.net is a separate future integration.

## Cloudflare deployment

The current `wrangler.jsonc` points at this project's provisioned database and the custom domain `launchparty.thunkoid.com`. Workers.dev and version preview URLs are disabled; the existing `thunkoid.com` homepage is preserved. For your own Cloudflare account:

```sh
pnpm exec wrangler login
pnpm exec wrangler d1 create launch-party
```

Replace `database_id` in `wrangler.jsonc` with the returned ID. Update `BETTER_AUTH_URL` to your deployment's origin and then run:

```sh
pnpm db:remote
pnpm run deploy
pnpm exec wrangler secret put BETTER_AUTH_SECRET
```

Supply a fresh random secret at the prompt. `pnpm run deploy` is intentional: `pnpm deploy` is a different, built-in pnpm command.

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

The app does not expose a public signup directory or a public admin endpoint. Remove a requested email with a parameterised query in a private admin tool or the authenticated D1 console. No automatic mailing service is configured; follow-up is manual.

## Verification

```sh
pnpm check
pnpm build
```

Browser smoke checks cover SSR, theme persistence, no document scrolling, unclipped page/dialog content, dialog dismissal and the complete two-step signup. Viewports checked: 1440×900, 1280×720, 390×844, 320×568 and 844×390. The interest endpoint's validation and cross-origin rejection were also checked during the initial build. SQLite was queried separately to confirm synthetic submissions persisted. Only synthetic `example.invalid` contact details are used for checks.

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
2. **15–35s:** Show the concept party: role, profession and shared evenings. Toggle the theme.
3. **35–60s:** Submit a synthetic interest form and show the saved confirmation.
4. **60–80s:** Explain what feedback you want: a dungeon crew, crafting contacts or local friendships. Be explicit that this is validation, with matching and generation still planned.
