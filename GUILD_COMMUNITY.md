# Authenticated guild community

## User journey

1. Sign in or register with Better Auth on `/guilds/new`, publish the guild, and become its lead.
2. Share `/guilds/<id>`. A prospect follows **Apply to join** to `/guilds/<id>/apply` and submits a nickname, character plan and optional introduction.
3. The lead/officers review pending applications in `/guilds/<id>/manage`. Approval creates an authenticated member; decline retains only application state.
4. Members enter the same guild hall to browse the private roster, guild initiatives and needs, and update their own character.
5. Leads appoint/demote officers. Leads/officers maintain initiatives and recruitment needs. Officers can remove ordinary members; only the lead can remove officers. The lead is protected from removal/demotion.

The public interest form remains independent. A matching email, interest signup or public guild ID does not prove guild membership or ownership.

## Storage and ownership

Forward-only migration `0006_guild_community.sql` adds:

- `guilds.owner_user_id`: the authenticated owner, nullable on pre-existing listings.
- `guild_memberships`: unique `(guild_id, user_id)`, `leader`/`officer`/`member`, validated character snapshot and join timestamp. A partial unique index permits at most one lead.
- `guild_applications`: unique guild/user application, character snapshot, introduction, `pending`/`approved`/`declined`, timestamps and decision actor.
- `guild_initiatives`: title, description, `planned`/`active`/`completed`, creator and timestamps.

Legacy guild creators sign in and explicitly claim leadership with their private management key. The conditional ownership update and membership insert run in one D1 batch; the winning owner determines the sole lead. Another account cannot claim an already-owned guild. The key stays in the URL fragment on the client and is sent only in the claim JSON body. Only its existing SHA-256 hash is stored.

After ownership is established, needs editing requires a current lead/officer session. Old key-only needs editing remains compatible only while a legacy guild is unclaimed. Previously saved interest records and recruitment needs are preserved.

## API

Public `/api/guilds` and `/api/guilds/<id>` still expose only guild listing fields and recruitment needs.

`GET /api/guilds/<id>/community?membersPage=0&applicationsPage=0` requires a real Better Auth session. It returns viewer role/application status, claim availability and:

- Approved members: 20 roster entries per page and up to 50 initiatives.
- Lead/officers: additionally 20 pending applications per page.
- Nonmembers: empty member/application/initiative arrays and only their own application state.

Member cards contain nickname, faction, race/class, fulfillable roles, professions and guild role. They never contain account email, passwords, session tokens or management keys. Pending introductions are shown only to the lead/officers.

`POST /api/guilds/<id>/community` accepts these actions, with identity always derived from the session:

| Action | Payload | Authority |
| --- | --- | --- |
| `apply` | `profile`, optional `introduction` | Signed-in nonmember |
| `claim` | `managementKey` | Signed-in holder of the legacy private key |
| `approve` / `decline` | `userId` | Lead/officer |
| `set-role` | `userId`, `role: officer/member` | Lead |
| `remove-member` | `userId` | Lead; officer for ordinary members only |
| `update-profile` | `profile` | Self, approved member |
| `create-initiative` | `title`, `description`, `status` | Lead/officer |
| `update-initiative` | `initiativeId`, `title`, `description`, `status` | Lead/officer |
| `delete-initiative` | `initiativeId` | Lead/officer |

`PATCH /api/guilds/<id>` updates `recruitmentNeeds` for lead/officers. Writes enforce exact origin, bounded JSON, shared character validation and parameterized SQL. Conditional mutations recheck managerial authority in SQL; approval inserts membership and updates application status in a transaction. Repeated approvals create one membership. Removed members immediately lose private roster/initiative access on subsequent requests.

## Live-campfire handoff

[PR #4](https://github.com/SeanRivardMorton/launch-party/pull/4) independently owns the Durable Object/avatar resources and `campfire_memberships`. This feature does not create or redefine that table and does not provision those resources.

When the table exists, new leads, ownership claims and approved applications receive a corresponding campfire membership. Removals delete the corresponding grant. Existing approved members are synchronized when they open the guild hall. The bridge copies only guild/user IDs from actual `guild_memberships`; pending applicants never receive a grant.

The guild hall exposes the campfire link only when this table is present. Campfire character publication remains an explicit action in its own editor; guild approval does not silently publish player artwork or profiles. The independent campfire gateway remains responsible for session expiry, published-profile requirements and socket revocation checks.

## Local verification

Configure `.dev.vars` with a fresh local secret and the local server origin, then:

```sh
pnpm db:local
pnpm dev
# In another terminal:
pnpm test:guilds
pnpm check
pnpm build
```

The API tests use real local Better Auth and D1. They verify lead ownership, applicant privacy, approval/idempotency, valid class roles, officer restrictions, initiatives, needs, removal/revocation, concurrent approvals, 24-member pagination and legacy claims. The optional campfire-grant contract is exercised with a local fixture table when PR #4 has not yet supplied it; only an empty table created by that test is removed. All accounts use synthetic `example.invalid` emails; only those fixture guilds/users are cleaned up. Tests refuse non-local server hosts.

Chromium checks additionally exercised account registration/sign-in/sign-out, actual guild publication, application/approval/decline/reapplication, officer promotion and demotion, initiative creation/editing/deletion, recruitment editing across sessions, member profile updates and removal, using four independent browser contexts. Layouts were checked at 1280×900 and 320×568, including internal scrolling, keyboard focus and error/retry recovery. Hall refresh updates published needs while preserving an unsaved editor draft. Those browser checks were run locally, not against production.

Production migrations and deployment belong to the existing GitHub Actions pipeline after PR review/merge. No production migration or direct deployment is part of local verification.

## BattleTags

Approved members can save an optional, self-provided BattleTag in the guild hall.
One tag is stored per account and shared with approved members of its guilds.
It can be edited or removed by its owner; a blank value removes it everywhere.
This is manual contact sharing, not Battle.net OAuth or a verified identity.

The private roster and campfire character cards offer **Copy BattleTag**, with
manual copying supported if clipboard access is unavailable. The campfire fetches
the tag only when opening a card, using a private, non-cacheable endpoint that
checks both users' current approved membership in the requested guild. Tags are
not added to WebSocket snapshots, public profiles, guild listings or applications.
Outsiders, pending/declined applicants and removed members cannot read them.
Previously viewed information cannot be retracted from another person's memory
or clipboard; edits/removal apply to subsequent server reads.

Migration `0007_member_battletags.sql` stores tags separately from public character
data. `pnpm test:guilds` includes privacy, validation, ownership, removal and
cross-guild authorization checks using local Better Auth sessions and D1.
