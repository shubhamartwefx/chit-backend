# Saina Chit Funds — Permission Matrix

Reference for role-based and permission-level access control in `chit-backend`.

## Permission naming

Format: `{resource}:{action}` where `action` is `read` or `write`.

Platform tier markers: `platform:super_admin:editor`, `platform:super_admin:manager`, `*`.

## Role models

| Role | Internal value | Auth URL slug(s) | Permission model |
|------|----------------|------------------|------------------|
| Super Admin | `super_admin` | `super-admin` | Tier: `full` (`*`), `manager`, or `editor` |
| Branch Store | `branch_store` | `branch-store`, `admin` (FE alias) | Assignable subset from Super Admin |
| Agent | `agent` | `agent` | Fixed default set on creation |
| Bidder | `bidder` | `bidder` | Fixed default set on creation |

## Super Admin tiers

| Tier | Marker | Can create branch store users | Can create super admin staff |
|------|--------|------------------------------|------------------------------|
| Full | `*` | Yes | Yes |
| Manager | `platform:super_admin:manager` | Yes | No |
| Editor | `platform:super_admin:editor` | No | No |

Hierarchy: `*` > manager > editor (manager satisfies editor-level checks).

## Domain permission catalog

| Permission | Description |
|------------|-------------|
| `branches:read` | View branch data |
| `branches:write` | Create/update branches |
| `agents:read` | View agents |
| `agents:write` | Create/update agents |
| `bidders:read` | View bidders |
| `bidders:write` | Create/update bidders |
| `chits:read` | View chits |
| `chits:write` | Create/update chits |
| `reports:read` | View reports |
| `notifications:read` | View notifications |
| `notifications:write` | Send notifications |

## Default permission sets

### Agent (auto-assigned)

- `agents:read`, `bidders:read`, `bidders:write`, `chits:read`, `chits:write`, `reports:read`

### Bidder (auto-assigned)

- `chits:read`, `reports:read`

`notifications:*` remain in the domain catalog / branch assignable set but are **not** auto-granted until a notifications module ships.

## Route permission registry

Defined in [`src/config/rbac/route-permissions.ts`](../src/config/rbac/route-permissions.ts).

| Route | Required (any of) |
|-------|-------------------|
| `POST /super-admin/branch-stores` | `platform:super_admin:manager`, `*` |
| `GET /super-admin/branch-stores` | `platform:super_admin:editor`, `platform:super_admin:manager`, `*` |
| `POST /super-admin/agents` | `platform:super_admin:manager`, `*` |
| `GET /super-admin/agents` | editor, manager, or `*` |
| `POST /super-admin/bidders` | manager or `*` |
| `GET /super-admin/bidders` | editor, manager, or `*` |
| `POST /super-admin/staff` | `*` only |
| `GET /super-admin/staff` | manager or `*` |
| `GET /branch-store/agents` | `agents:read` |
| `GET /branch-store/bidders` | `bidders:read` |
| `POST /branch-store/bidders` | `bidders:write` |
| `POST /branch-store/bidders/:id/block` | `bidders:write` |
| `POST /branch-store/bidders/:id/unblock` | `bidders:write` |
| `GET /agent/bidders` | `bidders:read` |
| `POST /agent/bidders` | `bidders:write` |
| `POST /agent/bidders/:id/block` | `bidders:write` |
| `POST /agent/bidders/:id/unblock` | `bidders:write` |
| `POST /bidder/chits/:id/join` | `chits:read` |
| `GET /chits` | `chits:read` |
| `GET /chits/summary` | `chits:read` |
| `GET /chits/:id` | `chits:read` |
| `POST /chits` | `chits:write` |
| `PATCH /chits/:id` | `chits:write` |
| `DELETE /chits/:id` | `chits:write` |
| `POST /chits/:id/members` | `chits:write` |
| `PATCH /chits/:id/members/:bidderId` | `chits:write` |
| `DELETE /chits/:id/members/:bidderId` | `chits:write` |
| `GET /chits/:id/installments` | `chits:read` |
| `POST /chits/:id/installments` | `chits:write` |
| `GET /chits/:id/auction-rounds` | `chits:read` |
| `POST /chits/:id/auction-rounds` | `chits:write` |
| `GET /chits/:id/auction-rounds/:roundId` | `chits:read` |
| `POST /chits/:id/auction-rounds/:roundId/bids` | `chits:read` (bidder role) |
| `POST /chits/:id/auction-rounds/:roundId/close` | `chits:write` |
| `GET /reports/overview` | `reports:read` |
| `POST /super-admin/users/:userId/block` | `platform:super_admin:manager`, `*` |
| `POST /super-admin/users/:userId/unblock` | `platform:super_admin:manager`, `*` |

Deprecated aliases `/super-admin/admins` use the same rules as `/branch-stores`.

**Provisioning:** Branch store accounts are **Super Admin only** (`POST /super-admin/branch-stores`). Agent and bidder may self-signup; SA and peer operators may also create bidders. Branch assignable permissions include full domain set (`chits:*`, `bidders:*`, etc.).

**Account block:** Platform can block branch/agent/bidder. Operators can block/unblock only bidders they **created** (`createdBy`). List endpoints support `status=blocked`.

Chit routes at `/api/v1/chits`: **read** allows `super_admin`, `branch_store`, `agent`, and `bidder`; **write** allows the first three only. **Peer ownership:** agents → own chits (`agentId`); branch stores → own chits (`branchStoreId`, no agent required); bidders → chits where they are in `members[]`; super admin → all (create requires `agentId` **or** `branchStoreId`).

Blocked users receive `403 ACCOUNT_BLOCKED` with `{ reason }` in `details` on login, refresh, and any authenticated API call.

## Middleware

1. `authenticate` — valid JWT required
2. `authorize(...roles)` — role must match module
3. `authorizePermission(...perms)` — ALL permissions required (AND)
4. `authorizeAnyPermission(...perms)` — ANY permission required (OR)
5. `authorizeIf(fn)` — custom predicate over JWT permissions

## Adding new endpoints

1. Add permission string to `src/config/constants/permissions.ts` if new resource/action
2. Register route in `src/config/rbac/route-permissions.ts`
3. Apply `authorizePermission` or `authorizeIf` on the route
4. Update this document

## FE compatibility notes

- Auth slug `admin` remains valid and maps to `branch_store`
- JWT `role` value is now `branch_store` (not `admin`) — FE may need to accept both when reading cookies
- `redirectTo` paths unchanged: `/admin-dashboard/index` for branch store users

## Migration

Run once after deploy:

```bash
npm run migrate:branch-store
npm run migrate:agent-chits-write
```

`migrate:agent-chits-write` grants `chits:write` to existing agent users created before that permission was added to `AGENT_DEFAULT`.

Renames existing MongoDB users with `role: 'admin'` to `role: 'branch_store'`.
