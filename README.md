# chit-backend

Saina Chit Funds API — Express + TypeScript + MongoDB (Mongoose).

See **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** for architecture overview and **[docs/PERMISSIONS.md](./docs/PERMISSIONS.md)** for the RBAC permission matrix.

## Quick start

```bash
cp .env.example .env
npm install
# Ensure MongoDB is running locally
npm run migrate:branch-store   # if upgrading from admin role
npm run seed
npm run dev
```

API: `http://localhost:4000`  
Health: `GET /health`  
API base: `/api/{API_VERSION}` (default `/api/v1`, set via `API_VERSION` in `.env`)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with hot reload (`tsx watch`) |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run compiled server |
| `npm run seed` | Create demo users (all 4 roles) |
| `npm run migrate:branch-store` | Migrate legacy `admin` role → `branch_store` |
| `npm run lint` | Typecheck |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `API_VERSION` | `v1` | API path version (`1` or `v1` both work) |
| `PORT` | `4000` | Server port |
| `PORT_FALLBACK_MAX_ATTEMPTS` | `10` | Dev-only: try next ports if busy |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Access JWT lifetime |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh session lifetime |
| `JWT_EXPIRES_IN` | `15m` | Legacy alias (prefer access TTL) |

## Auth (role-specific)

```http
POST /api/v1/auth/super-admin/request-otp
Content-Type: application/json

{
  "countryCode": "+91",
  "phone": "9999999999",
  "aadhaarNumber": "123456789012"
}
```

```http
POST /api/v1/auth/super-admin/verify-otp
Content-Type: application/json

{
  "countryCode": "+91",
  "phone": "9999999999",
  "aadhaarNumber": "123456789012",
  "otp": "123456"
}
```

Auth URL slugs: `super-admin`, `branch-store`, `admin` (alias → branch store), `agent`, `bidder`.

Use the returned `accessToken` as `Authorization: Bearer <token>`.

Also store `refreshToken`. Access tokens expire quickly (default 15m). When expired:

```http
POST /api/v1/auth/refresh
Content-Type: application/json

{ "refreshToken": "<refreshToken>" }
```

Returns a new access + refresh pair (rotation). `POST /auth/logout` revokes the current session; `POST /auth/logout-all` revokes every session for the user.

## Bidder signup (self-registration)

Public, rate-limited APIs under `/api/v1/auth/bidder/register`. Mock Aadhaar OTP + DigiLocker providers; swap DigiLocker later via env.

```http
POST /api/v1/auth/bidder/register/aadhaar/request-otp
{ "aadhaarNumber": "354136431636" }

POST /api/v1/auth/bidder/register/aadhaar/verify-otp
{ "sessionId": "<id>", "otp": "123456" }

POST /api/v1/auth/bidder/register/complete
{ "sessionId": "<id>", "countryCode": "+91", "phone": "9876543210", "currentAddress": "optional" }
```

`complete` creates the bidder and returns an access + refresh token pair (auto-login). Aadhaar-fetched fields are sealed server-side. DigiLocker: `POST .../digilocker/start` then `GET .../digilocker/callback?code=mock-digilocker-code&state=...` with `Accept: application/json`.

## RBAC structure

```
src/config/
├── constants/
│   ├── roles.ts         # USER_ROLES, USER_STATUS
│   ├── permissions.ts   # PERMISSIONS catalog
│   └── routes.ts        # URL slugs, dashboard paths
├── rbac/
│   ├── role-permissions.ts
│   ├── super-admin-tiers.ts
│   ├── route-permissions.ts
│   └── helpers.ts       # hasPermission(), validatePermissionsForRole()
└── roles.ts             # Re-export barrel
```

## Create a Branch Store user (Super Admin only)

```http
POST /api/v1/super-admin/branch-stores
Authorization: Bearer <super_admin_token>
Content-Type: application/json

{
  "name": "Branch Store Manager",
  "countryCode": "+91",
  "phone": "9888888888",
  "aadhaarNumber": "987654321098",
  "permissions": ["agents:read", "bidders:read", "reports:read"]
}
```

Deprecated alias: `POST /api/v1/super-admin/admins`

## Create Agent / Bidder / Super Admin staff

```http
POST /api/v1/super-admin/agents
POST /api/v1/super-admin/bidders
POST /api/v1/super-admin/staff
```

Staff creation requires `tier`: `full` | `manager` | `editor` (only `full` tier users can create staff).

## Permission catalog API

```http
GET /api/v1/super-admin/permissions
Authorization: Bearer <super_admin_token>
```

## Postman

Import the collection and environment from [`postman/`](./postman/):

- `postman/Saina-Chit-Backend.postman_collection.json`
- `postman/Saina-Chit-Backend.local.postman_environment.json`

See [postman/README.md](./postman/README.md) for import and login steps.

See [docs/API_STATUS.md](./docs/API_STATUS.md) for the status code catalog.
