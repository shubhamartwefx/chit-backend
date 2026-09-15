# Postman — Saina Chit Backend

Import these files into Postman to test the API locally.

## Files

| File | Purpose |
|------|---------|
| `Saina-Chit-Backend.postman_collection.json` | All API endpoints |
| `Saina-Chit-Backend.local.postman_environment.json` | Local dev variables |

## Import steps

1. Open Postman
2. **Import** → drag both JSON files (or use File → Import)
3. Select environment **Saina Local** (top-right dropdown)
4. Start the backend:
   ```bash
   npm run seed
   npm run dev
   ```
5. Run **Health → Health Check** to confirm the server is up

## Quick login flow

1. **Auth → Super Admin → Request OTP**
2. **Auth → Super Admin → Verify OTP (saves token)**
   - Tokens are auto-saved to `accessToken` and `refreshToken`
3. Call any **Super Admin** endpoint — Bearer auth is inherited from the collection
4. When access expires, run **Auth → Session → Refresh Token**

Repeat with **Branch Store**, **Agent**, or **Bidder** folders to test role-scoped modules.

## Provisioning rules

- **Branch store:** Super Admin only (`POST /super-admin/branch-stores`). No branch self-signup.
- **Agent / Bidder:** self-signup folders **or** SA create; peer operators create bidders via **Branch Store → Create Branch Bidder** / **Agent → Create Agent Bidder**.

## Chits (peer operators)

Folder **Chits** — `/api/v1/chits`. Read: all four roles; write: super_admin / branch_store / agent only.

1. Login as **Agent** → **Create Chit (as Agent)** (no `agentId` in body) — saves `chitId`
2. Or login as **Branch Store** → **Create Chit (as Branch Store)** (no `agentId`) — branch-owned
3. Or Super Admin → create for agent (`agentId`) **or** branch (`branchStoreId`)
4. **Add / Update / Remove Chit Member** for incremental membership
5. Login as **Bidder** and use **Bidder — List/Get/Summary** to verify assigned-chit scoping

## Operator bidders

- **Branch Store → List/Create Branch Bidders** (`bidders:read` / `bidders:write`)
- **Agent → List/Create Agent Bidders** (same permissions)
- **Block / Unblock** bidder the operator created (`POST .../bidders/:id/block|unblock`)

List includes bidders the operator created and members of the operator’s chits. Filter with `status=blocked`.

## Installments / auctions / join

Under **Chits**: record/list installments; create/list/close auction rounds; place bids (bidder token).  
**Bidder → Join Chit** for self-join.

## Reports

**Reports → Overview** (`reports:read`) — scoped metrics for SA / branch / agent.

## Block / Unblock

**Super Admin → User Actions**. Set `userId` from a list endpoint. Block requires a reason (min 5 chars); revokes all sessions. Blocked users get `403 ACCOUNT_BLOCKED` with reason on login and on the next API call with an existing token.

## Agent signup

Same as bidder under **Agent Signup** (`/auth/agent/register`).

## Security

Folder **Security** — `GET/POST /auth/security` and `POST /auth/security/unlock` (Bearer). Login `verify-2fa` remains under Auth role folders.

Use folder **Bidder Signup**. Prefer a fresh `signupAadhaar` / `signupPhone` (not seed credentials).

**Manual path:** Request Aadhaar OTP → Verify OTP → Complete Registration  
**DigiLocker path:** Start DigiLocker → Callback (JSON) → Complete Registration  

Complete returns access + refresh tokens (auto-login).

## Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `baseUrl` | `http://localhost:4000` | Server root |
| `apiBase` | `http://localhost:4000/api/v1` | API prefix (`/api/{{apiVersion}}`) |
| `apiVersion` | `v1` | Must match backend `API_VERSION` env |
| `accessToken` | (auto-set) | JWT from verify-otp, signup complete, or refresh |
| `refreshToken` | (auto-set) | Opaque refresh token (rotated on refresh) |
| `mockOtp` | `123456` | Dev OTP from `.env` |
| `signupAadhaar` | `354136431636` | Fresh Aadhaar for signup tests |
| `signupPhone` | `9876543210` | Fresh phone for signup complete |
| `signupSessionId` | (auto-set) | Signup session from request-otp / digilocker start |
| `chitId` | (auto-set) | Chit id from Create Chit |
| `agentId` | (manual) | Agent user id for SA create-as-agent |
| `branchStoreId` | (auto from Create Branch Store) | Branch user id for SA create-as-branch |
| `bidderId` | (auto from create bidder) | Bidder user id for members APIs |
| `auctionRoundId` | (auto from Create Auction Round) | Auction round id |
| `userId` | (manual) | Target user id for block/unblock |

Change `baseUrl` or `apiVersion` in the environment if your server runs on a different host, port, or API version.

**Note:** In development, if port 4000 is busy the server may auto-bind to 4001+ — update `baseUrl` accordingly. Check the server console on startup.

## Demo users (after `npm run seed`)

See collection description or [README](../README.md).
