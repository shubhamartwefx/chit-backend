# 2FA (TOTP) API Flow

Sequential guide for enabling, logging in with, and disabling authenticator-based 2FA.

**Eligible roles:** `super_admin`, `branch_store`, `agent`  
**Not available:** `bidder` (`totp.allowed: false` on `GET /auth/security`)

Base path: `/api/v1`

---

## A. Enable 2FA (while logged in)

Until 2FA is enabled, login still uses SMS OTP.

### 1. Login (SMS OTP)

```http
POST /auth/:role/request-otp
Content-Type: application/json

{
  "countryCode": "+91",
  "phone": "9999999999",
  "aadhaarNumber": "123456789012"
}
```

```http
POST /auth/:role/verify-otp
Content-Type: application/json

{
  "countryCode": "+91",
  "phone": "9999999999",
  "aadhaarNumber": "123456789012",
  "otp": "123456"
}
```

Save `accessToken` / `refreshToken`. Use Bearer for the steps below.

### 2. Check security status

```http
GET /auth/security
Authorization: Bearer <accessToken>
```

Look for:

```json
{ "method": "totp", "allowed": true, "enabled": false }
```

If `allowed` is `false`, do not show the 2FA toggle (bidder).

### 3. Start setup (secret + QR)

```http
POST /auth/security
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "method": "totp",
  "enabled": true
}
```

Response includes a pending secret / QR (`step: "confirm"`). User adds the account in an authenticator app (Google Authenticator, Authy, etc.).

### 4. Confirm enable

```http
POST /auth/security
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "method": "totp",
  "enabled": true,
  "totp": "123456"
}
```

`totp` is the 6-digit code from the authenticator. After success, `GET /auth/security` shows `totp.enabled: true`.

---

## B. Login after 2FA is enabled

SMS OTP is **not** sent. Do **not** call `verify-otp`.

### 1. Request login

```http
POST /auth/:role/request-otp
Content-Type: application/json

{
  "countryCode": "+91",
  "phone": "9999999999",
  "aadhaarNumber": "123456789012"
}
```

Response includes `requires2fa: true`.

### 2. Verify authenticator code

```http
POST /auth/:role/verify-2fa
Content-Type: application/json

{
  "countryCode": "+91",
  "phone": "9999999999",
  "aadhaarNumber": "123456789012",
  "totp": "123456"
}
```

Returns access + refresh tokens.

`:role` URL slugs: `super-admin`, `branch-store` (or `admin`), `agent`.

---

## C. Disable 2FA

```http
POST /auth/security
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "method": "totp",
  "enabled": false,
  "totp": "123456"
}
```

Next login returns to SMS OTP (`request-otp` → `verify-otp`).

---

## Related: unlock with TOTP

If screen lock is enabled and the user has TOTP on, after inactivity the FE can unlock with:

```http
POST /auth/security/unlock
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "method": "totp",
  "totp": "123456"
}
```

This does not replace login 2FA; it only clears the soft UI lock.

---

## Quick sequence summary

| Step | When | Method | Path |
|------|------|--------|------|
| 1 | Enable | GET | `/auth/security` |
| 2 | Enable | POST | `/auth/security` `{ method: totp, enabled: true }` |
| 3 | Enable | POST | `/auth/security` `{ method: totp, enabled: true, totp }` |
| 4 | Login (2FA on) | POST | `/auth/:role/request-otp` → `requires2fa` |
| 5 | Login (2FA on) | POST | `/auth/:role/verify-2fa` |
| — | Disable | POST | `/auth/security` `{ method: totp, enabled: false, totp }` |

See also [AUTH_REQUIREMENTS.md](./AUTH_REQUIREMENTS.md) for the full role matrix and unified security APIs.
