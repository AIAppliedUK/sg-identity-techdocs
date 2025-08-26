---
layout: base.njk
title: "Integration Examples and Best Practices"
description: "Practical integration examples and solutions for ScotAccount implementation challenges"
eleventyNavigation:
  key: integration-examples
  order: 9
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

- `authorization_endpoint` - Where to send authentication requests
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

  // Store state and nonce for validation
  storeSecurely(state, { nonce, codeVerifier: pkce.codeVerifier });

  return `${config.authorization_endpoint}?${params.toString()}`;
}
```

### Callback Handler

Process the authentication response:

```javascript
function handleCallback(req) {
  const { code, state, error } = req.query;

  // Handle errors first
  if (error) {
    throw new Error(`Authentication failed: ${error}`);
  }

  // Validate state parameter
  const storedData = retrieveSecurely(state);
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
    exp: now + 60 * 60 * 24 * 30 * 6, // 6 months expiration
    iat: now,
    jti: crypto.randomUUID(),
  };

  return jwt.sign(payload, privateKey, { algorithm: "RS256" });
}
```

### Token Exchange

Exchange authorization code for tokens:

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
      grant_type: "authorization_code",
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

### ID Token Validation

Validate and extract user information:

```javascript
async function validateIdToken(idToken, clientId, config, expectedNonce) {
  // Get public keys
  const jwks = await fetch(config.jwks_uri).then((r) => r.json());

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

Request verified attributes using access token:

```javascript
async function requestVerifiedAttributes(accessToken, clientAssertion) {
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
    throw new Error(`Attribute request failed: ${response.status}`);
  }

  return await response.json();
}
```

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

  switch (error.message) {
    case "access_denied":
      res.redirect("/auth/cancelled");
      break;
    case "invalid_request":
      res.status(400).render("error", {
        message: "Invalid authentication request",
      });
      break;
    default:
      res.status(500).render("error", {
        message: "Authentication service temporarily unavailable",
      });
  }
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

    // Store user session
    req.session.user = userInfo;

    res.redirect("/dashboard");
  } catch (error) {
    handleAuthError(error, res);
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

```javascript
// Secure session implementation example
class SecureSession {
  constructor(sessionData) {
    this.userId = sessionData.userId;
    this.sessionId = sessionData.sessionId;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
    this.expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
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
