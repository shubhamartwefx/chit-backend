# Authentication & Screen Lock Requirements

Corrected product rules for Saina Chit Funds (backend APIs).

## Role matrix

| Role | Default login | After 2FA enabled | Screen lock | Biometric |
|------|---------------|-------------------|-------------|-----------|
| Super Admin | Phone + Aadhaar → SMS OTP | Phone + Aadhaar → TOTP (no SMS) | PIN / TOTP / biometric unlock | Allowed |
| Branch Store | Phone + Aadhaar → SMS OTP | Phone + Aadhaar → TOTP | PIN / TOTP / biometric unlock | Allowed |
| Agent | Phone + Aadhaar → SMS OTP | Phone + Aadhaar → TOTP | PIN / TOTP / biometric unlock | Allowed |
| Bidder | Phone + Aadhaar → SMS OTP | **2FA not available** | PIN / biometric unlock | Allowed |

## Login identity

1. Always identify the user with **phone + Aadhaar** for the role portal.
2. Second factor:
   - If `totpEnabled` is false (or role is bidder): send **SMS OTP**, then `verify-otp`.
   - If `totpEnabled` is true (super_admin / branch_store / agent only): **do not** send SMS; client calls `verify-2fa` with authenticator code.

## Self-signup

- **Bidder:** `/api/v1/auth/bidder/register/*` (Aadhaar OTP + DigiLocker mock)
- **Agent:** `/api/v1/auth/agent/register/*` (same flow; creates `agent` with `AGENT_DEFAULT`)

## Unified security APIs

Authenticated. Role rules are returned on `GET` via `allowed` so FE does not hardcode roles.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/auth/security` | Status for `totp`, `screen_lock`, `biometric` + `allowed` + `inactivityMinutes` |
| `POST` | `/auth/security` | Configure: `{ method, enabled, pin?, currentPin?, totp?, webauthnResponse? }` |
| `POST` | `/auth/security/unlock` | After soft lock: `{ method: pin\|totp\|biometric, ... }` |

Login `POST /auth/:role/verify-2fa` is unchanged (used when TOTP is enabled for eligible roles).

### Configure body

```json
{
  "method": "totp" | "screen_lock" | "biometric",
  "enabled": true | false,
  "pin": "123456",
  "currentPin": "123456",
  "totp": "123456",
  "webauthnResponse": {}
}
```

| Call | Behavior |
|------|----------|
| `enabled: true`, no confirm fields | Start setup (QR / need pin / WebAuthn options) |
| `enabled: true` + confirm fields | Finish enable |
| `enabled: false` + proof | Disable (`pin` or `totp` for screen_lock; `totp` for 2FA) |

### PIN unlock flow

1. Enable: `POST /auth/security` `{ "method": "screen_lock", "enabled": true, "pin": "123456" }`
2. FE uses `inactivityMinutes` from `GET /auth/security`; on timeout show lock UI (JWT still valid)
3. Unlock: `POST /auth/security/unlock` `{ "method": "pin", "pin": "123456" }`

Disable screen lock clears `screenLockEnabled` only; `pinHash` is kept for faster re-enable.

### Role allow-lists

| Role | `totp` | `screen_lock` | `biometric` |
|------|--------|---------------|-------------|
| `super_admin` / `branch_store` / `agent` | allowed | allowed | allowed |
| `bidder` | **denied** | allowed | allowed |

Biometric does **not** replace login; optional device factor for unlock / step-up while authenticated.

## Corrections vs original brief

- Agent unlock is PIN **or** 2FA (not 2FA-only); biometric also available.
- Branch/Agent/SA do not use SMS OTP once 2FA is on.
- 2FA is never offered to bidders.
- Biometric is available for every role (not bidder-only), not a substitute for phone+Aadhaar login.
