# Authentication & Screen Lock Requirements

Corrected product rules for Saina Chit Funds (backend APIs).

## Role matrix

| Role | Default login | After 2FA enabled | Screen lock unlock | Biometric |
|------|---------------|-------------------|--------------------|-----------|
| Super Admin | Phone + Aadhaar → SMS OTP | Phone + Aadhaar → TOTP (no SMS) | APIs available (optional for FE) | No |
| Branch Store | Phone + Aadhaar → SMS OTP | Phone + Aadhaar → TOTP | PIN **or** TOTP | No |
| Agent | Phone + Aadhaar → SMS OTP | Phone + Aadhaar → TOTP | PIN **or** TOTP | No |
| Bidder | Phone + Aadhaar → SMS OTP | **2FA not available** | PIN (optional) / biometric unlock | WebAuthn after login |

## Login identity

1. Always identify the user with **phone + Aadhaar** for the role portal.
2. Second factor:
   - If `totpEnabled` is false (or role is bidder): send **SMS OTP**, then `verify-otp`.
   - If `totpEnabled` is true (super_admin / branch_store / agent only): **do not** send SMS; client calls `verify-2fa` with authenticator code.

## Self-signup

- **Bidder:** `/api/v1/auth/bidder/register/*` (Aadhaar OTP + DigiLocker mock)
- **Agent:** `/api/v1/auth/agent/register/*` (same flow; creates `agent` with `AGENT_DEFAULT`)

## 2FA (TOTP)

Eligible roles only: `super_admin`, `branch_store`, `agent`.

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /auth/2fa/status` | Bearer | enabled + allowedForRole |
| `POST /auth/2fa/setup` | Bearer | pending secret + QR |
| `POST /auth/2fa/confirm` | Bearer | `{ totp }` enable |
| `POST /auth/2fa/disable` | Bearer | `{ totp }` disable |

## Screen lock

Inactivity timer is FE-owned; backend returns `inactivityMinutes` from env.

| Endpoint | Purpose |
|----------|---------|
| `GET /auth/screen-lock/status` | enabled, hasPin, totpAvailable |
| `POST /auth/screen-lock/pin` | set/change PIN |
| `POST /auth/screen-lock/enable` | `{ enabled }` |
| `POST /auth/screen-lock/unlock` | `{ method: pin\|totp, ... }` |

## Biometric (bidder)

WebAuthn (`@simplewebauthn/server`): register options/verify, authenticate options/verify, disable, status.

## Corrections vs original brief

- Agent unlock is PIN **or** 2FA (not 2FA-only).
- Branch/Agent/SA do not use SMS OTP once 2FA is on.
- 2FA is never offered to bidders.
- Biometric is bidder-only device credentials, not a substitute for phone+Aadhaar login.
