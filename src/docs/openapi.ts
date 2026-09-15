import { API_BASE_PATH, API_VERSION } from '../config/constants/api-version';
import { buildExtraOpenApiPaths } from './openapi-extra-paths';

const objectId = {
  type: 'string',
  pattern: '^[a-fA-F0-9]{24}$',
  example: '507f1f77bcf86cd799439011',
} as const;

const successEnvelope = (dataSchema: Record<string, unknown>) => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    message: { type: 'string' },
    data: dataSchema,
  },
});

const errorEnvelope = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    message: { type: 'string' },
    code: { type: 'string', example: 'BAD_REQUEST' },
    details: { type: 'object', additionalProperties: true },
  },
};

const bearer = [{ BearerAuth: [] as never[] }];

/**
 * OpenAPI 3 document for Swagger UI "Try it out".
 * Paths are relative to the server url (includes /api/v1).
 */
export function buildOpenApiDocument(port = 4000) {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Saina Chit Funds API',
      version: API_VERSION,
      description: `
Interactive API docs for **chit-backend**.

## Login (existing users)
1. **Auth → Request OTP** → **Verify OTP**
2. Copy \`data.accessToken\` → **Authorize** → try protected routes

## Agent / Bidder self-signup
1. **Agent Signup** or **Bidder Signup** → Aadhaar request-otp (fresh Aadhaar)
2. Verify OTP (\`123456\`) → save \`sessionId\`
3. **Signup Payment** → create-order → confirm → save \`paymentId\`
4. **…/complete** with sessionId + phone + paymentId → tokens returned

There is **no** branch-store self-signup (SA provisions branches).

## Demo credentials (after \`npm run seed\`)
| Role | Auth slug | Phone | Aadhaar | OTP |
|------|-----------|-------|---------|-----|
| Super Admin | \`super-admin\` | 9999999999 | 123456789012 | 123456 |
| Branch Store | \`branch-store\` | 9888888881 | 111111111111 | 123456 |
| Agent | \`agent\` | 9888888882 | 222222222222 | 123456 |
| Bidder | \`bidder\` | 9888888883 | 333333333333 | 123456 |

Health: \`GET http://localhost:${port}/health\` (outside API base)  
Base path: \`${API_BASE_PATH}\`
      `.trim(),
    },
    servers: [
      {
        url: `http://localhost:${port}${API_BASE_PATH}`,
        description: 'Local API (default port; check server console if fallback used)',
      },
    ],
    tags: [
      { name: 'Auth' },
      { name: 'Agent Signup', description: 'Public self-registration for agents' },
      { name: 'Bidder Signup', description: 'Public self-registration for bidders' },
      { name: 'Signup Payment', description: 'Demo fee before register/complete' },
      { name: 'Super Admin' },
      { name: 'Branch Store' },
      { name: 'Agent' },
      { name: 'Bidder' },
      { name: 'Chits' },
      { name: 'Installments' },
      { name: 'Auctions' },
      { name: 'Reports' },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Paste accessToken from verify-otp response',
        },
      },
      schemas: {
        Error: errorEnvelope,
        IdentityBody: {
          type: 'object',
          required: ['phone', 'aadhaarNumber'],
          properties: {
            countryCode: { type: 'string', default: '+91', example: '+91' },
            phone: { type: 'string', example: '9999999999' },
            aadhaarNumber: { type: 'string', example: '123456789012' },
          },
        },
        CreateUserBody: {
          allOf: [
            { $ref: '#/components/schemas/IdentityBody' },
            {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string', example: 'Demo User' },
              },
            },
          ],
        },
        CreateBranchStoreBody: {
          allOf: [
            { $ref: '#/components/schemas/CreateUserBody' },
            {
              type: 'object',
              required: ['permissions'],
              properties: {
                permissions: {
                  type: 'array',
                  items: { type: 'string' },
                  example: [
                    'agents:read',
                    'bidders:read',
                    'bidders:write',
                    'chits:read',
                    'chits:write',
                    'reports:read',
                  ],
                },
              },
            },
          ],
        },
        StatusActionBody: {
          type: 'object',
          required: ['reason'],
          properties: {
            reason: {
              type: 'string',
              minLength: 5,
              example: 'Policy violation — temporary block',
            },
          },
        },
        CreateChitBody: {
          type: 'object',
          required: [
            'type',
            'amountInLakhs',
            'govtBettingAmount',
            'monthlyInstallment',
            'maxBidders',
            'totalMonths',
            'govtBettingUnits',
            'startDate',
          ],
          properties: {
            type: {
              type: 'string',
              enum: ['agent_chit', 'auction_chit'],
              example: 'agent_chit',
            },
            amountInLakhs: { type: 'number', example: 5 },
            govtBettingAmount: { type: 'number', example: 10000 },
            monthlyInstallment: { type: 'number', example: 5000 },
            maxBidders: { type: 'integer', example: 5 },
            totalMonths: { type: 'integer', example: 20 },
            govtBettingUnits: { type: 'integer', example: 2 },
            startDate: {
              type: 'string',
              format: 'date',
              example: '2026-10-01',
            },
            agentId: {
              ...objectId,
              description: 'Super Admin only — XOR with branchStoreId',
            },
            branchStoreId: {
              ...objectId,
              description: 'Super Admin only — XOR with agentId',
            },
            members: {
              type: 'array',
              items: {
                type: 'object',
                required: ['bidderId'],
                properties: {
                  bidderId: objectId,
                  numberOfTickets: { type: 'integer', default: 1 },
                },
              },
            },
            completedMonths: { type: 'integer', example: 0 },
            status: {
              type: 'string',
              enum: ['active', 'completed', 'cancelled'],
            },
          },
        },
        AddMemberBody: {
          type: 'object',
          required: ['bidderId'],
          properties: {
            bidderId: objectId,
            numberOfTickets: { type: 'integer', default: 1, example: 1 },
          },
        },
        InstallmentBody: {
          type: 'object',
          required: ['bidderId', 'monthNumber'],
          properties: {
            bidderId: objectId,
            monthNumber: { type: 'integer', example: 1 },
            amount: { type: 'number', example: 5000 },
            status: {
              type: 'string',
              enum: ['pending', 'paid', 'overdue', 'waived'],
              default: 'paid',
            },
            paidAt: { type: 'string', format: 'date-time' },
            note: { type: 'string' },
          },
        },
        AuctionRoundBody: {
          type: 'object',
          required: ['roundNumber', 'monthNumber', 'opensAt', 'closesAt'],
          properties: {
            roundNumber: { type: 'integer', example: 1 },
            monthNumber: { type: 'integer', example: 1 },
            opensAt: {
              type: 'string',
              format: 'date-time',
              example: '2026-10-01T00:00:00.000Z',
            },
            closesAt: {
              type: 'string',
              format: 'date-time',
              example: '2026-10-07T23:59:59.000Z',
            },
          },
        },
        BidBody: {
          type: 'object',
          required: ['amount'],
          properties: {
            amount: { type: 'number', example: 4500 },
          },
        },
      },
      responses: {
        BadRequest: {
          description: 'Validation / business rule error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        Unauthorized: {
          description: 'Missing or invalid JWT',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        Forbidden: {
          description: 'Role / permission / account blocked',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
      },
    },
    paths: {
      // --- Health (absolute from host root; override via separate path) ---
      // Mounted separately at /health outside API_BASE_PATH — documented via custom extension below

      '/auth/{role}/request-otp': {
        post: {
          tags: ['Auth'],
          summary: 'Request OTP for role login',
          parameters: [
            {
              name: 'role',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                enum: [
                  'super-admin',
                  'branch-store',
                  'admin',
                  'agent',
                  'bidder',
                ],
              },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/IdentityBody' },
              },
            },
          },
          responses: {
            '200': {
              description: 'OTP sent (mock OTP in dev response / console)',
              content: {
                'application/json': {
                  schema: successEnvelope({ type: 'object' }),
                },
              },
            },
            '403': { $ref: '#/components/responses/Forbidden' },
          },
        },
      },
      '/auth/{role}/verify-otp': {
        post: {
          tags: ['Auth'],
          summary: 'Verify OTP — returns accessToken + refreshToken',
          parameters: [
            {
              name: 'role',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                enum: [
                  'super-admin',
                  'branch-store',
                  'admin',
                  'agent',
                  'bidder',
                ],
              },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/IdentityBody' },
                    {
                      type: 'object',
                      required: ['otp'],
                      properties: {
                        otp: { type: 'string', example: '123456' },
                      },
                    },
                  ],
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Login success — use data.accessToken in Authorize',
              content: {
                'application/json': {
                  schema: successEnvelope({
                    type: 'object',
                    properties: {
                      accessToken: { type: 'string' },
                      refreshToken: { type: 'string' },
                      user: { type: 'object' },
                      redirectTo: { type: 'string' },
                    },
                  }),
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
          },
        },
      },
      '/auth/{role}/verify-2fa': {
        post: {
          tags: ['Auth'],
          summary: 'Verify TOTP (2FA-enabled accounts)',
          parameters: [
            {
              name: 'role',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                enum: ['super-admin', 'branch-store', 'admin', 'agent'],
              },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/IdentityBody' },
                    {
                      type: 'object',
                      required: ['totp'],
                      properties: {
                        totp: { type: 'string', example: '123456' },
                      },
                    },
                  ],
                },
              },
            },
          },
          responses: {
            '200': { description: 'Login success' },
            '403': { $ref: '#/components/responses/Forbidden' },
          },
        },
      },
      '/auth/refresh': {
        post: {
          tags: ['Auth'],
          summary: 'Refresh access token',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['refreshToken'],
                  properties: {
                    refreshToken: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'New token pair' },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },
      '/auth/me': {
        get: {
          tags: ['Auth'],
          summary: 'Current user profile',
          security: bearer,
          responses: {
            '200': { description: 'Profile' },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },
      '/auth/logout': {
        post: {
          tags: ['Auth'],
          summary: 'Logout current session',
          security: bearer,
          responses: { '200': { description: 'Logged out' } },
        },
      },
      '/auth/logout-all': {
        post: {
          tags: ['Auth'],
          summary: 'Revoke all sessions',
          security: bearer,
          responses: { '200': { description: 'All sessions revoked' } },
        },
      },

      // Super Admin
      '/super-admin/branch-stores': {
        get: {
          tags: ['Super Admin'],
          summary: 'List branch stores',
          security: bearer,
          parameters: [
            {
              name: 'status',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['active', 'inactive', 'blocked'],
              },
            },
            { name: 'q', in: 'query', schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'List' } },
        },
        post: {
          tags: ['Super Admin'],
          summary: 'Create branch store (SA only provisioning)',
          security: bearer,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateBranchStoreBody' },
              },
            },
          },
          responses: {
            '201': { description: 'Created' },
            '409': { description: 'Conflict' },
          },
        },
      },
      '/super-admin/agents': {
        get: {
          tags: ['Super Admin'],
          summary: 'List agents',
          security: bearer,
          parameters: [
            {
              name: 'status',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['active', 'inactive', 'blocked'],
              },
            },
            { name: 'q', in: 'query', schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'List' } },
        },
        post: {
          tags: ['Super Admin'],
          summary: 'Create agent',
          security: bearer,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateUserBody' },
              },
            },
          },
          responses: { '201': { description: 'Created' } },
        },
      },
      '/super-admin/bidders': {
        get: {
          tags: ['Super Admin'],
          summary: 'List bidders',
          security: bearer,
          parameters: [
            {
              name: 'status',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['active', 'inactive', 'blocked'],
              },
            },
            { name: 'q', in: 'query', schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'List' } },
        },
        post: {
          tags: ['Super Admin'],
          summary: 'Create bidder',
          security: bearer,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateUserBody' },
              },
            },
          },
          responses: { '201': { description: 'Created' } },
        },
      },
      '/super-admin/users/{userId}/block': {
        post: {
          tags: ['Super Admin'],
          summary: 'Block branch / agent / bidder',
          security: bearer,
          parameters: [
            {
              name: 'userId',
              in: 'path',
              required: true,
              schema: objectId,
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StatusActionBody' },
              },
            },
          },
          responses: { '200': { description: 'Blocked' } },
        },
      },
      '/super-admin/users/{userId}/unblock': {
        post: {
          tags: ['Super Admin'],
          summary: 'Unblock user',
          security: bearer,
          parameters: [
            {
              name: 'userId',
              in: 'path',
              required: true,
              schema: objectId,
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StatusActionBody' },
              },
            },
          },
          responses: { '200': { description: 'Unblocked' } },
        },
      },

      // Branch Store
      '/branch-store/health': {
        get: {
          tags: ['Branch Store'],
          summary: 'Module health',
          security: bearer,
          responses: { '200': { description: 'OK' } },
        },
      },
      '/branch-store/agents': {
        get: {
          tags: ['Branch Store'],
          summary: 'List agents created by this branch',
          security: bearer,
          parameters: [
            {
              name: 'status',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['active', 'inactive', 'blocked'],
              },
            },
            { name: 'q', in: 'query', schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'List' } },
        },
      },
      '/branch-store/bidders': {
        get: {
          tags: ['Branch Store'],
          summary: 'List operator bidders',
          security: bearer,
          parameters: [
            {
              name: 'status',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['active', 'inactive', 'blocked'],
              },
            },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', default: 20 },
            },
            { name: 'q', in: 'query', schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'List' } },
        },
        post: {
          tags: ['Branch Store'],
          summary: 'Create bidder (createdBy = branch)',
          security: bearer,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateUserBody' },
              },
            },
          },
          responses: { '201': { description: 'Created' } },
        },
      },
      '/branch-store/bidders/{id}/block': {
        post: {
          tags: ['Branch Store'],
          summary: 'Block bidder created by this branch',
          security: bearer,
          parameters: [
            { name: 'id', in: 'path', required: true, schema: objectId },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StatusActionBody' },
              },
            },
          },
          responses: { '200': { description: 'Blocked' } },
        },
      },
      '/branch-store/bidders/{id}/unblock': {
        post: {
          tags: ['Branch Store'],
          summary: 'Unblock bidder created by this branch',
          security: bearer,
          parameters: [
            { name: 'id', in: 'path', required: true, schema: objectId },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StatusActionBody' },
              },
            },
          },
          responses: { '200': { description: 'Unblocked' } },
        },
      },

      // Agent
      '/agent/health': {
        get: {
          tags: ['Agent'],
          summary: 'Module health',
          security: bearer,
          responses: { '200': { description: 'OK' } },
        },
      },
      '/agent/bidders': {
        get: {
          tags: ['Agent'],
          summary: 'List operator bidders',
          security: bearer,
          parameters: [
            {
              name: 'status',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['active', 'inactive', 'blocked'],
              },
            },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', default: 20 },
            },
          ],
          responses: { '200': { description: 'List' } },
        },
        post: {
          tags: ['Agent'],
          summary: 'Create bidder (createdBy = agent)',
          security: bearer,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateUserBody' },
              },
            },
          },
          responses: { '201': { description: 'Created' } },
        },
      },
      '/agent/bidders/{id}/block': {
        post: {
          tags: ['Agent'],
          summary: 'Block bidder created by this agent',
          security: bearer,
          parameters: [
            { name: 'id', in: 'path', required: true, schema: objectId },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StatusActionBody' },
              },
            },
          },
          responses: { '200': { description: 'Blocked' } },
        },
      },
      '/agent/bidders/{id}/unblock': {
        post: {
          tags: ['Agent'],
          summary: 'Unblock bidder created by this agent',
          security: bearer,
          parameters: [
            { name: 'id', in: 'path', required: true, schema: objectId },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StatusActionBody' },
              },
            },
          },
          responses: { '200': { description: 'Unblocked' } },
        },
      },

      // Bidder
      '/bidder/health': {
        get: {
          tags: ['Bidder'],
          summary: 'Module health',
          security: bearer,
          responses: { '200': { description: 'OK' } },
        },
      },
      '/bidder/chits/{id}/join': {
        post: {
          tags: ['Bidder'],
          summary: 'Self-join an active chit',
          security: bearer,
          parameters: [
            { name: 'id', in: 'path', required: true, schema: objectId },
          ],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    numberOfTickets: {
                      type: 'integer',
                      default: 1,
                      example: 1,
                    },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Joined' } },
        },
      },

      // Chits
      '/chits': {
        get: {
          tags: ['Chits'],
          summary: 'List chits (scoped)',
          security: bearer,
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', default: 20 },
            },
            { name: 'q', in: 'query', schema: { type: 'string' } },
            {
              name: 'amountInLakhs',
              in: 'query',
              schema: { type: 'number' },
            },
            {
              name: 'status',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['active', 'completed', 'cancelled', 'deleted'],
              },
            },
            {
              name: 'agentId',
              in: 'query',
              schema: objectId,
              description: 'Super admin only',
            },
            {
              name: 'branchStoreId',
              in: 'query',
              schema: objectId,
              description: 'Super admin only',
            },
          ],
          responses: { '200': { description: 'Paged list' } },
        },
        post: {
          tags: ['Chits'],
          summary: 'Create chit (peer ownership)',
          description:
            'Agent → owned by self. Branch → owned by self (no agentId). Super Admin must pass agentId **or** branchStoreId.',
          security: bearer,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateChitBody' },
              },
            },
          },
          responses: { '201': { description: 'Created' } },
        },
      },
      '/chits/summary': {
        get: {
          tags: ['Chits'],
          summary: 'Summary by amount tier',
          security: bearer,
          responses: { '200': { description: 'Tiers' } },
        },
      },
      '/chits/{id}': {
        get: {
          tags: ['Chits'],
          summary: 'Get chit by id',
          security: bearer,
          parameters: [
            { name: 'id', in: 'path', required: true, schema: objectId },
          ],
          responses: {
            '200': { description: 'Detail' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
        patch: {
          tags: ['Chits'],
          summary: 'Update chit',
          security: bearer,
          parameters: [
            { name: 'id', in: 'path', required: true, schema: objectId },
          ],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: true,
                  example: { monthlyInstallment: 5500 },
                },
              },
            },
          },
          responses: { '200': { description: 'Updated' } },
        },
        delete: {
          tags: ['Chits'],
          summary: 'Soft-delete chit',
          security: bearer,
          parameters: [
            { name: 'id', in: 'path', required: true, schema: objectId },
          ],
          responses: { '200': { description: 'Deleted' } },
        },
      },
      '/chits/{id}/members': {
        post: {
          tags: ['Chits'],
          summary: 'Add member',
          security: bearer,
          parameters: [
            { name: 'id', in: 'path', required: true, schema: objectId },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AddMemberBody' },
              },
            },
          },
          responses: { '201': { description: 'Member added' } },
        },
      },
      '/chits/{id}/members/{bidderId}': {
        patch: {
          tags: ['Chits'],
          summary: 'Update member tickets',
          security: bearer,
          parameters: [
            { name: 'id', in: 'path', required: true, schema: objectId },
            {
              name: 'bidderId',
              in: 'path',
              required: true,
              schema: objectId,
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['numberOfTickets'],
                  properties: {
                    numberOfTickets: { type: 'integer', example: 2 },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Updated' } },
        },
        delete: {
          tags: ['Chits'],
          summary: 'Remove member',
          security: bearer,
          parameters: [
            { name: 'id', in: 'path', required: true, schema: objectId },
            {
              name: 'bidderId',
              in: 'path',
              required: true,
              schema: objectId,
            },
          ],
          responses: { '200': { description: 'Removed' } },
        },
      },

      // Installments
      '/chits/{id}/installments': {
        get: {
          tags: ['Installments'],
          summary: 'List installments',
          security: bearer,
          parameters: [
            { name: 'id', in: 'path', required: true, schema: objectId },
            {
              name: 'bidderId',
              in: 'query',
              schema: objectId,
            },
            {
              name: 'status',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['pending', 'paid', 'overdue', 'waived'],
              },
            },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', default: 50 },
            },
          ],
          responses: { '200': { description: 'List' } },
        },
        post: {
          tags: ['Installments'],
          summary: 'Record installment (operators)',
          security: bearer,
          parameters: [
            { name: 'id', in: 'path', required: true, schema: objectId },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/InstallmentBody' },
              },
            },
          },
          responses: { '201': { description: 'Recorded' } },
        },
      },

      // Auctions
      '/chits/{id}/auction-rounds': {
        get: {
          tags: ['Auctions'],
          summary: 'List auction rounds',
          security: bearer,
          parameters: [
            { name: 'id', in: 'path', required: true, schema: objectId },
            {
              name: 'status',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['open', 'closed', 'cancelled'],
              },
            },
          ],
          responses: { '200': { description: 'List' } },
        },
        post: {
          tags: ['Auctions'],
          summary: 'Create auction round (auction_chit only)',
          security: bearer,
          parameters: [
            { name: 'id', in: 'path', required: true, schema: objectId },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuctionRoundBody' },
              },
            },
          },
          responses: { '201': { description: 'Created' } },
        },
      },
      '/chits/{id}/auction-rounds/{roundId}': {
        get: {
          tags: ['Auctions'],
          summary: 'Get auction round',
          security: bearer,
          parameters: [
            { name: 'id', in: 'path', required: true, schema: objectId },
            {
              name: 'roundId',
              in: 'path',
              required: true,
              schema: objectId,
            },
          ],
          responses: { '200': { description: 'Detail' } },
        },
      },
      '/chits/{id}/auction-rounds/{roundId}/bids': {
        post: {
          tags: ['Auctions'],
          summary: 'Place / update bid (bidder member)',
          security: bearer,
          parameters: [
            { name: 'id', in: 'path', required: true, schema: objectId },
            {
              name: 'roundId',
              in: 'path',
              required: true,
              schema: objectId,
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/BidBody' },
              },
            },
          },
          responses: { '200': { description: 'Bid saved' } },
        },
      },
      '/chits/{id}/auction-rounds/{roundId}/close': {
        post: {
          tags: ['Auctions'],
          summary: 'Close round (lowest bid wins if no winner set)',
          security: bearer,
          parameters: [
            { name: 'id', in: 'path', required: true, schema: objectId },
            {
              name: 'roundId',
              in: 'path',
              required: true,
              schema: objectId,
            },
          ],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    winnerBidderId: objectId,
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Closed' } },
        },
      },

      // Reports
      '/reports/overview': {
        get: {
          tags: ['Reports'],
          summary: 'Scoped metrics overview',
          security: bearer,
          responses: { '200': { description: 'Metrics' } },
        },
      },

      ...buildExtraOpenApiPaths(bearer),
    },
  };
}

export type OpenApiDocument = ReturnType<typeof buildOpenApiDocument>;
