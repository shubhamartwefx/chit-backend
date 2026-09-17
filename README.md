# chit-backend

Saina Chit Funds API — Express + TypeScript + MongoDB (Mongoose).

See **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** for architecture overview and **[docs/PERMISSIONS.md](./docs/PERMISSIONS.md)** for the RBAC permission matrix.

## API docs (Swagger)

With the server running (`npm run dev`):

- **UI:** http://localhost:4000/api/docs  
- **OpenAPI JSON:** http://localhost:4000/api/docs.json  

1. Call **Auth → verify-otp** for a role (seed OTP `123456`)
2. Click **Authorize** and paste `data.accessToken`
3. Use **Try it out** on protected routes

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
**Swagger UI:** [`http://localhost:4000/api/docs`](http://localhost:4000/api/docs) · OpenAPI JSON: `/api/docs.json`

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

### Demo signup payment (agent / bidder)

```http
POST /api/v1/auth/payments/create-order
{ "role": "agent", "sessionId": "<verified-signup-session>" }

POST /api/v1/auth/payments/confirm
{ "orderId": "order_demo_...", "paymentId": "optional" }

POST /api/v1/auth/agent/register/complete
{ "sessionId", "phone", "countryCode", "paymentId": "<from confirm>" }
```

Fees: `SIGNUP_FEE_AGENT` (700) / `SIGNUP_FEE_BIDDER` (300). `PAYMENT_MODE=demo` confirms without Razorpay.


Use the returned `accessToken` as `Authorization: Bearer <token>`.

Also store `refreshToken`. Access tokens expire quickly (default 15m). When expired:

```http
POST /api/v1/auth/refresh
Content-Type: application/json

{ "refreshToken": "<refreshToken>" }
```

Returns a new access + refresh pair (rotation). `POST /auth/logout` revokes the current session; `POST /auth/logout-all` revokes every session for the user.

If `request-otp` returns `requires2fa: true`, call `POST /auth/:role/verify-2fa` with `{ countryCode, phone, aadhaarNumber, totp }` instead of `verify-otp`. 2FA is for super-admin, branch-store, and agent only (not bidder). See [docs/AUTH_REQUIREMENTS.md](./docs/AUTH_REQUIREMENTS.md).

## Bidder / Agent signup (self-registration)

Public APIs under `/api/v1/auth/bidder/register` and `/api/v1/auth/agent/register` (same shapes).

Mock Aadhaar KYC returns **different demographics per role** (demo only):

| Role | Name | City |
|------|------|------|
| Agent | Rajesh Kumar | Bengaluru |
| Bidder | Priya Sharma | Hyderabad |
| Branch (seed / last4 `1111`) | Anil Reddy | Chennai |

```http
POST /api/v1/auth/agent/register/aadhaar/request-otp
{ "aadhaarNumber": "354136431636" }

POST /api/v1/auth/agent/register/complete
{ "sessionId": "<id>", "countryCode": "+91", "phone": "9876501111", "paymentId": "<paid>" }
```

## 2FA / screen lock / biometric

Authenticated under `/api/v1/auth/security` (GET status, POST configure) and `POST /auth/security/unlock`. TOTP is for super-admin, branch-store, and agent only. Client demo unlocks the lock screen with **TOTP only** when 2FA is enabled — no separate screen-lock PIN enable/disable in the FE.

## Profile update + nominee

```http
PATCH /api/v1/auth/profile
Authorization: Bearer <accessToken>
{ "phone2": "9876543210", "currentAddress": "…", "nomineeUserIds": ["<userId>"] }

GET /api/v1/auth/profile/nominee-search?q=9888888883
Authorization: Bearer <accessToken>
```

`q` is a 10-digit phone or 12-digit Aadhaar. Nominees must already exist; max 2. `GET /auth/me` returns `phone2` and resolved `nominees`.

After `npm run seed`, try nominee search with:

| Name | Phone | Aadhaar |
|------|-------|---------|
| Rahul Verma | `9777777771` | `444444444441` |
| Sneha Iyer | `9777777772` | `555555555552` |
| Vikram Patel | `9777777773` | `666666666663` |

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

## List agents / bidders / branch stores (Super Admin)

```http
GET /api/v1/super-admin/agents
GET /api/v1/super-admin/bidders
GET /api/v1/super-admin/branch-stores
Authorization: Bearer <super_admin_token>
```

Optional query: `?q=<name|phone>&status=active|inactive|blocked`.

Each row includes `id`, `name`, `phone`, `countryCode`, `role`, `permissions`, `status`, `aadhaarLast4`, `gender`, `dateOfBirth`, `createdAt`, `lastLoginAt`.

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
