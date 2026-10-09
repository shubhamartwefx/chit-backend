# Super-Admin APIs — Implementation Guide

Start here when implementing or extending **super-admin** HTTP APIs in `chit-backend`, and when wiring them into the admin portal (`chits.artwefx`).

Related docs:

- [PERMISSIONS.md](./PERMISSIONS.md) — role tiers and permission matrix
- [ARCHITECTURE.md](./ARCHITECTURE.md) — module layout
- [API_STATUS.md](./API_STATUS.md) — response / status conventions
- [AUTH_REQUIREMENTS.md](./AUTH_REQUIREMENTS.md) — auth flows

---

## 1. Goals

1. **Platform control** — super-admin manages users (branch / agent / bidder / staff), blocks accounts, and owns global content (subscription plans, tutorials).
2. **Parity with agent portal** — over time, expose the same domain capabilities the agent portal already uses (bidders, chits, reports, PDFs, calendar, etc.) under `/super-admin/*`, with **platform-wide** scope instead of operator-scoped data.
3. **Least privilege** — use existing tier markers (`*`, `platform:super_admin:manager`, `platform:super_admin:editor`); do not grant agent-style write to portals that should only read.

### Role rules (product)

| Action | Who |
|--------|-----|
| Block / unblock any bidder, agent, or branch user | Super-admin only |
| Subscription plan create / update / delete | Super-admin only |
| Tutorial create / update / delete | Super-admin only |
| Agent / branch / bidder portals | View (and buy) subscriptions & tutorials; **no** content CRUD; **no** user blocking |

---

## 2. Conventions (follow existing code)

| Concern | Pattern |
|---------|---------|
| Mount | `src/routes/index.ts` → `/super-admin` |
| Router | [`src/modules/super-admin/super-admin.routes.ts`](../src/modules/super-admin/super-admin.routes.ts) |
| Auth gate | `authenticate` + `authorize(USER_ROLES.SUPER_ADMIN)` on the router |
| Fine-grained access | `authorizeIf(canListPlatformUsers)` / `canCreateBranchStoreUser` / etc. from `src/config/rbac` |
| Route permission map | [`src/config/rbac/route-permissions.ts`](../src/config/rbac/route-permissions.ts) — **every new route must be registered** |
| Validation | Zod schemas + `validate(...)` middleware |
| Responses | `sendSuccess` / domain errors from `src/common/errors` |
| Shared domain logic | Prefer reusing services (`subscription-plans`, `tutorials`, `chits`, …) rather than copying agent controllers |

**Do not** put operator-scoped rules (createdBy / agentId) into super-admin list handlers. Super-admin lists are **global** (with filters).

---

## 3. Already implemented

Base path: `/super-admin`  
Role: `super_admin`

### Users & platform

| Method | Path | Notes |
|--------|------|--------|
| GET | `/permissions` | Permission catalog |
| POST / GET | `/branch-stores` | Create / list branch stores |
| GET | `/branch-stores/:id` | Branch store detail + chit summary |
| POST / GET | `/agents` | Create / list agents (list includes `chitCount`, `reportCount`) |
| GET | `/agents/:id` | Agent detail: profile, `aadhaarVerified`/`aadhaarStatus`, `nominees[{ id, name, role }]`, `chits[{ id, chitCode, amountInLakhs, bidderCount, ticketCount }]` |
| PATCH | `/agents/:id` | Body `{ phone2?, currentAddress?: { street?, city?, state?, pincode?, country? } }` — admin edit of agent profile; address is merged into the existing one; returns the agent detail |
| POST / GET | `/bidders` | Create / list bidders (list includes `agentName`/`createdByName`, `chitCount`, `reportCount`) |
| GET | `/bidders/:id` | Bidder detail (platform scope); `chits[]` include this bidder's `numberOfTickets` and `bidderCount`; nominees include `role` |
| PATCH | `/bidders/:id` | Body `{ phone2?, currentAddress?: { street?, city?, state?, pincode?, country? } }` — address merged over the existing one |
| GET | `/bidders/:id/reports` | Reports for that bidder |
| PATCH | `/bidders/:id/assign-agent` | Body `{ agentId }` — set ownership (`createdBy`) to an agent |
| GET | `/reports` | Platform-wide member reports list. Query: `q`, `page`, `limit`, `reportedBy` (comma-separated agent ids; filters by reporter) |
| POST / GET | `/staff` | Create / list super-admin staff |
| PATCH | `/staff/:userId/permissions` | Full super admin (`*`) only. Body `{ add?: ['privacy:reveal'], remove?: ['privacy:reveal'] }` (grantable whitelist only, strict). Target must be another non-`*` super-admin staff member. Returns the updated staff record; takes effect on the staff member's next token refresh |
| POST / GET | `/admins` | Deprecated aliases for branch-stores |
| POST | `/users/:userId/block` | Body: `{ reason }` — cannot block self / other super-admins |
| POST | `/users/:userId/unblock` | Body: `{ reason }` |
| POST | `/users/:userId/reveal` | `*` or `privacy:reveal`. Body `{ field: 'aadhaar' }`. Returns `{ field, value, revealedAt }` with `Cache-Control: no-store`. Every attempt is audited in `SensitiveDataAccessLog` (value never stored). Errors: `403` no permission, `404` user missing / field not applicable to role, `409 SENSITIVE_DATA_NOT_ON_FILE` (legacy account; captured on next Aadhaar login), `429` over 30 reveals per 15 min per staff member |

### Subscription plans (CRUD complete)

| Method | Path |
|--------|------|
| GET | `/subscription-plans` |
| POST | `/subscription-plans` |
| PUT | `/subscription-plans` (bulk upsert) |
| PATCH | `/subscription-plans/:id` |
| DELETE | `/subscription-plans/:id` |

Each plan carries `totalChits` (the agent's active-chit limit). When omitted on create/update/bulk it is derived from the first feature matching "Up to N". Agent portal lists plans via `GET /agent/subscription-plans` and buys or upgrades one via `POST /agent/subscriptions/create-order` + `POST /agent/subscriptions/confirm` (Razorpay checkout, demo confirm); invoices via `GET /agent/invoices`.

---

## 4. Agent portal APIs (source of truth for parity)

These live under `/agent` today ([`agent.routes.ts`](../src/modules/agent/agent.routes.ts)). Super-admin parity means **equivalent capability** under `/super-admin`, not copying operator scoping.

| Domain | Agent routes (today) | Super-admin target |
|--------|----------------------|--------------------|
| Bidders | `GET/POST /bidders`, `PATCH /bidders/:id`, `GET /bidders/:id/reports`, block/unblock | List/create already exist; add **GET by id** (detail); block via `/users/:userId/block` only — **remove** agent/branch block in product phase |
| Subscriptions | `GET /subscription-plans` | CRUD already on super-admin |
| Tutorials | Full CRUD on `/agent/tutorials` | **Move write to super-admin**; agent/branch keep GET only + `language` filter |
| Promotion PDFs | Full CRUD `/pdfs` | Add `/super-admin/pdfs` (global) |
| Calendar | Full CRUD `/calendar-events` | Add `/super-admin/calendar-events` (global) |
| Reports | `GET /reports` | Add platform-wide reports list |
| Chits | Shared `/chits/*` (permission-gated) | Confirm super-admin can list/manage all chits; add dedicated list/detail if FE needs it |

Also planned on agent (not only super-admin):

- `GET /agent/bidders/:id` — profile + chit summary for Bidder Details deep link (`?bidderId=`).

---

## 5. Implementation phases

### Phase A — Immediate (permissions & content ownership)

Ship these first; unblock admin UI and remove agent write/block.

#### A1. Tutorials under super-admin

1. Add `language` on tutorial model: `en | kn | ta | te | ml | hi` (default `en`).
2. List query: `?language=en` (and existing `q`, `category`, `page`, `limit`).
3. Mount on super-admin:

| Method | Path | Permission helper (suggested) |
|--------|------|-------------------------------|
| GET | `/super-admin/tutorials` | `canListPlatformUsers` |
| GET | `/super-admin/tutorials/:id` | `canListPlatformUsers` |
| POST | `/super-admin/tutorials` | manager+ (`canCreateBranchStoreUser` or editor if product allows) |
| PATCH | `/super-admin/tutorials/:id` | same as POST |
| DELETE | `/super-admin/tutorials/:id` | same as POST |

4. Keep `GET /agent/tutorials` (+ optional `GET /branch-store/tutorials`); **remove** agent `POST/PATCH/DELETE /tutorials`.
5. Register all keys in `route-permissions.ts`.
6. Seed existing rows as `language: 'en'`.

#### A2. Blocking — super-admin only

1. Keep `POST /super-admin/users/:userId/block|unblock`.
2. Remove `POST /agent/bidders/:id/block|unblock` and `POST /branch-store/bidders/:id/block|unblock` (+ RBAC entries).
3. Wire admin FE [`PlatformUsersList`](../../chits.artwefx/src/features/admin/PlatformUsersList.tsx) to block/unblock with reason modal.

#### A3. Subscriptions FE

Backend CRUD exists. Wire `chits.artwefx` PricePlanList to `/super-admin/subscription-plans` (audience: agent / branch / bidder). Leave agent/branch/bidder portals view-only.

#### A4. Tutorials FE

- Admin TutorialEdit → `/super-admin/tutorials` CRUD + language tabs.
- Agent/branch Tutorial pages → GET + language dropdown (English default); remove Add/Edit/Delete.

### Phase B — Bidder detail APIs (agent portal, then reuse for admin)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/agent/bidders/:id` | Profile (name, phones, address, nominees, aadhaar flags) + `chitIds` / counts / amount-bucket summary; `chits[].numberOfTickets` = this bidder's tickets on each chit |
| PATCH | `/agent/bidders/:id` | Edit profile: any of `name`, `phone2` (10-digit, `""` clears), `currentAddress {street (Area), city (District), state, pincode, country?}`; returns the GET detail |
| GET | `/agent/bidders?q=` | `q` also accepts the display id `BD-XXXX-XXXX` (last 8 hex of `_id`), looked up globally like an exact phone |
| (existing) | `POST /chits/:id/members/:bidderId/transfer` | Bidder Details "move": `{ toBidderId, numberOfTickets }` |
| (existing) | `GET /agent/bidders/:id/reports` | Reports for that bidder |
| (existing) | `GET /chits/:id` (+ installments) | Drive Bidder Details chit tabs |

FE: remove **Bidder Details** from sidebar; open `/agent-dashboard/BidderDetails?bidderId=` from Bidder List (same pattern as `ChitDetail?chitId=`).

Later: `GET /super-admin/bidders/:id` with platform-wide access for admin detail screens.

### Phase C — Full agent-portal parity on super-admin (deferred)

Implement when Phase A/B are stable. Prefer thin routers that call shared services with `scope: 'platform'`.

Suggested order:

1. `GET /super-admin/bidders/:id` (+ reports)
2. Chits overview / detail for admin dashboard
3. `/super-admin/reports`
4. `/super-admin/pdfs` CRUD
5. `/super-admin/calendar-events` CRUD
6. Notifications / remaining mock admin screens

For each module:

1. Extract or generalize service methods (operator scope vs platform scope).
2. Add routes on `super-admin.routes.ts`.
3. Add Zod validation (reuse shared schemas where possible).
4. Register `ROUTE_PERMISSIONS`.
5. Add Postman / smoke checks.
6. Wire `chits.artwefx` feature API client + page.

---

## 6. Checklist — starting a new super-admin endpoint

Use this for every new route:

- [ ] Decide **read** vs **write** and which tier (`editor` list vs `manager` mutate vs `*`).
- [ ] Reuse an existing service if one exists; avoid duplicating Mongo queries.
- [ ] Add Zod schema in the domain module (or `super-admin.validation.ts` for user-only ops).
- [ ] Add controller method (or mount existing domain controller).
- [ ] Register route in `super-admin.routes.ts` with `authorizeIf(...)`.
- [ ] Add entry to `src/config/rbac/route-permissions.ts`.
- [ ] Confirm response shape matches `{ success, message, data }` ([API_STATUS.md](./API_STATUS.md)).
- [ ] Document the path in this file’s inventory tables.
- [ ] Add/adjust FE client under `chits.artwefx/src/features/...`.

---

## 7. Suggested request / response sketches

### Block user

```http
POST /super-admin/users/:userId/block
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "reason": "Fraudulent activity reported" }
```

### Reveal sensitive field

```http
POST /super-admin/users/:userId/reveal
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "field": "aadhaar" }
```

Response `data`: `{ "field": "aadhaar", "value": "123456789012", "revealedAt": "2026-10-09T10:00:00.000Z" }`.

New revealable fields are added to `REVEALABLE_FIELDS` in `src/modules/sensitive-data/revealable-fields.ts` (allowed target roles, select string, resolver); the route, permission and audit log stay unchanged.

### Create tutorial (after Phase A)

```http
POST /super-admin/tutorials
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "title": "New Chit",
  "category": "Chit Management",
  "description": "How to create your first chit",
  "content": "<p>Step-by-step…</p>",
  "video": "https://www.youtube.com/watch?v=…",
  "imageUrl": "https://example.com/cover.png",
  "language": "en",
  "sortOrder": 0
}
```

- Body is strict (unknown fields → 400). `PATCH` accepts any subset of the same fields.
- `description`: plain text, ≤ 300 chars. `content`: HTML, ≤ 20000 chars, **sanitized server-side** (`src/common/html-sanitizer.ts` allowlist: text formatting, headings, lists, links, images, tables; no scripts, iframes, styles or event handlers; `http`/`https`/`mailto` only). Clients may render it as HTML.
- `video` / `imageUrl`: empty string or an `http(s)` URL. Empty means none (no placeholder). YouTube `watch?v=` / `youtu.be` links are stored as embed URLs.
- Responses include `description`, `content`, `video`, `imageUrl` (empty strings when unset).

### List tutorials by language (agent / admin)

```http
GET /agent/tutorials?language=kn&page=1&limit=100
GET /super-admin/tutorials?language=en
```

### Bidder detail (Phase B)

```http
GET /agent/bidders/:id
Authorization: Bearer <accessToken>
```

`data` should include profile fields + `chitIds` + summary cards enough for Bidder Details FE (replace mocks in `getBidderProfileData.ts`).

---

## 8. Frontend touchpoints

| App | Role | Work |
|-----|------|------|
| [`chits.artwefx`](../../chits.artwefx) | Super-admin | Block UI; TutorialEdit + PricePlanList → real APIs; later full module parity |
| [`App.chits-fund`](../../App.chits-fund) agent | Agent | Remove block column; tutorials view + language; Bidder Details deep link |
| App.chits-fund branch | Branch store | Same view/block rules; tutorials GET when route exists |
| App.chits-fund bidder | Bidder | Subscription view only |

Auth slug for admin login: `super-admin` (see [PERMISSIONS.md](./PERMISSIONS.md)).

---

## 9. Out of scope for Phase A

- Full admin UI parity with every agent screen (Phase C).
- New bidder-facing Tutorial menu (bidder has none today).
- Changing auth / 2FA flows.

---

## 10. File map (quick links)

| Area | Path |
|------|------|
| Super-admin routes | `src/modules/super-admin/super-admin.routes.ts` |
| Super-admin service | `src/modules/super-admin/super-admin.service.ts` |
| Subscription plans | `src/modules/subscription-plans/` |
| Tutorials | `src/modules/tutorials/` |
| Operator bidders (agent/branch) | `src/modules/operator-bidders/` |
| Route permissions | `src/config/rbac/route-permissions.ts` |
| Admin FE lists | `chits.artwefx/src/features/admin/PlatformUsersList.tsx` |
| Agent tutorials FE | `App.chits-fund/src/app/(Agent)/agent-dashboard/Tutorial/` |
| Agent bidder details FE | `App.chits-fund/src/app/(Agent)/agent-dashboard/BidderDetails/` |
