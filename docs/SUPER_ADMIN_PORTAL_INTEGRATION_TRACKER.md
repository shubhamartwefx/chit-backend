# Super-Admin Portal API Integration Tracker

Tracks phased wiring of `chits.artwefx` against `chit-backend`.  
Related: [SUPER_ADMIN_APIS.md](./SUPER_ADMIN_APIS.md), [ARCHITECTURE.md](./ARCHITECTURE.md).

**Rule:** Do not redesign approved UI — data hooks, mappers, loading/error only.

---

## Locked decisions

| ID | Decision |
|----|----------|
| **1A** | BranchUsers / BranchUsersProfile = branch store accounts → reuse `branch_store` APIs / `PlatformUsersList` |
| **2C** | Wire existing APIs first; **defer** CustomAgentChits, App Setting CMS, Notification send, SuperAdminBackup |
| UI freeze | No layout/visual redesign |
| Subscription tabs | Thin SA read APIs for purchase/history (not catalog alone) |

---

## Screen status matrix

| Screen | Status | Notes |
|--------|--------|-------|
| Auth / login | Done | OTP / 2FA |
| AgentList / BidderList / BranchList | Done | list, block, reveal |
| TutorialEdit | Done | CRUD |
| Subscription (plans) | Done | catalog CRUD |
| ChitsList | Done | Phase 1 — `listChits` |
| ChitDetails | Done | Phase 1 — route id + `getChitDetail` |
| AgentDetails | Done | profile, chits, reports, subscriptions |
| BidderDetails | Done | profile, chits, reports, subscriptions |
| BranchDetails | Done | profile PATCH + chit tabs |
| AddchitDetails | Partial | create already wired |
| ReportList | Partial | list wired |
| Dashboard index | Done | `/reports/overview` |
| Profile (self) | Done | `/auth/me` + security |
| SuperAdminAccess | Done | Phase 2 — staff APIs |
| SearchBidderAgent | Done | Phase 2 — `/super-admin/search` |
| BranchUsers | Done | Phase 2 — `PlatformUsersList` branches |
| BranchUsersProfile | Done | Phase 2 — reuse BranchDetails |
| Transactions | Done | Phase 3 — ledger API |
| MapSalesCity | Done | Phase 3 — by-city analytics |
| CustomAgentChits | Deferred | Phase 4 |
| BidderAppSetting | Deferred | Phase 4 |
| AgentDashboardSetting | Deferred | Phase 4 |
| Notification | Deferred | Phase 4 |
| SuperAdminBackup | Deferred | Phase 4 |

---

## Phase checklist

### Phase 0 — Tracker + foundations
- [x] This tracker created
- [x] Portal `.env.local` → `http://localhost:4000/api/v1`

### Phase 1 — Wire chits / details / home / profile
- [x] FE: ChitsList → `listChits`
- [x] FE: ChitDetails → route id + `getChit` / members / installments
- [x] FE: BranchDetails tabs → `listChits({ branchStoreId })`
- [x] FE: Agent/Bidder Report tabs → platform reports
- [x] FE: Agent/Bidder Subscription tabs → SA subscription reads
- [x] FE: Dashboard → `/reports/overview`
- [x] FE: Profile → `/auth/me` + `/auth/security`
- [x] BE: `PATCH /super-admin/branch-stores/:id`
- [x] BE: `GET /super-admin/agents/:id/subscriptions`
- [x] BE: `GET /super-admin/bidders/:id/subscriptions`
- [x] Register new routes in `route-permissions.ts`

### Phase 2 — Staff, search, BranchUsers
- [x] BE: staff get / patch / deactivate
- [x] BE: `GET /super-admin/search`
- [x] FE: `features/staff/api.ts` + SuperAdminAccess
- [x] FE: SearchBidderAgent
- [x] FE: BranchUsers / BranchUsersProfile (1A)
- [x] FE: create agent/branch clients in `features/staff/api.ts` (ready; list modals had no create)

### Phase 3 — Transactions + map + dashboard enrich
- [x] BE: `GET /super-admin/transactions`
- [x] BE: `GET /super-admin/analytics/by-city`
- [x] FE: Transactions, MapSalesCity (SalesCityArea)

### Phase 4 — Deferred backlog (document only)
- [x] Documented below (not implemented per 2C)

---

## Change log

| Date | Phase | Summary |
|------|-------|---------|
| 2026-03-20 | 0 | Tracker created; decisions 1A/2C locked |
| 2026-03-20 | 1 | Branch PATCH + subscription reads; ChitsList/Details/Branch tabs/reports/subscriptions/dashboard/profile wired |
| 2026-03-20 | 2 | Staff CRUD-ish + search BE; SuperAdminAccess, Search, BranchUsers/Profile FE |
| 2026-03-20 | 3 | Transactions ledger + by-city analytics + FE wiring |
| 2026-03-20 | 4 | Deferred backlog recorded (no implementation) |

---

## Deferred backlog detail (Phase 4)

| Item | Intended placement | Why deferred |
|------|--------------------|--------------|
| CustomAgentChits | `/super-admin/agents/:id/chit-grants` | 2C — after core wiring |
| App settings CMS | `modules/app-settings` | Large schema; product MVP TBD |
| Notifications | `modules/notifications` | Provider choice TBD |
| Backup | `modules/platform-backup` | Security-sensitive |

### Suggested follow-up contracts (when un-deferred)

**Custom agent chit grants**
- `GET/POST /super-admin/agents/:id/chit-grants`
- `DELETE /super-admin/agents/:id/chit-grants/:grantId`
- Must fold into `assertCanCreateChit` quota checks for agent role

**App settings (bidder | agent audience)**
- `GET/PUT /super-admin/app-settings/:audience`
- Nested: banners, announcements, legal docs, force-update, FCM config
- Read endpoints later for agent/bidder portals

**Notifications**
- `GET/POST /super-admin/notifications` (+ send action)
- Reuse `notifications:*` permission stubs

**Backup**
- `POST /super-admin/backups`, `GET /super-admin/backups/:id` (`*` only)
