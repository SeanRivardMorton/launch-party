# Account authentication

## User journey

- `/register` creates a Better Auth email/password account and signs it in.
- `/login` signs in an existing account. Interest-list subscribers must create an account separately.
- `/account` is server-protected. It shows the owner's saved campfire character (including unpublished data and saved artwork), all approved per-guild character snapshots, memberships and separately labeled pending/declined applications. Account settings retain the private email, account-name update and signout. Account name is explicitly separate from character nicknames.
- The landing/account headers offer **Sign in** or an accessible **My account** disclosure based on the live session. The disclosure links to characters, guilds, approved guild halls/campfires, account settings and signout. Native links support Tab; arrows/Home/End navigate actions, Escape restores trigger focus, and outside clicks/focus dismiss it. No account email or BattleTag appears in navigation.
- Registration and login accept `returnTo` for internal app pages (default `/account`). External URLs, protocol-relative paths, backslashes, malformed encoding, auth loops and API paths are rejected. The destination is checked again before navigation.
- Pending buttons prevent repeated submissions; errors retain input and authentication errors receive focus. Password visibility is an explicit toggle. Forms use POST and submit buttons stay disabled until hydration, preventing early/default GET submissions of credentials.

`/signup` remains the account-free **interest list**. Its QR code, guild directory, public guild publication and guild interest invites retain their existing behavior. Creating an account does not subscribe to updates, import interest records, publish a profile or establish membership. Account names are not public player cards, and emails are not verified Battle.net identities.

## Configuration and session boundary

Use the existing `DB` binding, auth tables, migrations, `BETTER_AUTH_URL` and `BETTER_AUTH_SECRET`. No migration or resource identifier changes are required. **Preserve the deployed secret and auth data**; local testing uses a newly generated local-only secret in ignored `.dev.vars`.

Better Auth owns credential hashing, D1 session storage, cookie issuance/refresh and signout revocation. Cookie names, lifetime, secure/HttpOnly/SameSite behavior and origin checks remain the library defaults; no custom tokens or localStorage credential persistence is introduced. Local HTTP verification checks HttpOnly, SameSite=Lax and persistent expiry. Secure HTTPS production behavior is retained from Better Auth and was not exercised by these local HTTP checks.

`getAccountState` in `src/lib/auth.functions.ts` checks the request headers server-side and returns an explicit `{ name, email }` DTO, never session tokens, IPs or provider account records. Responses are `Cache-Control: no-store`. `requireAccount` enforces the session inside the server function before returning private data, and `/account` calls it in `beforeLoad` for both SSR and client navigation. Better Auth independently enforces sessions on account updates. Future private operations must enforce their own session and ownership checks too; a page guard alone is insufficient.

Missing DB/auth configuration, or a failed session lookup, produces an unavailable account state. Missing configuration also retains the existing HTTP 503 auth endpoint behavior. Public interest and guild functionality does not depend on auth configuration.

`GET /api/account/overview` is an independently authenticated, owner-only endpoint with `Cache-Control: private, no-store` on success and errors. Identity comes exclusively from Better Auth request headers; query-string user IDs are ignored. Its explicit DTO contains character fields and guild names/IDs/ranks, never raw rows, email, BattleTags, avatar storage keys or generation/session tokens. It reads only `guild_memberships`, the owner's non-approved applications and their own `campfire_profiles`/artwork. Neither interest emails, legacy management keys nor campfire-only grants establish a guild membership. Campfire links require both a real guild membership and its current campfire grant; older approved memberships can sync that grant by opening the existing guild hall.

Saved campfire characters have no fulfillable-role field, so the overview says it is not collected rather than inventing roles from class. Guild characters show their actual saved roles. These independent profiles are never silently synchronized or selected as a canonical character. Artwork uses the existing authenticated avatar endpoint; animated sheets show their first frame. Missing artwork, image failure/retry, no character/membership/application, loading, network/server failure/retry and expired sessions have distinct states. Client results are discarded when the session identity changes or the disclosure closes; no private overview cache/localStorage is introduced.

No OAuth, reset-password or verification actions are shown because there are no configured providers or email delivery. The UI states that password recovery/verification are unavailable. Account screens require JavaScript. Like the current public forms, short/mobile-keyboard/landscape viewports can scroll **inside the content area**, with a fixed document and no horizontal clipping; this is not completion of the PRD's future all-screens/no-scroll milestone.

## Repeatable local verification

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

The auth regression script now reflects the merged guild contract: publishing requires an account, while the directory, QR and interest signup remain anonymous. No production secrets, data, resource provisioning or deployment are used.

## Campfire follow-up (PR #4)

The independent live-campfire branch's `CAMPFIRE.md` and current auth usage were inspected read-only. Its gateway already reads `getAuth().api.getSession({ headers })`, using the same D1 Better Auth identity. This foundation can target main independently.

When integrating that branch, replace its local sign-in UI with `/login?returnTo=%2Fcampfire` and link authenticated players to its onboarding/room flow. An authenticated account is still **not** a campfire profile or membership: a separate trusted server operation must validate and grant/revoke membership and collect explicit profile publication. Interest records must not become membership grants. This PR does not implement or import campfire Durable Objects, avatars, profile tables or provisioning.

## Documentation checked

- https://www.better-auth.com/docs/integrations/tanstack — SDK actions, mounted handler, last-position `tanstackStartCookies`, server session checks.
- https://www.better-auth.com/docs/authentication/email-password — signup/signin/signout, duplicate-account behavior, provider/delivery requirements.
- https://www.better-auth.com/docs/concepts/cookies — standard cookie persistence and security defaults.
- https://tanstack.com/start/latest/docs/framework/react/guide/server-functions — server-only handlers, authentication at the data boundary and private response caching.

Installed integration versions: Better Auth 1.7.15, TanStack Start 1.169.4, React Router 1.170.46. Existing server configuration, schema and cookie plugin are reused.
