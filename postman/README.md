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

## Chits

Folder **Chits** — `/api/v1/chits`. Read: all four roles; write: super_admin / branch_store / agent only.

1. Login as **Agent** (or Super Admin / Branch Store)
2. **Create Chit (as Agent)** — saves `chitId` automatically
3. Use List / Summary / Get / Update / Delete with that `chitId`
4. For Super Admin / Branch create: set `agentId` from List Agents; optional `bidderId` from List Bidders
5. Login as **Bidder** and use **Bidder — List/Get/Summary** to verify assigned-chit scoping

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
| `agentId` | (manual) | Agent user id for branch/super-admin create |
| `bidderId` | (manual) | Bidder user id for optional members[] |
| `userId` | (manual) | Target user id for block/unblock |

Change `baseUrl` or `apiVersion` in the environment if your server runs on a different host, port, or API version.

**Note:** In development, if port 4000 is busy the server may auto-bind to 4001+ — update `baseUrl` accordingly. Check the server console on startup.

## Demo users (after `npm run seed`)

See collection description or [README](../README.md).
