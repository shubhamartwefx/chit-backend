# UIDAI Integration — Meeting Brief

**Purpose:** Explain how this backend integrates UIDAI Aadhaar APIs, how payloads/responses are handled, and what gaps need confirmation from UIDAI support.

**Product:** Saina Chit Funds backend (`chit-backend`)  
**Scope:** Agent & Bidder self-signup Aadhaar OTP + eKYC  
**Date prepared:** 2026-10-26

---

## 1. Executive summary (open the call with this)

We have implemented UIDAI **OTP API 2.5** and **eKYC API 2.5** for agent/bidder signup:

1. Request OTP → signed OTP XML → UIDAI  
2. Verify OTP → encrypt PID (OTP factor) → signed Auth inside a `<Kyc>` envelope → UIDAI eKYC  
3. Map PoI/PoA from the KYC response into a sealed profile stored on the signup session  

**Auth API is configured but not used for signup** (OTP + eKYC with the same `txn` is the path).

**Current runtime:** `AADHAAR_KYC_PROVIDER=mock` — the app is **not** calling live UIDAI until we switch to `uidai` after certs and URL/crypto details are confirmed.

---

## 2. What is live vs mock today

| Area | Status |
|------|--------|
| Signup Aadhaar KYC provider switch | `mock` (default) or `uidai` via `AADHAAR_KYC_PROVIDER` |
| Active `.env` mode | **`mock`** |
| UIDAI OTP client | Implemented |
| UIDAI eKYC client | Implemented |
| UIDAI Auth client | **Stub only** (URL reserved for later) |
| Login SMS OTP | Separate mock path — **not** UIDAI |
| DigiLocker signup | Mock OAuth — **not** UIDAI |

**When `AADHAAR_KYC_PROVIDER=uidai`:**

- `POST …/aadhaar/request-otp` → UIDAI OTP  
- `POST …/aadhaar/resend-otp` → new UIDAI OTP (fresh `txn`)  
- `POST …/aadhaar/verify-otp` → UIDAI eKYC with same `txn` + user OTP  

Used by:

- Agent signup: `/api/v1/auth/agent/register/…`  
- Bidder signup: `/api/v1/auth/bidder/register/…`  

---

## 3. End-to-end flow

```
Frontend
  │
  ├─ POST /aadhaar/request-otp { aadhaarNumber }
  │     → UidaiAadhaarKycProvider.requestOtp()
  │     → UIDAI OTP server (signed XML)
  │     → Store aadhaarTxn on signup session
  │     → Return sessionId to client
  │
  └─ POST /aadhaar/verify-otp { sessionId, otp }
        → Decrypt Aadhaar from session
        → UidaiAadhaarKycProvider.verifyOtpAndFetchKyc()
        → UIDAI eKYC server (encrypted PID + signed Auth in <Kyc>)
        → Map UidData PoI/PoA → sealed verifiedProfile
        → Clear txn / OTP session fields
```

**Same `txn` must be used** for OTP request and eKYC verify (UIDAI session binding).

**Security practices in our code:**

- License keys, PEMs, OTP plaintext, full Aadhaar, and raw UIDAI XML are **never** returned to the client  
- OTP plaintext is **never** stored; mock mode alone stores an OTP hash  
- Sessions store: `aadhaarTxn`, encrypted Aadhaar, HMAC fingerprint, last-4  
- Logs for UIDAI errors include only: `phase`, `uidaiErr`, `txn`

---

## 4. Configuration & secrets

| Env / asset | Role | Notes |
|-------------|------|--------|
| `AADHAAR_KYC_PROVIDER` | `mock` \| `uidai` | Must be `uidai` for live calls |
| `UIDAI_OTP_BASE_URL` | OTP endpoint | Default sandbox: `…/uidotpserver/2.5` |
| `UIDAI_AUTH_BASE_URL` | Auth endpoint | **Not used** for signup |
| `UIDAI_EKYC_BASE_URL` | eKYC endpoint | Default sandbox: `…/uidkycserver/kyc/2.5` |
| `UIDAI_AUA_CODE` | `ac` in XML | Default `public` |
| `UIDAI_SUB_AUA_CODE` | `sa` in XML | Default `public` |
| `UIDAI_ASA_CODE` | Loaded in config | **Not used** in URL/XML today |
| `UIDAI_LICENSE_KEY` | `lk` in OTP/Auth XML | AUA license |
| `UIDAI_ASA_LICENSE_KEY` | Present in `.env` | **Not wired in code** |
| `UIDAI_CI` | Skey certificate identifier | Default `20300811` |
| `UIDAI_PUBLIC_CERT_PATH` | Encrypt PID session key | Encryption public cert |
| `UIDAI_AUA_SIGNING_CERT_PATH` | XMLDSig public cert | Required for `uidai` mode |
| `UIDAI_AUA_SIGNING_KEY_PATH` | XMLDSig private key | Required for `uidai` mode |

**Certificate status (as of brief date):**

| File | Status |
|------|--------|
| Encryption cert (`Auth_Private_Key_11082030.cer`) | Present under `certs/` |
| AUA signing cert (`aua-public-signing.cer`) | **Missing** |
| AUA signing key (`aua-public-signing.key`) | **Missing** |

Without signing material, `uidai` mode cannot successfully sign OTP/eKYC requests.

---

## 5. Payload management — what we send to UIDAI

Transport for both APIs:

- Method: `POST`  
- Header: `Content-Type: application/xml`  
- Body: signed XML string  

Signing: XMLDSig RSA-SHA1, enveloped signature, C14N 20010315 (`uidai-sign.ts`).

---

### 5.1 OTP request payload

Built in `uidai-otp.client.ts`, then signed.

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Otp uid="{aadhaar}"
     ac="{UIDAI_AUA_CODE}"
     sa="{UIDAI_SUB_AUA_CODE}"
     ver="2.5"
     txn="{generated txn}"
     ts="{IST yyyy-MM-ddTHH:mm:ss}"
     lk="{UIDAI_LICENSE_KEY}"
     type="A">
  <Opts ch="00"/>
  <!-- ds:Signature appended -->
</Otp>
```

| Attribute / element | How we set it |
|---------------------|---------------|
| `uid` | Full 12-digit Aadhaar from client |
| `ac` / `sa` | Env AUA / Sub-AUA codes |
| `ver` | `2.5` |
| `txn` | Generated `OTP-{timestamp}-{random}` (max 50 chars); stored as `aadhaarTxn` |
| `ts` | Asia/Kolkata wall time **without** timezone suffix |
| `lk` | AUA license key |
| `type` | `A` (Aadhaar number) |
| `Opts ch` | `00` (both SMS/email channels per UIDAI convention) |

Resend always generates a **new** `txn` (previous OTP/txn invalidated).

---

### 5.2 eKYC / verify payload

Built in `uidai-ekyc.client.ts` + `uidai-crypto.ts`.

#### Step A — PID (OTP factor only)

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Pid ts="{IST with ms and +05:30}" ver="2.0">
  <Pv otp="{user-entered OTP}"/>
</Pid>
```

#### Step B — Encrypt PID

1. Generate random 32-byte AES session key (in memory only)  
2. Encrypt PID XML with **AES-256-ECB** → Base64 → `<Data type="X">`  
3. SHA-256(PID) encrypted with same AES key → Base64 → `<Hmac>`  
4. Encrypt session key with UIDAI public cert (**RSA PKCS#1**) → Base64 → `<Skey ci="…">`  
5. Zero session key buffer after use  

#### Step C — Auth XML (then signed)

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Auth uid="{aadhaar}"
      rc="Y"
      tid="public"
      ac="{AUA}"
      sa="{SubAUA}"
      ver="2.5"
      txn="{same txn from OTP step}"
      lk="{AUA license}">
  <Uses pi="n" pa="n" pfa="n" bio="n" bt="" pin="n" otp="y"/>
  <Meta udc="CHIT01" fdc="NC" pip="NA" lot="P" lov="560001"/>
  <Skey ci="{UIDAI_CI}">{encryptedSessionKeyB64}</Skey>
  <Data type="X">{encryptedPidB64}</Data>
  <Hmac>{encryptedHmacB64}</Hmac>
  <!-- ds:Signature appended -->
</Auth>
```

#### Step D — Kyc transport envelope (posted to eKYC URL)

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Kyc ver="2.5" ts="{pid ts}" ra="F" rc="Y" lr="N" de="N" pfr="N">
  <!-- signed Auth XML without XML declaration -->
</Kyc>
```

| Hardcoded / assumed values | Current value | Needs UIDAI confirmation |
|----------------------------|---------------|--------------------------|
| `Meta.udc` | `CHIT01` | Registered device / unique device code? |
| `Meta.fdc` | `NC` | Finger device code rules |
| `Meta.pip` | `NA` | Public IP handling |
| `Meta.lot` / `lov` | `P` / `560001` | Location type + PIN |
| `ra` | `F` | Resident authentication factor |
| PID encryption | AES-256-ECB + RSA-PKCS1 | Algorithm match for sandbox/prod |
| Envelope | Auth inside `<Kyc>` | Correct for our ASA |

---

## 6. Responses from UIDAI — what we expect and how we map them

### 6.1 OTP response (`OtpRes`)

We parse XML and read attributes on the root:

| Attribute | Success | Failure |
|-----------|---------|---------|
| `ret` | `y` or `yes` | Other → error path |
| `err` | Empty / absent | Mapped to API error codes |
| `txn` | Echoed; we keep this for eKYC | — |
| `code` | Captured as `otpResponseCode` (not used further) | — |

**App returns to frontend:** `sessionId`, optional `maskedPhone`, expiry minutes.  
**Gap:** UIDAI OTP response does **not** reliably include masked mobile; in UIDAI mode we typically return txn only (no masked phone).

---

### 6.2 eKYC response (`KycRes` / nested Auth/KYC)

Handling in `uidai-ekyc.client.ts` → `uidai-kyc-map.ts`:

1. Parse response XML  
2. Find root `KycRes` / `Resp` / `AuthRes`  
3. Require `ret = y`  
4. Prefer Base64 `Rar` content if present; else use body if it already contains `UidData` / `<Poi`  
5. Map demographics into sealed profile  

**Fields we consume from UIDAI:**

| UIDAI source | App field |
|--------------|-----------|
| `Poi@name` | `fullName` |
| `Poi@gender` | `gender` (`M`/`F` → Male/Female) |
| `Poi@dob` | `dateOfBirth` (`YYYY-MM-DD` → `DD/MM/YYYY`) |
| `Poa` (house, street, loc, lm, vtc, subdist, dist, state, pc, country) | `aadhaarAddress` |
| — | `aadhaarLast4` (from input Aadhaar, not KYC XML) |

**Not consumed today:** photo (`Pht`), phone/email from KYC, encrypted KYC payload decryption beyond simple Base64 `Rar` decode.

**After success:** profile sealed on signup session; `aadhaarTxn` cleared; client sees read-only KYC fields on verify response / session.

---

### 6.3 UIDAI `err` → our API codes

| UIDAI `err` | Our API code | Meaning (user-facing) |
|-------------|--------------|------------------------|
| 998 | `AADHAAR_INVALID` | Invalid Aadhaar |
| 995–997 | `AADHAAR_NOT_ACTIVE` | Aadhaar cannot be used |
| 400 | `AADHAAR_OTP_INVALID` | Invalid OTP |
| 402 | `AADHAAR_TXN_MISMATCH` | OTP session mismatch |
| 561–562 | `AADHAAR_TS_INVALID` | Timestamp invalid |
| 563 | `AADHAAR_DUPLICATE_REQUEST` | Duplicate request |
| 565–566 | `AADHAAR_LICENSE_ERROR` | License configuration |
| 500–503, 564 | `AADHAAR_CRYPTO_ERROR` | Encryption/crypto |
| 542–543, 940–941 | `AADHAAR_CHANNEL_UNAUTHORIZED` | Channel not authorized |
| 569–570 | `AADHAAR_SIGNATURE_FAILED` | Signature failure |
| 579 | `AADHAAR_OTP_NOT_LICENSED` | OTP not allowed for license |
| 930–939, 950, 999, unknown | `AADHAAR_UPSTREAM_ERROR` | Generic upstream failure |

HTTP mapping for these codes is documented in `docs/API_STATUS.md`.

---

## 7. Gaps & risks (agenda for UIDAI support)

### A. Blocking — certificates & credentials

1. Provide / confirm **AUA signing certificate + private key** for sandbox (files currently missing).  
2. Confirm encryption public cert matches `UIDAI_CI` (`20300811`).  
3. Confirm correct **AUA / Sub-AUA / ASA** codes (we currently use `public`).  
4. Clarify whether **ASA license** must be sent (URL path, header, or XML) — we have a value in env but **code does not use it**.

### B. High risk — endpoint URL template

We POST to the **configured base URL only**. Many UIDAI deployments require path segments such as:

`/{ver}/{ac}/{uid[0]}/{uid[1]}/`  
and/or ASA-related segments.

**Ask:** Exact OTP and eKYC URL templates for our registered AUA/ASA (sandbox and production).

### C. High risk — eKYC response decryption

- Session key is discarded after request encryption.  
- Helper `tryDecryptAesEcbBase64` exists but is **not used** in the eKYC flow.  
- If sandbox/prod returns AES-encrypted KYC (not plaintext / simple Base64 `Rar`), demographic mapping will fail.

**Ask:** Is KYC response plaintext XML in sandbox, or encrypted? If encrypted, specify algorithm and key material.

### D. Medium — request envelope & Meta

Confirm:

- Wrapping signed `<Auth>` inside `<Kyc ver="2.5" ra="F" rc="Y" lr="N" de="N" pfr="N">`  
- Hardcoded Meta: `udc=CHIT01`, `fdc=NC`, `pip=NA`, `lot=P`, `lov=560001`  
- PID crypto: AES-256-ECB + RSA-PKCS1 for Skey  
- XMLDSig: RSA-SHA1 + enveloped + C14N  

### E. Product / scope gaps (FYI, may not need UIDAI)

| Gap | Impact |
|-----|--------|
| Still on `mock` provider | No live UIDAI traffic until switch + certs |
| Auth API unused | Only OTP + eKYC for signup |
| No masked phone from OTP | UX messaging only |
| No photo from eKYC | Demographics only |
| `UIDAI_ASA_CODE` unused | Possible misconfiguration |
| Login OTP ≠ UIDAI | Separate product path |

---

## 8. Questions checklist for the meeting

Copy/paste for the call:

1. Exact **sandbox OTP URL** template for our AUA/ASA.  
2. Exact **sandbox eKYC URL** template for our AUA/ASA.  
3. Do we need **ASA license** in URL/header/body, or only AUA `lk` in XML?  
4. Process to obtain **AUA XML signing certificate + private key** for sandbox.  
5. Confirm **PID encryption**: AES-256-ECB + RSA-PKCS1 + `ci` value.  
6. Confirm **eKYC request shape**: signed Auth inside `<Kyc>` with our `ra`/`rc`/`lr`/`de`/`pfr`.  
7. Is eKYC **response encrypted**? If yes, decryption steps and key.  
8. Required **`Meta`** values (`udc`, `lot`, `lov`, `fdc`, `pip`).  
9. Is **OTP + eKYC with same `txn`** the approved demographic KYC flow for our license?  
10. Please share sample successful **`OtpRes`** and **`KycRes`** XML for sandbox.  
11. Production cutover differences (hosts, licenses, certs, CI).  
12. Any channel / IP whitelist requirements for our server.

---

## 9. Code map (for engineers)

| Concern | File |
|---------|------|
| Provider switch mock/uidai | `src/modules/kyc-providers/aadhaar-kyc.provider.ts` |
| UIDAI provider facade | `src/modules/kyc-providers/uidai/uidai-aadhaar-kyc.provider.ts` |
| OTP client + XML | `src/modules/kyc-providers/uidai/uidai-otp.client.ts` |
| eKYC client + envelope | `src/modules/kyc-providers/uidai/uidai-ekyc.client.ts` |
| Auth stub | `src/modules/kyc-providers/uidai/uidai-auth.client.ts` |
| PID encryption | `src/modules/kyc-providers/uidai/uidai-crypto.ts` |
| XML signing | `src/modules/kyc-providers/uidai/uidai-sign.ts` |
| Timestamps / txn helpers | `src/modules/kyc-providers/uidai/uidai-xml.ts` |
| Err → API code map | `src/modules/kyc-providers/uidai/uidai-error-map.ts` |
| KYC XML → profile | `src/modules/kyc-providers/uidai/uidai-kyc-map.ts` |
| Config / cert load | `src/modules/kyc-providers/uidai/uidai-config.ts` |
| Env schema | `src/config/env.ts` |
| Agent signup session flow | `src/modules/agent-signup/agent-signup.service.ts` |
| Bidder signup session flow | `src/modules/bidder-signup/bidder-signup.service.ts` |
| API status catalog | `docs/API_STATUS.md` |
| Architecture note | `docs/ARCHITECTURE.md` (Aadhaar OTP + eKYC section) |

---

## 10. Recommended next steps after the call

1. Obtain signing cert/key and place under `certs/` (do not commit secrets).  
2. Align OTP/eKYC URLs with UIDAI-confirmed templates.  
3. Wire ASA license/code if UIDAI requires them.  
4. Implement response decryption if UIDAI confirms encrypted KYC.  
5. Update Meta/`ci`/AUA codes to registered values.  
6. Switch `AADHAAR_KYC_PROVIDER=uidai` in a controlled sandbox environment.  
7. Run OTP → eKYC happy path; capture (redacted) `ret`/`err` outcomes.  
8. Document prod URL/license/cert cutover checklist.

---

*Internal use — do not paste license keys, private keys, or full Aadhaar numbers into tickets or chat with UIDAI beyond what their process requires.*
