/**
 * Extra OpenAPI paths not in the core openapi.ts body —
 * signup, payments, profile/security, remaining super-admin.
 */
export function buildExtraOpenApiPaths(bearer: { BearerAuth: never[] }[]) {
  const signupAadhaarRequest = {
    post: {
      summary: 'Start Aadhaar OTP (manual KYC)',
      description:
        'Creates a signup session. Use a **fresh** 12-digit Aadhaar (not seed users). Mock OTP is `123456`.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['aadhaarNumber'],
              properties: {
                aadhaarNumber: {
                  type: 'string',
                  example: '354136431636',
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description:
            'Returns sessionId (save it). In development may include mockOtpHint.',
        },
      },
    },
  };

  const signupAadhaarResend = {
    post: {
      summary: 'Resend Aadhaar OTP',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['sessionId'],
              properties: {
                sessionId: { type: 'string', example: '<from request-otp>' },
              },
            },
          },
        },
      },
      responses: { '200': { description: 'OTP resent' } },
    },
  };

  const signupAadhaarVerify = {
    post: {
      summary: 'Verify Aadhaar OTP — seals KYC profile',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['sessionId', 'otp'],
              properties: {
                sessionId: { type: 'string' },
                otp: { type: 'string', example: '123456' },
              },
            },
          },
        },
      },
      responses: { '200': { description: 'KYC sealed on session' } },
    },
  };

  const signupDigilockerStart = {
    post: {
      summary: 'Start DigiLocker mock OAuth',
      description: 'Returns authorizationUrl. Mock callback code: `mock-digilocker-code`.',
      responses: {
        '200': {
          description: 'authorizationUrl + session/state',
        },
      },
    },
  };

  const signupDigilockerCallback = {
    get: {
      summary: 'DigiLocker callback',
      parameters: [
        {
          name: 'code',
          in: 'query',
          required: true,
          schema: { type: 'string', example: 'mock-digilocker-code' },
        },
        {
          name: 'state',
          in: 'query',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        '200': {
          description: 'JSON if Accept: application/json; else redirect',
        },
      },
    },
  };

  const signupSession = {
    get: {
      summary: 'Get signup session status + sealed profile',
      parameters: [
        {
          name: 'sessionId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: { '200': { description: 'Session' } },
    },
  };

  const signupComplete = {
    post: {
      summary: 'Complete registration — creates user + tokens',
      description:
        'Requires verified signup session **and** a confirmed signup payment (`paymentId` from POST /auth/payments/confirm).',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['sessionId', 'phone', 'paymentId'],
              properties: {
                sessionId: { type: 'string' },
                countryCode: { type: 'string', default: '+91', example: '+91' },
                phone: { type: 'string', example: '9876543210' },
                currentAddress: {
                  type: 'object',
                  description:
                    'Optional current address (Street / Area, city, state, pincode, country)',
                  required: ['street', 'city', 'state', 'pincode'],
                  properties: {
                    street: {
                      type: 'string',
                      description: 'Street / Area',
                      example: '42, MG Road, Koramangala',
                    },
                    city: { type: 'string', example: 'Bengaluru' },
                    state: { type: 'string', example: 'Karnataka' },
                    pincode: {
                      type: 'string',
                      example: '560034',
                      pattern: '^\\d{6}$',
                    },
                    country: {
                      type: 'string',
                      example: 'India',
                      default: 'India',
                    },
                  },
                },
                paymentId: {
                  type: 'string',
                  description: 'From payments/confirm response',
                  example: 'pay_demo_...',
                },
              },
            },
          },
        },
      },
      responses: {
        '201': {
          description: 'User created; accessToken + refreshToken returned',
        },
      },
    },
  };

  function registerPaths(tag: string, base: string) {
    return {
      [`${base}/aadhaar/request-otp`]: {
        post: { ...signupAadhaarRequest.post, tags: [tag] },
      },
      [`${base}/aadhaar/resend-otp`]: {
        post: { ...signupAadhaarResend.post, tags: [tag] },
      },
      [`${base}/aadhaar/verify-otp`]: {
        post: { ...signupAadhaarVerify.post, tags: [tag] },
      },
      [`${base}/digilocker/start`]: {
        post: { ...signupDigilockerStart.post, tags: [tag] },
      },
      [`${base}/digilocker/callback`]: {
        get: { ...signupDigilockerCallback.get, tags: [tag] },
      },
      [`${base}/session/{sessionId}`]: {
        get: { ...signupSession.get, tags: [tag] },
      },
      [`${base}/complete`]: {
        post: { ...signupComplete.post, tags: [tag] },
      },
    };
  }

  return {
    ...registerPaths('Agent Signup', '/auth/agent/register'),
    ...registerPaths('Bidder Signup', '/auth/bidder/register'),

    '/auth/payments/create-order': {
      post: {
        tags: ['Signup Payment'],
        summary: 'Create demo signup fee order',
        description:
          'Call after Aadhaar/DigiLocker verify. Pass the same sessionId. role = agent | bidder.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['role', 'sessionId'],
                properties: {
                  role: {
                    type: 'string',
                    enum: ['agent', 'bidder'],
                    example: 'agent',
                  },
                  sessionId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'orderId for confirm step' },
        },
      },
    },
    '/auth/payments/confirm': {
      post: {
        tags: ['Signup Payment'],
        summary: 'Confirm demo payment',
        description:
          'Returns paymentId — required by register/complete. paymentId optional (auto-generated if omitted).',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['orderId'],
                properties: {
                  orderId: { type: 'string', example: 'order_demo_...' },
                  paymentId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'paymentId to pass into /complete' },
        },
      },
    },
    '/auth/payments/{orderId}': {
      get: {
        tags: ['Signup Payment'],
        summary: 'Get payment order status',
        parameters: [
          {
            name: 'orderId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: { '200': { description: 'Order' } },
      },
    },

    '/auth/profile': {
      patch: {
        tags: ['Auth'],
        summary: 'Update profile (phone2 / address / nominees)',
        security: bearer,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  phone2: { type: 'string', example: '9888888888' },
                  currentAddress: {
                    type: 'object',
                    nullable: true,
                    description:
                      'Street / Area, city, state, pincode, country (same shape as aadhaarAddress)',
                    required: ['street', 'city', 'state', 'pincode'],
                    properties: {
                      street: {
                        type: 'string',
                        description: 'Street / Area',
                        example: '42, MG Road, Koramangala',
                      },
                      city: { type: 'string', example: 'Bengaluru' },
                      state: { type: 'string', example: 'Karnataka' },
                      pincode: {
                        type: 'string',
                        example: '560034',
                        pattern: '^\\d{6}$',
                      },
                      country: {
                        type: 'string',
                        example: 'India',
                        default: 'India',
                      },
                    },
                  },
                  nomineeUserIds: {
                    type: 'array',
                    items: {
                      type: 'string',
                      pattern: '^[a-fA-F0-9]{24}$',
                    },
                    maxItems: 2,
                  },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Updated' } },
      },
    },
    '/auth/profile/nominee-search': {
      get: {
        tags: ['Auth'],
        summary: 'Search nominee candidates by phone',
        security: bearer,
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: true,
            schema: { type: 'string', minLength: 10, example: '9888888883' },
          },
        ],
        responses: { '200': { description: 'Matches' } },
      },
    },
    '/auth/security': {
      get: {
        tags: ['Auth'],
        summary: 'Security status (2FA / screen lock / biometric)',
        security: bearer,
        responses: { '200': { description: 'Status + allowed methods' } },
      },
      post: {
        tags: ['Auth'],
        summary: 'Configure security method',
        security: bearer,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['method', 'enabled'],
                properties: {
                  method: {
                    type: 'string',
                    enum: ['totp', 'screen_lock', 'biometric'],
                  },
                  enabled: { type: 'boolean' },
                  pin: { type: 'string' },
                  currentPin: { type: 'string' },
                  totp: { type: 'string' },
                  webauthnResponse: { type: 'object' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Updated' } },
      },
    },
    '/auth/security/unlock': {
      post: {
        tags: ['Auth'],
        summary: 'Unlock after screen lock',
        security: bearer,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['method'],
                properties: {
                  method: {
                    type: 'string',
                    enum: ['pin', 'totp', 'biometric'],
                  },
                  pin: { type: 'string' },
                  totp: { type: 'string' },
                  webauthnResponse: { type: 'object' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Unlocked' } },
      },
    },

    '/super-admin/permissions': {
      get: {
        tags: ['Super Admin'],
        summary: 'Permission catalog for provisioning',
        security: bearer,
        responses: { '200': { description: 'Assignable sets + tiers' } },
      },
    },
    '/super-admin/staff': {
      get: {
        tags: ['Super Admin'],
        summary: 'List super-admin staff',
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
        summary: 'Create super-admin staff (* only)',
        security: bearer,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'phone', 'aadhaarNumber'],
                properties: {
                  name: { type: 'string', example: 'Platform Editor' },
                  countryCode: { type: 'string', default: '+91' },
                  phone: { type: 'string', example: '9777777777' },
                  aadhaarNumber: {
                    type: 'string',
                    example: '777777777777',
                  },
                  tier: {
                    type: 'string',
                    enum: ['full', 'manager', 'editor'],
                    default: 'editor',
                  },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/super-admin/admins': {
      get: {
        tags: ['Super Admin'],
        summary: '[Deprecated] List branch stores (alias)',
        deprecated: true,
        security: bearer,
        responses: { '200': { description: 'Same as /branch-stores' } },
      },
      post: {
        tags: ['Super Admin'],
        summary: '[Deprecated] Create branch store (alias)',
        deprecated: true,
        security: bearer,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateBranchStoreBody' },
            },
          },
        },
        responses: { '201': { description: 'Created' } },
      },
    },
  };
}
