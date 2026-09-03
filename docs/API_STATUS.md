# API Status Codes

Central catalog: [`src/config/constants/status-codes.ts`](../src/config/constants/status-codes.ts)

## HTTP status responses

| Key | HTTP | Code | Default message |
|-----|------|------|-----------------|
| `OK` | 200 | `OK` | Request completed successfully |
| `CREATED` | 201 | `CREATED` | Resource created successfully |
| `BAD_REQUEST` | 400 | `BAD_REQUEST` | The request could not be processed |
| `UNAUTHORIZED` | 401 | `UNAUTHORIZED` | Authentication required |
| `ACCESS_DENIED` | 403 | `ACCESS_DENIED` | Access denied |
| `INSUFFICIENT_PERMISSIONS` | 403 | `INSUFFICIENT_PERMISSIONS` | Insufficient permissions for this action |
| `NOT_FOUND` | 404 | `NOT_FOUND` | Resource not found |
| `CONFLICT` | 409 | `CONFLICT` | Resource conflict |
| `RATE_LIMITED` | 429 | `RATE_LIMITED` | Too many requests. Try again later. |
| `INTERNAL_ERROR` | 500 | `INTERNAL_ERROR` | Internal server error |

## Response shape

**Success:**

```json
{
  "success": true,
  "message": "Request completed successfully",
  "data": {}
}
```

**Error:**

```json
{
  "success": false,
  "message": "Access denied",
  "code": "ACCESS_DENIED"
}
```

## Domain messages (`API_MESSAGES`)

| Key | Message |
|-----|---------|
| `HEALTH_OK` | Service is healthy |
| `LOGIN_SUCCESS` | Login successful |
| `LOGOUT_SUCCESS` | Logged out successfully. Discard the access token on the client. |
| `OTP_SENT` | OTP sent to registered phone number |
| `BRANCH_STORE_CREATED` | Branch store user created successfully |
| `AGENT_CREATED` | Agent created successfully |
| `BIDDER_CREATED` | Bidder created successfully |
| `STAFF_CREATED` | Super admin staff created successfully |
| `ROUTE_NOT_FOUND` | Route not found |

## Usage in code

```typescript
import { API_STATUS, API_MESSAGES } from '../common/status';
import { sendSuccessWithKey, sendErrorWithKey } from '../common/response';
import { badRequest, accessDenied } from '../common/errors';

sendSuccessWithKey(res, data, 'CREATED', API_MESSAGES.AGENT_CREATED);
sendErrorWithKey(res, 'NOT_FOUND');
throw badRequest('Custom validation message'); // uses catalog default if omitted
```
