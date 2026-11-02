# Account authentication

## User journey

- `/register` creates a Better Auth email/password account and signs it in.
- `/` now shows a centered login panel when signed out, or a Characters / Guild / Calendar menu when signed in. Login and registration started from home return to home. The presentation QR and illustrative lineup have been removed, while themed scenery and the animated campfire remain.
- `/login` signs in an existing account. Interest-list subscribers must create an account separately.
- `/account` is server-protected. It shows the owner's saved campfire character (including unpublished data and saved artwork), all approved per-guild character snapshots, memberships and separately labeled pending/declined applications. Account settings retain the private email, account-name update and signout. Account name is explicitly separate from character nicknames.
- The landing/account headers offer **Sign in** or an accessible **My account** disclosure based on the live session. The disclosure links to characters, guilds, approved guild halls/campfires, account settings and signout. Native links support Tab; arrows/Home/End navigate actions, Escape restores trigger focus, and outside clicks/focus dismiss it. No account email or BattleTag appears in navigation.
- Registration and login accept `returnTo` for internal app pages (default `/account`). External URLs, protocol-relative paths, backslashes, malformed encoding, auth loops and API paths are rejected. The destination is checked again before navigation.
- Pending buttons prevent repeated submissions; errors retain input and authentication errors receive focus. Password visibility is an explicit toggle. Forms use POST and submit buttons stay disabled until hydration, preventing early/default GET submissions of credentials.

`/signup` remains the account-free **interest list**, reachable directly and from existing guild interest invites. The public guild directory remains available; publication requires an account. Creating an account does not subscribe to updates, import interest records, publish a profile or establish membership. Account names are not public player cards, and emails are not verified Battle.net identities.

`/characters`, `/guild` and `/calendar` have server-side session guards and hide their content while a client session is pending, expired or unavailable. Characters and Guild reuse the independently authenticated overview endpoint. Calendar supports month browsing only; it does not invent events or convert undated guild initiatives into dates.

`/forgot-password` requests a generic recovery email; `/reset-password` handles valid, missing/expired/reused tokens, password confirmation and the twelve-character minimum. Successful reset removes the token from the visible URL and asks the user to sign in again. Reset pages use `noindex` and a no-referrer policy. Login and registration offer **Continue with Google**, with safe internal callbacks and a retryable message if OAuth is cancelled/fails. The button is disabled and explains availability when Google is unconfigured; recovery likewise reports unavailable rather than pretending an email was sent when no sender is configured.

## Configuration and session boundary

Use the existing `DB` binding, auth tables, migrations, `BETTER_AUTH_URL` and `BETTER_AUTH_SECRET`. No migration or resource identifier changes are required. **Preserve the deployed secret and auth data**; local testing uses a newly generated local-only secret in ignored `.dev.vars`.

Better Auth owns credential hashing, D1 session storage, cookie issuance/refresh and signout revocation. Cookie names, lifetime, secure/HttpOnly/SameSite behavior and origin checks remain the library defaults; no custom tokens or localStorage credential persistence is introduced. Local HTTP verification checks HttpOnly, SameSite=Lax and persistent expiry. Secure HTTPS production behavior is retained from Better Auth and was not exercised by these local HTTP checks.

`getAccountState` in `src/lib/auth.functions.ts` checks the request headers server-side and returns an explicit `{ name, email }` DTO, never session tokens, IPs or provider account records. Responses are `Cache-Control: no-store`. `requireAccount` enforces the session inside the server function before returning private data, and `/account` calls it in `beforeLoad` for both SSR and client navigation. Better Auth independently enforces sessions on account updates. Future private operations must enforce their own session and ownership checks too; a page guard alone is insufficient.

Missing DB/auth configuration, or a failed session lookup, produces an unavailable account state. Missing configuration also retains the existing HTTP 503 auth endpoint behavior. Public interest and guild functionality does not depend on auth configuration.

`GET /api/account/overview` is an independently authenticated, owner-only endpoint with `Cache-Control: private, no-store` on success and errors. Identity comes exclusively from Better Auth request headers; query-string user IDs are ignored. Its explicit DTO contains character fields and guild names/IDs/ranks, never raw rows, email, BattleTags, avatar storage keys or generation/session tokens. It reads only `guild_memberships`, the owner's non-approved applications and their own `campfire_profiles`/artwork. Neither interest emails, legacy management keys nor campfire-only grants establish a guild membership. Campfire links require both a real guild membership and its current campfire grant; older approved memberships can sync that grant by opening the existing guild hall.

Saved campfire characters have no fulfillable-role field, so the overview says it is not collected rather than inventing roles from class. Guild characters show their actual saved roles. These independent profiles are never silently synchronized or selected as a canonical character. Artwork uses the existing authenticated avatar endpoint; animated sheets show their first frame. Missing artwork, image failure/retry, no character/membership/application, loading, network/server failure/retry and expired sessions have distinct states. Client results are discarded when the session identity changes or the disclosure closes; no private overview cache/localStorage is introduced.

Optional Google sign-in and password recovery are configured server-side as described below; email verification delivery is not implemented. Account screens require JavaScript. Like the current public forms, short/mobile-keyboard/landscape viewports can scroll **inside the content area**, with a fixed document and no horizontal clipping; this is not completion of the PRD's future all-screens/no-scroll milestone.

## Optional Google and password recovery backend

Set the four optional settings below as **Cloudflare Worker secrets** on
`launch-party` (Workers & Pages → launch-party → Settings → Variables and Secrets).
They are runtime provider settings, not GitHub Actions deployment credentials.
Using Worker secrets also preserves them across Wrangler deployments. Keep the
existing `BETTER_AUTH_SECRET`; do not replace it when configuring these providers.

`getAuthFeatures` from `src/lib/auth-features.functions.ts` is a GET server function returning exactly `{ google: boolean, passwordReset: boolean }`, with `Cache-Control: no-store`. It exposes configuration readiness, **not** a provider health/delivery guarantee. Both flags are false without `DB`, `BETTER_AUTH_SECRET` or `BETTER_AUTH_URL`. Each provider additionally requires both of its nonblank settings below. Missing optional configuration leaves normal email/password sign-in functional; partial Google configuration does not register Google, and partial recovery configuration does not register a reset sender. Credentials/options never enter the public DTO.

### Google external setup (operator action)

Create a Google OAuth **Web application** client, configure the consent screen, and supply `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as private Worker configuration (ignored `.dev.vars` locally). Set `BETTER_AUTH_URL=https://launchparty.thunkoid.com` in production. Register these exact authorized redirect URIs as appropriate:

- Production: `https://launchparty.thunkoid.com/api/auth/callback/google`
- Default local development: `http://localhost:3000/api/auth/callback/google`
- Local auth verification on port 3119: `http://localhost:3119/api/auth/callback/google`
- For another local port, register `http://localhost:<port>/api/auth/callback/google` exactly and match `BETTER_AUTH_URL`. A `127.0.0.1` origin is distinct and requires its own exact registration if used.

Only Better Auth's default Google scopes (`openid`, `email`, `profile`) are requested. There is no custom profile mapping, ID-token verification, provider endpoint or `trustedProviders` override. Better Auth's verified-provider-email checks govern same-email account linking; different emails are not allowed to link by an application override. Existing email identities, accounts and deployed secret are preserved. Configure Google test users while the consent screen is in testing, or complete Google's publishing/verification requirements as applicable. Do not treat an OAuth account as a guild membership or Battle.net identity.

### Resend external setup (operator action)

In Resend, add a sending domain you control, install the DNS records Resend supplies (including SPF/DKIM), and wait for verified status. Create an API key authorized to send from that domain. Supply private `RESEND_API_KEY` and `AUTH_EMAIL_FROM`, for example `Launch Party <accounts@your-verified-domain.example>`. The sender must belong to the verified domain; a configured but unverified sender will still show the capability but delivery will fail. Resend sandbox/test sender restrictions do not constitute production delivery setup. Use a controlled recipient and separately verify delivery after provisioning; no real credentials or delivery were used in backend tests.

`src/lib/reset-email.server.ts` sends plain text via REST `POST https://api.resend.com/emails`, with a ten-second timeout, no redirects, no dependency and no configurable provider URL. It sends the exact URL Better Auth supplies, not a separately constructed token or frontend URL. No email outbox/debug endpoint exists. HTTP/network errors are sanitized before Better Auth logs them: no recipient, reset URL/token, API key, raw response body or original provider exception is logged. A Resend acceptance response is not proof of inbox delivery; monitor delivery/bounces in Resend separately.

Better Auth's `advanced.backgroundTasks.handler` uses the actual request-scoped `waitUntil` imported from `cloudflare:workers`. Reset dispatch is registered with that supported background-task mechanism, **not** awaited on the response path and not a bare fire-and-forget promise. Existing/missing accounts retain Better Auth's same generic success body, without introducing a Resend-latency existence oracle. Delivery failures are logged safely in the background, never changed into account-specific public errors. Cloudflare permits up to 30 seconds of background execution after response/disconnect; the ten-second send timeout fits within that bound. This is best-effort dispatch, not a durable queue or automatic retry system.

Recovery uses Better Auth's `requestPasswordReset({ email, redirectTo })` and `resetPassword({ token, newPassword })` APIs. Pass a same-origin recovery page as `redirectTo`; Better Auth checks trusted origins and handles the emailed callback. The existing D1 `verification` table stores reset records. Better Auth retains its one-hour token expiry, single-use validation and generic account-existence response; no custom token flow is implemented. The twelve-character password minimum remains enforced, and `revokeSessionsOnPasswordReset: true` revokes existing sessions. D1 does not support Better Auth's adapter transactions: if a database failure occurs after token consumption/session revocation but before the password write, users may need a new reset link. No new migrations, resources, production secret writes or deployments are part of this change.

### Backend verification

```sh
pnpm exec vitest run tests/auth-providers.test.ts
pnpm check
pnpm build
```

The backend tests use the installed real Better Auth 1.7.15, real Drizzle D1 adapter and the auth SQL migration against an in-memory SQLite D1-statement shim. They cover public flags/no-store/GET contract, partial and missing configuration, actual Google configuration/default authorization scopes/callback construction, email-only signup/signin, Resend payload and sanitized HTTP/network failures, background registration without waiting on email, generic missing/existing responses, valid callback token forwarding, short-password rejection without consuming the token, successful reset, old/new passwords, expiry, token reuse rejection, session revocation, hostile redirect rejection and safe background error logging. Cloudflare `waitUntil` and Resend are mocked; these checks are not a real Workers lifecycle, Google callback or inbox-delivery test. UI coverage is described below.

Verified locally on 2 November 2026: `pnpm install --frozen-lockfile`, `pnpm test` (46 tests, including seven backend provider tests), `pnpm check` and `pnpm build`. Build has the existing CSS sourcemap warning; Node reports its experimental SQLite warning. No generated route tree changes were needed.

## Repeatable local verification

### Post-hackathon home verification

`pnpm test:home` uses a dedicated local server (default `http://localhost:3142`,
override `AUTH_TEST_ORIGIN`). Match `BETTER_AUTH_URL` and use a fresh local-only
secret. For this script, configure **synthetic** Google credentials and a
synthetic Resend key/from address in ignored `.dev.vars` so the optional controls
are enabled; never substitute production secrets just to run tests.

The script checks signed-out login, QR removal, home registration/login return,
Characters/Guild/Calendar navigation and server guards, saved character fields,
approved membership, calendar month navigation, keyboard order, signout and
desktop/mobile/landscape layouts. It requests recovery for a random unknown
`example.invalid` email, then uses a local-only D1 reset-token fixture to verify
the actual reset form/API, password confirmation, old-password rejection,
new-password login and reuse rejection. Google initiation reaches Better Auth's
real authorization redirect, with the Google boundary intercepted before any
external OAuth flow. This is **not** a real Google callback or inbox-delivery test.
Backend tests above exercise the email payload and token lifecycle with a mocked
Resend transport. Real provider credentials and delivery must be verified after
external setup.

`pnpm test:auth` and `pnpm test:account` also passed against the integrated local
app. The landscape browser test was updated to assert the home panel instead of
the removed QR/illustrative characters and passed for every theme at desktop,
narrow mobile and landscape sizes, including keyboard selection, persistence
and reduced motion:

```sh
THEME_TEST_ORIGIN=http://localhost:3142 pnpm exec playwright test --config playwright.themes.config.ts --grep 'every landscape'
```

Run browser suites sequentially: Playwright clears its output directory, which
is also used by the account script's local avatar fixture and screenshots.
New home fixtures are cleaned up; the older auth regression script retains only
synthetic data in the task worktree's ignored local D1 state.

```sh
pnpm install --frozen-lockfile
pnpm db:local
pnpm exec playwright install chromium
# Configure ignored .dev.vars with a fresh local secret and:
# BETTER_AUTH_URL=http://localhost:3119
pnpm dev --port 3119
# In another terminal in this worktree:
pnpm test:auth
AUTH_TEST_ORIGIN=http://localhost:3119 pnpm test:account
pnpm check
pnpm build
```

`AUTH_TEST_ORIGIN` overrides port 3119; the script rejects non-local hostnames. Match `BETTER_AUTH_URL` to the test origin. Tests use real local D1 and Better Auth, unique synthetic `example.invalid` emails, and a clearly synthetic public guild. Test data stays only in ignored local `.wrangler/` state. Screenshots are saved to ignored `test-results/auth-*.png`. No production account, secret, database or deployment is used.

Verified on 1 November 2026:

- Frozen dependency install; all five existing local D1 migrations (including the newly merged guild-recruitment migration); `pnpm check`; `pnpm build` (existing Vite CSS sourcemap warning only).
- `pnpm test:auth`: registration, UI and server 12-character minimum, duplicate account, invalid credentials, retained input/focused alerts, pending submit, visibility toggle, hydration-disabled POST form, real sign-in and retryable network error.
- D1-backed session persistence on reload, account-name update persistence, session-aware landing header, no session token in account HTML, `no-store`, HttpOnly/SameSite/expiry checks.
- Signout revocation verified with a separately copied session cookie, rejection of revoked/anonymous account updates, anonymous server-rendered `/account` redirect with no private content.
- Valid internal return to `/guilds?faction=Alliance`; hostile external/protocol-relative/encoded/backslash/auth/API return destinations fall back to `/account`.
- Keyboard Tab order and layout/control reachability at 1440×900, 1280×720, 390×844, 320×568 and 844×390. Short screens use reachable internal scrolling. Chromium automation does not emulate a real mobile OS keyboard.
- Independent anonymous browser completes all four `/signup` steps without creating a session, browses guilds, publishes a synthetic account-free guild and follows its invite into guild-context signup. Landing QR still links to `/signup`.
- Missing configuration: with the local secret empty and a dev server on port 3120, `AUTH_TEST_ORIGIN=http://localhost:3120 AUTH_TEST_UNAVAILABLE=1 pnpm test:auth` verifies friendly unavailable UI, no credential form, auth HTTP 503, anonymous protected-route rejection and usable public signup. Restore the local secret/origin and restart afterward.

These are local checks, not a production deployment or a claim that every PRD feature is implemented. Browser checks require the documented local configuration and are run explicitly; the existing PR CI runs typecheck/build.

### Logged-in overview verification

`pnpm test:account` defaults to a separate local origin on port 3137 (override with `AUTH_TEST_ORIGIN`, matching `.dev.vars`). It creates synthetic Better Auth accounts in independent Chromium contexts and local D1 fixtures, plus a tiny synthetic saved image in local R2. It checks two approved guild profiles, a separate pending application, a differently named unpublished campfire profile, image loading/owner access, reload persistence, account-name separation, outsider/anonymous isolation, ignored client IDs, non-import of matching interest emails and non-membership campfire grants. Browser checks cover both editors, disclosure keyboard/focus/Escape/outside dismissal, landing/account mobile bounds at 320/390px, landscape reachability, both menu themes, explicit loading, 503/network retry, expired responses, actual D1 session expiry and signout revocation. The script removes its local synthetic account/guild/interest/artwork fixtures. Screenshots remain ignored under `test-results/`. Unit tests additionally exercise actual SQLite ownership queries, removed memberships, DTO stripping, unpublished avatar metadata and corrupt/unavailable storage failing instead of appearing empty.

The auth regression script reflects the merged guild contract: publishing requires an account, while the directory and interest signup remain anonymous. The post-hackathon home no longer has a QR code. No production secrets, data, resource provisioning or deployment are used.

## Campfire follow-up (PR #4)

The independent live-campfire branch's `CAMPFIRE.md` and current auth usage were inspected read-only. Its gateway already reads `getAuth().api.getSession({ headers })`, using the same D1 Better Auth identity. This foundation can target main independently.

When integrating that branch, replace its local sign-in UI with `/login?returnTo=%2Fcampfire` and link authenticated players to its onboarding/room flow. An authenticated account is still **not** a campfire profile or membership: a separate trusted server operation must validate and grant/revoke membership and collect explicit profile publication. Interest records must not become membership grants. This PR does not implement or import campfire Durable Objects, avatars, profile tables or provisioning.

## Documentation checked

- https://www.better-auth.com/docs/integrations/tanstack — SDK actions, mounted handler, last-position `tanstackStartCookies`, server session checks.
- https://www.better-auth.com/docs/authentication/email-password — signup/signin/signout, duplicate-account behavior, provider/delivery requirements.
- https://www.better-auth.com/docs/authentication/google — Google configuration and exact callback URI registration.
- https://www.better-auth.com/docs/reference/options#backgroundtasks — supported Cloudflare background task handler; also checked installed Better Auth 1.7.15 types and reset implementation.
- https://developers.cloudflare.com/changelog/2025-08-08-add-waituntil-cloudflare-workers/ — direct request-context `waitUntil` import (also checked installed Workers types).
- https://developers.cloudflare.com/workers/runtime-apis/context/#waituntil — request lifetime and 30-second background limit.
- https://www.better-auth.com/docs/concepts/cookies — standard cookie persistence and security defaults.
- https://tanstack.com/start/latest/docs/framework/react/guide/server-functions — server-only handlers, authentication at the data boundary and private response caching.

Installed integration versions: Better Auth 1.7.15, TanStack Start 1.169.4, React Router 1.170.46. Existing server configuration, schema and cookie plugin are reused.
