---
layout: base.njk
title: "Integration Examples and Best Practices"
description: "Practical integration examples and solutions for ScotAccount implementation challenges"
eleventyNavigation:
  key: integration-examples
  order: 8
---

<div class="callout callout--warning">
<strong>Example Code Disclaimer</strong>: All code examples in this guide are for educational and reference purposes only. They are not production-ready implementations and must be thoroughly reviewed, tested, and adapted to meet your specific security and operational requirements before use in any live system.
</div>

This page provides practical integration examples for ScotAccount implementation patterns. These examples demonstrate common integration approaches but must be customized and secured for your specific use case.

## Phase 1: Setup & Registration Examples

### Discovery Endpoint Integration

Always retrieve current configuration dynamically:

```javascript
async function getOidcConfiguration() {
  const response = await fetch(
    "https://authz.integration.scotaccount.service.gov.scot/.well-known/openid-configuration"
  );
  return await response.json();
}
```

**Key configuration values**:

- `authorisation_endpoint` - Where to send authentication requests
- `token_endpoint` - Where to exchange codes for tokens
- `jwks_uri` - Public keys for token validation

### PKCE Implementation

Generate PKCE parameters for security:

```javascript
function generatePKCE() {
  // Generate random code verifier
  const codeVerifier = base64URLEncode(crypto.randomBytes(32));

  // Create SHA256 hash
  const hash = crypto.createHash("sha256").update(codeVerifier).digest();
  const codeChallenge = base64URLEncode(hash);

  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: "S256",
  };
}
```

## Phase 2: Basic Authentication Examples

### Authorization Request Builder

Build the authentication URL:

```javascript
function buildAuthUrl(config, pkce, clientId, redirectUri) {
  const state = crypto.randomBytes(16).toString("hex");
  const nonce = crypto.randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid",
    state: state,
    nonce: nonce,
    code_challenge: pkce.codeChallenge,
    code_challenge_method: pkce.codeChallengeMethod,
  });

  // Store state for up to 7 days
  await redis.setex(`state:${state}`, 7*24*60*60, JSON.stringify({
    nonce: nonce,
    codeVerifier: pkce.codeVerifier,
    timestamp: Date.now()
  }));

  return `${config.authorisation_endpoint}?${params.toString()}`;
}
```

### Callback Handler

Process the authentication response:

```javascript
function handleCallback(req) {
  const { code, state, error } = req.query;

  // Handle errors first
  if (error) {
    // See Error Reference for complete error handling strategies
    throw new Error(`Authentication failed: ${error}`);
  }

  // Validate state parameter (7-day persistence)
  const storedDataJson = await redis.get(`state:${state}`);
  const storedData = storedDataJson ? JSON.parse(storedDataJson) : null;
  if (!storedData) {
    throw new Error("Invalid state parameter");
  }

  return {
    code,
    state,
    nonce: storedData.nonce,
    codeVerifier: storedData.codeVerifier,
  };
}
```


### JWT Client Assertion

Create signed JWT for token exchange:

```javascript
function createClientAssertion(clientId, tokenEndpoint, privateKey) {
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    iss: clientId,
    sub: clientId,
    aud: tokenEndpoint,
    exp: now + (6 * 30 * 24 * 60 * 60), // 6 months expiration
    iat: now,
    jti: crypto.randomUUID(),
  };

  return jwt.sign(payload, privateKey, { algorithm: "RS256" });
}
```

### DIS-Client-Assertion for Attributes

Create signed JWT specifically for attributes endpoint:

```javascript
function createDisClientAssertion(clientId, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  
  // For attributes endpoint
  const assertion = {
    iss: clientId,
    sub: clientId,
    aud: "https://issuer.main.integration.scotaccount.service.gov.scot/attributes/values",
    exp: now + (6 * 30 * 24 * 60 * 60), // 6 months
    iat: now,
    jti: crypto.randomUUID()
  };
  
  // Sign with private key and add as DIS-Client-Assertion header
  return jwt.sign(assertion, privateKey, { algorithm: "RS256" });
}
```

### Token Exchange

Exchange authorisation code for tokens:

```javascript
async function exchangeCodeForTokens(
  config,
  code,
  redirectUri,
  codeVerifier,
  clientAssertion
) {
  const response = await fetch(config.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorisation_code",
      code: code,
      redirect_uri: redirectUri,
      client_assertion_type:
        "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: clientAssertion,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status}`);
  }

  return await response.json();
}
```

### ID Token Validation with JWKS Rotation

Validate and extract user information with proper key handling:

```javascript
async function validateIdToken(idToken, clientId, config, expectedNonce) {
  // Always fetch latest keys before validation
  const jwks = await fetch(config.jwks_uri).then((r) => r.json());
  
  // Keys are ordered with newest first
  const currentKey = jwks.keys[0];
  
  // Verify JWT signature and claims
  const decoded = jwt.verify(idToken, getPublicKey(jwks), {
    algorithms: ["RS256"],
    audience: clientId,
    issuer: config.issuer,
  });

  // Validate nonce
  if (decoded.nonce !== expectedNonce) {
    throw new Error("Invalid nonce");
  }

  return {
    userId: decoded.sub,
    sessionId: decoded.sid,
    authenticatedAt: decoded.iat,
  };
}
```

## Phase 3: Verified Attributes Examples

### Attribute Request Implementation

Request verified attributes using access token with proper error handling:

<div class="callout callout--info">
<strong>Error Handling Reference:</strong> For complete error codes, resolution strategies, and production-ready error handling patterns, see the <a href="{{ '/error-reference/' | url }}">Error Reference</a>.
</div>

```javascript
async function requestVerifiedAttributes(accessToken, clientAssertion) {
  try {
    const response = await fetch(
      "https://issuer.main.integration.scotaccount.service.gov.scot/attributes/values",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "DIS-Client-Assertion": clientAssertion,
        },
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Attribute request failed: ${response.status} - ${errorBody}`);
      
      switch (response.status) {
        case 401:
          throw new Error('Unauthorised: Invalid access token or client assertion');
        case 403:
          throw new Error('Forbidden: Insufficient permissions for requested attributes');
        case 404:
          throw new Error('Not Found: User has no verified attributes');
        case 429:
          throw new Error('Rate Limited: Too many requests');
        case 500:
        case 502:
        case 503:
          throw new Error('Service Unavailable: Attributes service temporarily down');
        default:
          throw new Error(`Attribute request failed: ${response.status}`);
      }
    }

    return await response.json();
  } catch (error) {
    console.error('Error requesting verified attributes:', error);
    throw error;
  }
}
```

<div class="callout callout--info">
<strong>Response Schema Reference:</strong> For complete JSON schema specifications including all field definitions and validation rules for attributes responses, see the <a href="{{ '/scotaccount-currentschema/' | url }}">Current Data Schema</a>.
</div>

### Attribute Token Validation

Validate and extract verified claims:

```javascript
async function validateAttributeToken(claimsToken, config) {
  // Get public keys for attribute service
  const jwks = await fetch(config.attribute_jwks_uri).then((r) => r.json());

  // Verify JWT signature and claims
  const decoded = jwt.verify(claimsToken, getPublicKey(jwks), {
    algorithms: ["RS256"],
    issuer: config.attribute_issuer,
  });

  return decoded.verified_claims;
}
```

## Phase 4: Production Deployment Examples

### Environment Configuration

Update endpoints for production:

```javascript
const config = {
  integration: {
    discoveryUrl:
      "https://authz.integration.scotaccount.service.gov.scot/.well-known/openid-configuration",
  },
  production: {
    discoveryUrl:
      "https://authz.scotaccount.service.gov.scot/.well-known/openid-configuration",
  },
  mock: {
    // Mock service endpoints (no validation)
    discoveryUrl: "https://mock-dis.main.integration.scotaccount.service.gov.scot/v2/.well-known/openid-configuration",
    // Note: Mock doesn't validate assertions or PKCE
  },
};
```

### Monitoring and Logging

Implement comprehensive monitoring:

```javascript
// Log authentication events
function logAuthEvent(event, userId, details) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      event: event,
      userId: userId,
      sessionId: details.sessionId,
      userAgent: details.userAgent,
      ipAddress: details.ipAddress,
    })
  );
}

// Track authentication metrics
function trackMetrics(event, duration) {
  // Send to your monitoring system
  metrics.increment(`scotaccount.${event}`);
  metrics.timing(`scotaccount.${event}.duration`, duration);
}
```

### Error Handling

Implement user-friendly error handling:

```javascript
function handleAuthError(error, res) {
  console.error("Authentication error:", error);

  const errorCode = error.code || error.message;
  
  switch (errorCode) {
    case "access_denied":
      res.redirect("/auth/cancelled");
      break;
    case "invalid_request":
      res.status(400).render("error", {
        message: "Invalid authentication request - please check your configuration",
        details: "The request parameters were malformed or missing required values"
      });
      break;
    case "unauthorized_client":
      res.status(401).render("error", {
        message: "Client authentication failed",
        details: "Your service is not authorised to use ScotAccount"
      });
      break;
    case "unsupported_response_type":
      res.status(400).render("error", {
        message: "Unsupported response type",
        details: "The authorization code flow must be used"
      });
      break;
    case "invalid_scope":
      res.status(400).render("error", {
        message: "Invalid scope requested",
        details: "One or more requested scopes are not supported"
      });
      break;
    case "server_error":
      res.status(502).render("error", {
        message: "ScotAccount service temporarily unavailable",
        details: "Please try again in a few minutes"
      });
      break;
    case "temporarily_unavailable":
      res.status(503).render("error", {
        message: "Service temporarily unavailable",
        details: "The authentication service is undergoing maintenance"
      });
      break;
    default:
      res.status(500).render("error", {
        message: "Authentication failed",
        details: "An unexpected error occurred during authentication"
      });
  }
}
```

## Logout Implementation

Implement secure logout with id_token_hint:

```javascript
function buildLogoutUrl(config, idToken, logoutRedirectUri) {
  const logoutState = crypto.randomBytes(16).toString('hex');
  
  // Store logout state for validation
  redis.setex(`logout_state:${logoutState}`, 300, JSON.stringify({
    timestamp: Date.now(),
    originalUri: logoutRedirectUri
  })); // 5 minutes
  
  // Logout requires id_token_hint
  const logoutUrl = `${config.end_session_endpoint}?` +
    `id_token_hint=${idToken}&` +
    `post_logout_redirect_uri=${encodeURIComponent(logoutRedirectUri)}&` +
    `state=${logoutState}`;
    
  return logoutUrl;
}

async function handleLogoutCallback(req, res) {
  const { state } = req.query;
  
  if (!state) {
    return res.status(400).render('error', {
      message: 'Missing logout state parameter'
    });
  }
  
  // Validate logout state
  const stateDataJson = await redis.get(`logout_state:${state}`);
  const stateData = stateDataJson ? JSON.parse(stateDataJson) : null;
  
  if (!stateData) {
    return res.status(400).render('error', {
      message: 'Invalid logout state - session may have expired'
    });
  }
  
  // Clean up state
  await redis.del(`logout_state:${state}`);
  
  // Clear local session
  req.session.destroy();
  
  res.redirect('/logged-out');
}
```

## Mock Service Integration

Example configuration for mock service testing:

```javascript
// Mock service endpoints (no validation)
const mockConfig = {
  discovery: "https://mock-dis.main.integration.scotaccount.service.gov.scot/v2/.well-known/openid-configuration",
  // Note: Mock doesn't validate assertions or PKCE
  clientId: "mock-client-id",
  skipValidation: true, // Flag for test environment
};

// Mock-aware validation function
async function validateTokenForEnvironment(token, config) {
  if (config.skipValidation) {
    console.warn('WARNING: Token validation skipped for mock environment');
    return jwt.decode(token); // Don't verify signature in mock
  }
  
  return await validateIdToken(token, config.clientId, config.nonce, config.issuer);
}
```

## Example Node.js/Express Implementation

Here's an example showing how these patterns might be implemented in a Node.js/Express application:

```javascript
const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const app = express();

// Configuration
const CLIENT_ID = process.env.SCOTACCOUNT_CLIENT_ID;
const PRIVATE_KEY = process.env.SCOTACCOUNT_PRIVATE_KEY;
const REDIRECT_URI = process.env.SCOTACCOUNT_REDIRECT_URI;

// Routes
app.get("/auth/login", async (req, res) => {
  try {
    const config = await getOidcConfiguration();
    const pkce = generatePKCE();
    const authUrl = buildAuthUrl(config, pkce, CLIENT_ID, REDIRECT_URI);

    res.redirect(authUrl);
  } catch (error) {
    handleAuthError(error, res);
  }
});

app.get("/auth/callback", async (req, res) => {
  try {
    const callbackData = handleCallback(req);
    const config = await getOidcConfiguration();

    const clientAssertion = createClientAssertion(
      CLIENT_ID,
      config.token_endpoint,
      PRIVATE_KEY
    );
    
    // Also create DIS-Client-Assertion for attributes
    const disClientAssertion = createDisClientAssertion(CLIENT_ID, PRIVATE_KEY);

    const tokens = await exchangeCodeForTokens(
      config,
      callbackData.code,
      REDIRECT_URI,
      callbackData.codeVerifier,
      clientAssertion
    );

    const userInfo = await validateIdToken(
      tokens.id_token,
      CLIENT_ID,
      config,
      callbackData.nonce
    );

    // Store user session with tokens for logout
    req.session.user = userInfo;
    req.session.tokens = {
      id_token: tokens.id_token,
      access_token: tokens.access_token,
      dis_client_assertion: disClientAssertion
    };

    res.redirect("/dashboard");
  } catch (error) {
    handleAuthError(error, res);
  }
});

// Logout route
app.get('/auth/logout', async (req, res) => {
  try {
    const config = await getOidcConfiguration();
    const idToken = req.session.tokens?.id_token;
    
    if (!idToken) {
      // No active session, redirect to home
      return res.redirect('/');
    }
    
    const logoutUrl = buildLogoutUrl(config, idToken, `${req.protocol}://${req.get('host')}/auth/logout-callback`);
    res.redirect(logoutUrl);
  } catch (error) {
    console.error('Logout error:', error);
    req.session.destroy();
    res.redirect('/');
  }
});

// Logout callback
app.get('/auth/logout-callback', handleLogoutCallback);

// Attributes endpoint
app.get('/api/attributes', async (req, res) => {
  try {
    if (!req.session.tokens) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const attributes = await requestVerifiedAttributes(
      req.session.tokens.access_token,
      req.session.tokens.dis_client_assertion
    );
    
    res.json(attributes);
  } catch (error) {
    console.error('Attributes error:', error);
    res.status(500).json({ error: 'Failed to retrieve attributes' });
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
```

## Example: Authentication Flow with PKCE

**Example PKCE (Proof Key for Code Exchange) Implementation:**

- **Purpose:** Example showing security pattern for preventing interception attacks
- **Implementation:** Example using SHA256 method as recommended

```javascript
// Complete authentication flow with PKCE and error handling
async function handleAuthentication(req, res) {
  try {
    // Generate secure parameters
    const pkce = generatePKCE();
    const state = generateSecureState();
    const nonce = generateNonce();

    // Store securely for validation
    await storeAuthState(state, { nonce, codeVerifier: pkce.codeVerifier });

    // Build authorisation URL
    const authUrl = buildAuthorisationUrl({
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      scope: "openid",
      state,
      nonce,
      codeChallenge: pkce.codeChallenge,
      codeChallengeMethod: "S256",
    });

    res.redirect(authUrl);
  } catch (error) {
    handleAuthError(error, res);
  }
}
```

## Example: Token Validation

**Example ID Token Verification:**

- **Purpose:** Example showing how tokens should be validated
- **Implementation:** Example validation patterns as shown below

```javascript
// Token validation example
async function validateTokens(tokens, expectedState, expectedNonce) {
  // Validate state first
  const storedAuth = await getAuthState(expectedState);
  if (!storedAuth) {
    throw new Error("Invalid state - possible CSRF attack");
  }

  // Validate ID token
  const payload = await validateIdToken(
    tokens.id_token,
    CLIENT_ID,
    expectedNonce,
    ISSUER
  );

  // Extract and validate claims
  const userInfo = extractUserInfo(payload);

  // Clean up stored state
  await deleteAuthState(expectedState);

  return userInfo;
}
```

## Example: Session Management

**Example Secure Session Storage:**

- **Purpose:** Example showing secure session storage patterns
- **Implementation:** Example using encrypted, server-side storage

### Secure Session Implementation

```javascript
// Secure session implementation example
class SecureSession {
  constructor(sessionData) {
    this.userId = sessionData.userId;
    this.sessionId = sessionData.sessionId;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
    this.expiresAt = Date.now() + 4 * 60 * 60 * 1000; // 4 hours (ScotAccount session timeout)
  }

  isValid() {
    return Date.now() < this.expiresAt;
  }

  updateActivity() {
    this.lastActivity = Date.now();
  }

  async store() {
    const encrypted = encrypt(JSON.stringify(this));
    await redis.setex(`session:${this.sessionId}`, 28800, encrypted);
  }

  static async retrieve(sessionId) {
    const encrypted = await redis.get(`session:${sessionId}`);
    if (!encrypted) return null;

    const data = JSON.parse(decrypt(encrypted));
    const session = new SecureSession(data);

    if (!session.isValid()) {
      await session.destroy();
      return null;
    }

    return session;
  }

  async destroy() {
    await redis.del(`session:${this.sessionId}`);
  }
}
```

### Logout Implementation

```javascript
// Redirect to ScotAccount logout
function buildLogoutUrl(idToken, postLogoutUrl, state = 'logout-state') {
  const params = new URLSearchParams({
    id_token_hint: idToken,
    post_logout_redirect_uri: postLogoutUrl,
    state: state
  });
  
  return `https://authz.integration.scotaccount.service.gov.scot/authorize/logout?${params.toString()}`;
}

// Usage example
app.get('/logout', (req, res) => {
  const logoutUrl = buildLogoutUrl(
    req.session.idToken,
    'https://yourservice.gov.scot/logout-success',
    crypto.randomBytes(16).toString('hex')
  );
  
  // Clear local session
  req.session.destroy();
  
  // Redirect to ScotAccount logout
  res.redirect(logoutUrl);
});
```

## Example: Multi-Environment Configuration

**Example Environment Configuration:**

- **Purpose:** Example showing configuration patterns for different environments
- **Implementation:** Example environment-specific settings

```javascript
// Environment-specific configuration example
const config = {
  development: {
    discoveryUrl:
      "https://authz.integration.scotaccount.service.gov.scot/.well-known/openid-configuration",
    clientId: process.env.DEV_CLIENT_ID,
    redirectUri: "http://localhost:3000/auth/callback",
  },

  integration: {
    discoveryUrl:
      "https://authz.integration.scotaccount.service.gov.scot/.well-known/openid-configuration",
    clientId: process.env.INT_CLIENT_ID,
    redirectUri: "https://your-service-int.gov.scot/auth/callback",
  },

  production: {
    discoveryUrl:
      "https://authz.scotaccount.service.gov.scot/.well-known/openid-configuration",
    clientId: process.env.PROD_CLIENT_ID,
    redirectUri: "https://your-service.gov.scot/auth/callback",
  },
};

const currentConfig = config[process.env.NODE_ENV || "development"];
```

## Common Problems and Solutions

### State Expiry Issues

Handle 7-day verification flows properly:

```javascript
// BAD - State expires too quickly
app.use(session({
  maxAge: 60 * 60 * 1000 // 1 hour - TOO SHORT!
}));

// GOOD - Support 7-day verification flows
app.use(session({
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  rolling: true // Extend on activity
}));

// Best practice: Separate session and verification state
const verificationState = {
  stateId: generateSecureId(),
  userId: userUuid,
  createdAt: Date.now(),
  expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000),
  codeVerifier: pkceCodeVerifier,
  originalScopes: requestedScopes
};
await stateStore.save(verificationState.stateId, verificationState);
```

### Cross-Device Flow Support

Support resumable verification flows:

```javascript
// Support resumable flows
app.get('/verification/resume/:stateId', async (req, res) => {
  const state = await stateStore.get(req.params.stateId);
  
  if (!state || state.expiresAt < Date.now()) {
    return res.redirect('/verification/expired');
  }
  
  // Reconstruct authorization URL with original parameters
  const authUrl = buildAuthUrl({
    state: state.stateId,
    codeChallenge: state.codeChallenge,
    scopes: state.originalScopes
  });
  
  res.redirect(authUrl);
});

// Send verification link via email/SMS
async function sendVerificationLink(userEmail, stateId) {
  const resumeUrl = `https://yourservice.gov.scot/verification/resume/${stateId}`;
  await emailService.send({
    to: userEmail,
    subject: 'Continue Your Verification',
    body: `Click here to continue: ${resumeUrl}`
  });
}
```

## Example: Error Handling

**Example Authentication Error Handling:**

- **Purpose:** Example showing error handling patterns for better user experience
- **Implementation:** Example error handling for different scenarios

```javascript
// Error handling example
function handleAuthError(error, req, res) {
  const errorCode = req.query.error;
  const errorDescription = req.query.error_description;

  switch (errorCode) {
    case "access_denied":
      // User cancelled authentication
      res.render("auth-cancelled", {
        message: "Authentication was cancelled. Please try again.",
        retryUrl: "/auth/login",
      });
      break;

    case "invalid_request":
      // Malformed request
      console.error("Invalid auth request:", errorDescription);
      res.status(400).render("error", {
        message: "Invalid authentication request. Please contact support.",
        supportEmail: "support@your-service.gov.scot",
      });
      break;

    case "server_error":
      // ScotAccount service error
      console.error("ScotAccount service error:", errorDescription);
      res.status(502).render("error", {
        message:
          "Authentication service temporarily unavailable. Please try again later.",
        retryUrl: "/auth/login",
      });
      break;

    default:
      // Unexpected error
      console.error("Unexpected auth error:", error);
      res.status(500).render("error", {
        message: "An unexpected error occurred. Please try again.",
        retryUrl: "/auth/login",
      });
  }
}
```

## Example: Monitoring and Logging

**Example Authentication Event Tracking:**

- **Purpose:** Example showing monitoring patterns for authentication flows
- **Implementation:** Example logging and metrics collection

```javascript
// Monitoring and logging example
class AuthMonitoring {
  static logAuthEvent(event, userId, details = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event: event,
      userId: userId,
      sessionId: details.sessionId,
      userAgent: details.userAgent,
      ipAddress: details.ipAddress,
      environment: process.env.NODE_ENV,
    };

    console.log(JSON.stringify(logEntry));

    // Send to monitoring service
    this.sendToMonitoring(logEntry);
  }

  static trackMetric(metric, value, tags = {}) {
    // Send metrics to monitoring system
    metrics.increment(`scotaccount.${metric}`, value, tags);
  }

  static async sendToMonitoring(logEntry) {
    try {
      await fetch(process.env.MONITORING_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(logEntry),
      });
    } catch (error) {
      console.error("Failed to send monitoring data:", error);
    }
  }
}

// Usage examples
AuthMonitoring.logAuthEvent("auth_started", null, {
  userAgent: req.get("User-Agent"),
});
AuthMonitoring.logAuthEvent("auth_success", userInfo.userId, {
  sessionId: userInfo.sessionId,
});
AuthMonitoring.trackMetric("auth_duration", authDuration);
```

## Example: Testing Integration

**Example Authentication and Security Testing:**

- **Purpose:** Example showing testing patterns for integration validation
- **Implementation:** Example integration and security test patterns

```javascript
// Integration test example
describe("ScotAccount Integration", () => {
  it("should complete full authentication flow", async () => {
    // Start authentication
    const authResponse = await request(app).get("/auth/login").expect(302);

    // Extract state and code challenge
    const redirectUrl = new URL(authResponse.headers.location);
    const state = redirectUrl.searchParams.get("state");

    // Simulate callback with mock authorisation code
    const callbackResponse = await request(app)
      .get("/auth/callback")
      .query({
        code: "mock_auth_code",
        state: state,
      })
      .expect(302);

    // Verify successful authentication
    expect(callbackResponse.headers.location).toBe("/dashboard");
  });
});

// Security test example
describe("Security Tests", () => {
  it("should reject invalid state parameter", async () => {
    await request(app)
      .get("/auth/callback")
      .query({
        code: "valid_code",
        state: "invalid_state",
      })
      .expect(400);
  });

  it("should reject expired tokens", async () => {
    const expiredToken = createExpiredToken();

    const response = await request(app)
      .get("/api/user")
      .set("Authorisation", `Bearer ${expiredToken}`)
      .expect(401);
  });
});
```

## Example Implementation Checklist

Example considerations for your production implementation:

- [ ] **HTTPS enforcement** in all environments
- [ ] **Security headers** implementation
- [ ] **Rate limiting** on authentication endpoints
- [ ] **CORS configuration** for allowed origins
- [ ] **CSP headers** for XSS protection
- [ ] **Secure cookie settings** for session management
- [ ] **Environment variable validation** on startup
- [ ] **Health check endpoints** for monitoring
- [ ] **Graceful shutdown** handling
- [ ] **Database connection pooling** configuration
- [ ] **Performance optimisations** (e.g., JWT key caching, connection pooling, request timeouts)

## Next Steps

<div class="callout callout--success">
<strong>Ready to implement?</strong> Adapt these examples to build your ScotAccount integration, ensuring you review and test thoroughly before production deployment.
</div>

<div class="callout callout--info">
<strong>Need more examples?</strong> Review the <a href="{{ '/token-validation-examples/' | url }}">Token Validation Examples</a> for detailed validation patterns.
</div>

<div class="callout callout--warning">
<strong>Production deployment?</strong> Contact the ScotAccount team for security review and production deployment guidance before going live.
</div>
# Additional JavaScript Examples from ScotAccount Guide

## Token Management Examples

### Storing vs Requesting Attributes

```javascript
// BAD - Storing access token for later use
async function storeUserAttributes(accessToken) {
  // This access token will expire after 15 minutes (session lasts 4 hours)!
  await database.save({ userId, accessToken, storedAt: Date.now() });
}

// GOOD - Request attributes during active user session
async function getUserAttributes(currentSession) {
  if (!currentSession.isActive()) {
    throw new Error('User must re-authenticate to access attributes');
  }
  
  // Request fresh attributes with current session
  const attributes = await fetchAttributesWithAuth(currentSession.accessToken);
  return processAttributes(attributes);
}
```

### DIS-Client-Assertion Generation

```javascript
// Generate client assertion for attribute requests
function generateDISClientAssertion() {
  const now = Math.floor(Date.now() / 1000);
  
  const payload = {
    iss: CLIENT_ID, // Your registered client ID
    sub: CLIENT_ID, // Same as issuer for client credentials
    aud: 'https://issuer.main.scotaccount.service.gov.scot', // Attribute service audience
    iat: now,
    exp: now + 300, // 5 minute expiry
    jti: crypto.randomUUID()
  };
  
  return jwt.sign(payload, PRIVATE_KEY, { algorithm: 'ES256' });
}
```

## JWKS Management

### Robust JWKS Handling

```javascript
class JWKSManager {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    this.jwksUrl = process.env.JWKS_ENDPOINT;
  }
  
  async getSigningKey(keyId) {
    const cached = this.cache.get('jwks');
    const now = Date.now();
    
    // Check cache validity
    if (cached && cached.expires > now) {
      return cached.keys.find(k => k.kid === keyId);
    }
    
    // Fetch fresh JWKS
    const response = await fetch(this.jwksUrl);
    const jwks = await response.json();
    
    // Update cache
    this.cache.set('jwks', {
      keys: jwks.keys,
      expires: now + this.cacheExpiry
    });
    
    return jwks.keys.find(k => k.kid === keyId);
  }
  
  async verifyToken(token) {
    const decoded = jwt.decode(token, { complete: true });
    const key = await this.getSigningKey(decoded.header.kid);
    
    if (!key) {
      throw new Error('Signing key not found');
    }
    
    return jwt.verify(token, key.x5c[0]);
  }
}
```

## Error Handling Patterns

### Comprehensive Error Handling

```javascript
// Comprehensive error handling for ScotAccount flows
async function handleScotAccountError(error, context) {
  // Log for debugging (remove sensitive data)
  console.error(`ScotAccount ${context} error:`, {
    code: error.code,
    message: error.message,
    timestamp: new Date().toISOString()
  });
  
  switch (error.code) {
    case 'access_denied':
      // User cancelled or denied consent
      return redirectToConsent();
    
    case 'invalid_request':
      // Malformed request - check parameters
      return handleConfigurationError(error);
    
    case 'invalid_client':
      // Authentication failed - check keys
      return handleAuthenticationError(error);
    
    case 'temporarily_unavailable':
      // Service issue - retry with backoff
      return scheduleRetry(context, error);
    
    case 'verification_pending':
      // GPG45 verification in progress
      return handlePendingVerification(error);
    
    default:
      // Unknown error - fail safely
      return handleUnknownError(error);
  }
}
```

## State Management

### Extended State Storage

```javascript
// Extend state storage to support 7-day validity
const stateExpiry = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// Store state with extended expiry
const stateData = {
  codeVerifier: pkceVerifier,
  nonce: nonceValue,
  scopes: requestedScopes,
  createdAt: Date.now(),
  expiresAt: Date.now() + stateExpiry
};

await redis.setex(
  `auth:state:${stateParam}`,
  Math.floor(stateExpiry / 1000), // Redis expects seconds
  JSON.stringify(stateData)
);
```

### Session-Based Attribute Access

```javascript
// Request attributes during active user session only
async function getVerifiedAttributes(activeSession) {
  // Check if user session is still valid
  if (!activeSession || activeSession.expiresAt < Date.now()) {
    throw new SessionExpiredError('User must re-authenticate for attribute access');
  }
  
  try {
    // Use current access token immediately
    const attributes = await scotAccountClient.fetchAttributes({
      accessToken: activeSession.accessToken,
      disClientAssertion: generateDISClientAssertion()
    });
    
    // Process and return attributes immediately
    return processVerifiedAttributes(attributes);
  } catch (error) {
    if (error.status === 401) {
      // Token expired - need fresh authentication
      throw new ReauthenticationRequired();
    }
    throw error;
  }
}
```

## Verification Status Handling

### Pending Verification

```javascript
// Handle verification pending status gracefully
app.get('/auth/callback', async (req, res) => {
  if (req.query.error === 'verification_pending') {
    // Show user-friendly status page
    return res.render('verification-in-progress', {
      message: 'Your identity verification is being processed.',
      estimatedTime: '24-48 hours',
      supportContact: 'help@yourservice.gov.scot',
      statusCheckUrl: `/verification/status/${req.query.state}`
    });
  }
  
  if (req.query.error === 'verification_failed') {
    // Handle failed verification
    return res.render('verification-failed', {
      message: 'Unable to verify your identity at this time.',
      retryUrl: '/verification/start',
      alternativeOptions: getAlternativeVerificationMethods()
    });
  }
  
  // Continue with successful authentication
  // ...
});
```

## Logout Implementation

### Storing ID Token for Logout

```javascript
// Store ID token during authentication for later logout
app.post('/auth/token-exchange', async (req, res) => {
  const tokenResponse = await exchangeCodeForTokens(req.body.code);
  
  // Store ID token in session for logout
  req.session.userAuth = {
    userId: tokenResponse.idToken.sub,
    sessionId: tokenResponse.idToken.sid,
    accessToken: tokenResponse.access_token,
    idToken: tokenResponse.id_token, // Store for logout
    expiresAt: Date.now() + (tokenResponse.expires_in * 1000)
  };
  
  res.redirect('/dashboard');
});

// Use stored ID token for logout
app.get('/logout', (req, res) => {
  const idToken = req.session.userAuth?.idToken;
  
  // Clear local session
  req.session.destroy();
  
  // Redirect to ScotAccount logout
  const logoutUrl = new URL('https://authz.integration.scotaccount.service.gov.scot/authorize/logout');
  logoutUrl.searchParams.set('id_token_hint', idToken);
  logoutUrl.searchParams.set('post_logout_redirect_uri', 'https://yourservice.gov.scot/goodbye');
  
  res.redirect(logoutUrl.toString());
});
```

## Token Expiry Management

### Handle Short Token Lifetimes

```javascript
// Handle token expiry gracefully
class ScotAccountSession {
  constructor(tokenData) {
    this.accessToken = tokenData.access_token;
    this.refreshToken = tokenData.refresh_token;
    this.idToken = tokenData.id_token;
    this.expiresAt = Date.now() + (tokenData.expires_in * 1000);
    this.sessionExpiresAt = Date.now() + (4 * 60 * 60 * 1000); // 4-hour session
  }
  
  isTokenValid() {
    return Date.now() < this.expiresAt - 30000; // 30 second buffer
  }
  
  isSessionValid() {
    return Date.now() < this.sessionExpiresAt;
  }
  
  async refreshIfNeeded() {
    if (!this.isTokenValid() && this.refreshToken) {
      // Attempt refresh
      const newTokens = await refreshTokens(this.refreshToken);
      this.accessToken = newTokens.access_token;
      this.expiresAt = Date.now() + (newTokens.expires_in * 1000);
      
      // Note: Refresh tokens also expire after 15 minutes
      if (newTokens.refresh_token) {
        this.refreshToken = newTokens.refresh_token;
      }
    }
  }
  
  requiresReauthentication() {
    return !this.isSessionValid();
  }
}
```

## HTTP Request Examples

### Token Exchange with DIS-Client-Assertion

```javascript
const response = await fetch(tokenEndpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'DIS-Client-Assertion': clientAssertionJwt // Required by ScotAccount
  },
  body: new URLSearchParams({
    grant_type: 'authorisation_code',
    code: authorisationCode,
    redirect_uri: redirectUri,
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: clientAssertionJwt,
    code_verifier: codeVerifier
  })
});
```

### JWT Assertion Structure

```javascript
const clientAssertion = {
  iss: clientId,
  sub: clientId,
  aud: tokenEndpoint,
  jti: crypto.randomUUID(),
  exp: Math.floor(Date.now() / 1000) + 300, // 5 minutes
  iat: Math.floor(Date.now() / 1000)
};
```

### State Storage Pattern

```javascript
// Store when initiating authentication
await stateStore.set(stateValue, {
  codeVerifier: pkceVerifier,
  nonce: nonceValue,
  initiatedAt: Date.now(),
  expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
});

// Retrieve when handling callback
const stateData = await stateStore.get(receivedState);
if (!stateData) {
  throw new Error('Invalid or expired state parameter');
}

// Validate state hasn't expired
if (stateData.expiresAt < Date.now()) {
  await stateStore.delete(receivedState);
  throw new Error('Authentication state has expired');
}

// Use state data for token exchange
const tokens = await exchangeCodeForTokens({
  code: authorisationCode,
  codeVerifier: stateData.codeVerifier
});

// Clean up used state
await stateStore.delete(receivedState);
```