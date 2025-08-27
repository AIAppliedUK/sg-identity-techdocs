---
layout: base.njk
title: "Token Validation Examples"
description: "Example implementations for validating ID tokens and access tokens from ScotAccount"
eleventyNavigation:
  key: token-validation-examples
  order: 9
---

<div class="callout callout--warning">
<strong>Example Code Disclaimer</strong>: The code examples in this guide are for educational and reference purposes only. They are not production-ready implementations and should be thoroughly reviewed, tested, and adapted to meet your specific security requirements before use in any live system.
</div>

This guide provides example implementations for validating ID tokens and access tokens from ScotAccount. These examples demonstrate proper validation patterns but must be adapted and secured for your specific use case.

[[toc]]

## Security Overview

ScotAccount issues JSON Web Tokens (JWTs) that must be validated before trusting their contents. This ensures tokens haven't been tampered with and were genuinely issued by ScotAccount.

<div class="callout callout--error">
<strong>Security Note</strong>: These examples show validation patterns that should be implemented. Never trust token contents without proper validation. Always verify signatures and claims in your production implementation.
</div>

### What You Must Validate

1. **Token signature** - Verify the token was signed by ScotAccount
2. **Issuer claim** - Confirm the token was issued by ScotAccount
3. **Audience claim** - Ensure the token is intended for your service
4. **Expiration** - Check the token hasn't expired
5. **Nonce** - Prevent replay attacks (for ID tokens)

## ID Token Validation

ID tokens contain user identity information and must be validated immediately after receiving them from the token endpoint.

### ID Token Structure

**Example ID Token Payload** (after validation):

```json
{
  "sub": "4f6893f4-6fbe-423e-a5cc-d3c93e5a7c41",
  "aud": "your-client-id",
  "iss": "https://authz.integration.scotaccount.service.gov.scot",
  "exp": 1678932662,
  "iat": 1678931762,
  "nonce": "BdHLDWPRmY8WBYN6BEtFfI2RVoJmyCRppGFIt2hGy7A",
  "jti": "fP_X_2w65iU",
  "sid": "yxZ2VpOnydV0CT8j1SblfztRYDrkq-SJ3OH7ejF7GQg"
}
```

**Key Claims Explained**:

- `sub` - **Persistent user identifier** (UUID that never changes)
- `aud` - **Your client ID** (ensures token is for your service)
- `iss` - **ScotAccount issuer** (confirms who issued the token)
- `exp` - **Expiration time** (Unix timestamp)
- `iat` - **Issued at time** (Unix timestamp)
- `nonce` - **Replay protection** (must match your original nonce)
- `jti` - **Unique token ID** (prevents duplicate tokens)
- `sid` - **Session ID** (required for logout)

### Example Validation Implementation

#### Step 1: Set Up JWKS Client

```javascript
const jwksClient = require("jwks-rsa");
const jwt = require("jsonwebtoken");

// Create JWKS client for public key retrieval
const client = jwksClient({
  jwksUri: "https://authz.integration.scotaccount.service.gov.scot/jwks.json",
  cache: true,
  cacheMaxAge: 600000, // Cache keys for 10 minutes
  rateLimit: true,
  jwksRequestsPerMinute: 5,
});
```

#### Step 2: Implement Validation Function

```javascript
async function validateIdToken(
  idToken,
  expectedClientId,
  expectedNonce,
  expectedIssuer
) {
  try {
    // 1. Decode token to get header information
    const decodedToken = jwt.decode(idToken, { complete: true });
    if (!decodedToken || !decodedToken.header.kid) {
      throw new Error("Invalid token format or missing key ID");
    }

    // 2. Get the public key from ScotAccount
    const key = await client.getSigningKey(decodedToken.header.kid);
    const publicKey = key.getPublicKey();

    // 3. Verify signature and standard claims
    const payload = jwt.verify(idToken, publicKey, {
      issuer: expectedIssuer,
      audience: expectedClientId,
      algorithms: ["RS256"],
      clockTolerance: 5, // Allow 5 seconds for clock skew
    });

    // 4. Additional security validations
    validateSecurityClaims(payload, expectedNonce);

    return payload;
  } catch (error) {
    console.error("Token validation failed:", error.message);
    throw new Error(`Invalid ID token: ${error.message}`);
  }
}
```

#### Step 3: Additional Security Validations

```javascript
function validateSecurityClaims(payload, expectedNonce) {
  // Validate nonce to prevent replay attacks
  if (!payload.nonce || payload.nonce !== expectedNonce) {
    throw new Error("Invalid or missing nonce - possible replay attack");
  }

  // Ensure required claims are present
  if (!payload.sub) {
    throw new Error("Missing subject (sub) claim");
  }

  if (!payload.sid) {
    throw new Error("Missing session ID (sid) claim");
  }

  // Validate token age (additional security measure)
  const now = Math.floor(Date.now() / 1000);
  const tokenAge = now - payload.iat;

  if (tokenAge > 900) {
    // 15 minutes
    throw new Error("Token is too old");
  }
}
```

#### Step 4: Extract and Store User Information

```javascript
function extractUserInfo(validatedPayload) {
  return {
    userId: validatedPayload.sub,
    sessionId: validatedPayload.sid,
    authenticatedAt: new Date(validatedPayload.iat * 1000),
    expiresAt: new Date(validatedPayload.exp * 1000),
    tokenId: validatedPayload.jti,
  };
}

// Usage in your application
async function handleTokenValidation(idToken, expectedNonce, clientId) {
  try {
    const issuer = "https://authz.integration.scotaccount.service.gov.scot";
    const payload = await validateIdToken(
      idToken,
      clientId,
      expectedNonce,
      issuer
    );
    const userInfo = extractUserInfo(payload);

    // Store in session or database
    return userInfo;
  } catch (error) {
    // Handle validation errors appropriately
    throw error;
  }
}
```

## Verified Attributes Validation

Verified attributes are provided by the attributes endpoint as a signed `claimsToken` JWT that includes a `verified_claims` array. Validate the JWT and extract claims for the scopes you requested.

<div class="callout callout--info">
<strong>Full Schema Reference</strong>: For the complete JSON schema definition of the verified claims structure returned from the attributes endpoint, see the <a href="{{ '/scotaccount-currentschema/' | url }}">ScotAccount Service Schema</a> documentation.
</div>

### Identity (GPG45 Medium) extraction (from claimsToken)

```javascript
function extractIdentityFromClaimsToken(claimsTokenPayload) {
  if (!Array.isArray(claimsTokenPayload.verified_claims)) return null;
  const entry = claimsTokenPayload.verified_claims.find(
    (e) => e.scope === "scotaccount.gpg45.medium"
  );
  if (!entry || !entry.claims) return null;
  const { given_name, family_name, birth_date } = entry.claims;
  if (!given_name || !family_name || !birth_date) return null;
  return {
    givenName: given_name,
    familyName: family_name,
    birthDate: birth_date,
  };
}
```

### Address extraction (from claimsToken)

```javascript
function extractAddressFromClaimsToken(claimsTokenPayload) {
  if (!Array.isArray(claimsTokenPayload.verified_claims)) return null;
  const entry = claimsTokenPayload.verified_claims.find(
    (e) => e.scope === "scotaccount.address"
  );
  if (!entry || !entry.claims || !entry.claims.address) return null;
  const { building_number, street_name, postal_code, address_locality } =
    entry.claims.address;
  return {
    buildingNumber: building_number,
    streetName: street_name,
    postalCode: postal_code,
    locality: address_locality,
  };
}
```

## Access Token Usage

Use the access token (15 minutes) to call `GET https://issuer.main.integration.scotaccount.service.gov.scot/attributes/values` with a `DIS-Client-Assertion` whose audience is the attributes URL.

## Example Express.js Integration

Here's an example showing how validation might be integrated into an Express.js application:

```javascript
const express = require("express");
const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");

const app = express();

// JWKS client setup
const client = jwksClient({
  jwksUri: "https://authz.integration.scotaccount.service.gov.scot/jwks.json",
  cache: true,
  cacheMaxAge: 600000,
});

// Validation middleware
async function validateScotAccountToken(req, res, next) {
  try {
    const { idToken, nonce } = req.session.authData;
    const clientId = process.env.SCOTACCOUNT_CLIENT_ID;
    const issuer = "https://authz.integration.scotaccount.service.gov.scot";

    // Validate the ID token
    const payload = await validateIdToken(idToken, clientId, nonce, issuer);

    // Extract user information
    req.user = {
      id: payload.sub,
      sessionId: payload.sid,
    };

    next();
  } catch (error) {
    console.error("Token validation failed:", error);
    res.status(401).json({ error: "Invalid authentication" });
  }
}

// Protected route example
app.get("/api/user", validateScotAccountToken, (req, res) => {
  res.json({
    user: req.user,
    message: "Successfully authenticated with ScotAccount",
  });
});
```

## Error Handling

### Common Validation Errors

**Invalid Signature**:

```javascript
// Token has been tampered with or not from ScotAccount
if (error.name === "JsonWebTokenError") {
  console.error("Token signature invalid");
  // Redirect to login
}
```

**Expired Token**:

```javascript
// Token has expired (normal after 15 minutes)
if (error.name === "TokenExpiredError") {
  console.log("Token expired, refresh needed");
  // Attempt token refresh or redirect to login
}
```

**Wrong Audience**:

```javascript
// Token not intended for your service
if (error.message.includes("audience")) {
  console.error("Token audience mismatch");
  // This is a serious security issue
}
```

### Example Security Patterns

These examples demonstrate security patterns you should implement:

1. **Token validation** before trusting contents
2. **JWKS key rotation** handling with cache refresh
3. **State persistence** with 7-day expiration
4. **DIS-Client-Assertion** creation for attributes endpoint
5. **Mock service integration** for testing environments
6. **Comprehensive error handling** for all failure scenarios
7. **Token refresh** handling in your application
8. **Validation failure logging** for monitoring
9. **Rate limiting** on validation endpoints
10. **Public key caching** with refresh logic
11. **Clock skew handling** with tolerance
12. **Custom claim validation** for verified attributes

## Testing Token Validation

### Unit Test Example

```javascript
const assert = require("assert");

describe("Token Validation", () => {
  beforeEach(() => {
    // Reset mocks and clear Redis
    redis.flushall();
  });
  
  it("should reject tokens with invalid signatures", async () => {
    const invalidToken = "invalid.jwt.token";

    try {
      await validateIdToken(invalidToken, "client-id", "nonce", "issuer");
      assert.fail("Should have thrown error");
    } catch (error) {
      assert(error.message.includes("Invalid"));
    }
  });
  
  it("should handle DIS-Client-Assertion creation", () => {
    const clientId = 'test-client';
    const privateKey = getTestPrivateKey();
    
    const assertion = createDisClientAssertion(clientId, privateKey);
    const decoded = jwt.decode(assertion, { complete: true });
    
    expect(decoded.payload.iss).toBe(clientId);
    expect(decoded.payload.sub).toBe(clientId);
    expect(decoded.payload.aud).toBe(
      'https://issuer.main.integration.scotaccount.service.gov.scot/attributes/values'
    );
    expect(decoded.header.alg).toBe('RS256');
  });

  it("should validate correct nonce", async () => {
    const validToken = "valid.jwt.token";
    const correctNonce = "expected-nonce";

    const payload = await validateIdToken(
      validToken,
      "client-id",
      correctNonce,
      "issuer"
    );
    assert.equal(payload.nonce, correctNonce);
  });
});
```

## Logout Implementation with Token Validation

Example logout flow with proper token handling:

```javascript
// Logout requires id_token_hint for ScotAccount
async function initiateLogout(req, res, idToken) {
  try {
    const config = await getOidcConfiguration();
    const logoutState = crypto.randomBytes(16).toString('hex');
    
    // Store logout state for validation
    await redis.setex(`logout_state:${logoutState}`, 300, JSON.stringify({
      timestamp: Date.now(),
      userId: req.user?.id
    })); // 5 minutes
    
    // Build logout URL with id_token_hint
    const logoutUrl = `${config.end_session_endpoint}?` +
      `id_token_hint=${idToken}&` +
      `post_logout_redirect_uri=${encodeURIComponent(req.protocol + '://' + req.get('host') + '/auth/logout-callback')}&` +
      `state=${logoutState}`;
    
    res.redirect(logoutUrl);
  } catch (error) {
    console.error('Logout initiation failed:', error);
    // Fallback: destroy local session
    req.session.destroy();
    res.redirect('/');
  }
}

// Handle logout callback
async function handleLogoutCallback(req, res) {
  const { state } = req.query;
  
  try {
    if (!state) {
      throw new Error('Missing logout state parameter');
    }
    
    // Validate logout state
    const stateDataJson = await redis.get(`logout_state:${state}`);
    const stateData = stateDataJson ? JSON.parse(stateDataJson) : null;
    
    if (!stateData) {
      throw new Error('Invalid or expired logout state');
    }
    
    // Clean up state
    await redis.del(`logout_state:${state}`);
    
    // Log successful logout
    console.log(`User ${stateData.userId} successfully logged out`);
    
  } catch (error) {
    console.warn('Logout callback validation failed:', error.message);
    // Continue with logout anyway
  }
  
  // Always destroy local session
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction failed:', err);
    }
    res.redirect('/logged-out');
  });
}
```

## Implementation Considerations

### Performance Optimisation Examples

These examples show performance patterns you might implement:

```javascript
// Optimised JWKS client with intelligent caching
const optimisedJwksClient = jwksClient({
  jwksUri: "https://authz.integration.scotaccount.service.gov.scot/jwks.json",
  cache: true,
  cacheMaxAge: 600000, // 10 minutes
  cacheMaxEntries: 5, // Limit memory usage
  rateLimit: true,
  jwksRequestsPerMinute: 10, // Allow more requests for high traffic
  timeout: 30000, // 30 second timeout
  proxy: process.env.HTTP_PROXY, // Support corporate proxies
});

// Connection pooling for attributes requests
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000,
  freeSocketTimeout: 30000
});

// Batch token validation for multiple tokens
async function validateTokensBatch(tokens, clientId, issuer) {
  const validationPromises = tokens.map(tokenData => 
    validateIdToken(
      tokenData.token, 
      clientId, 
      tokenData.nonce, 
      issuer
    ).catch(error => ({ error, token: tokenData.token }))
  );
  
  const results = await Promise.allSettled(validationPromises);
  
  return results.map((result, index) => ({
    token: tokens[index].token,
    success: result.status === 'fulfilled' && !result.value.error,
    payload: result.status === 'fulfilled' ? result.value : null,
    error: result.status === 'rejected' ? result.reason : result.value?.error
  }));
}
```

- **JWKS key caching** with appropriate TTL
- **Connection pooling** for HTTP requests
- **Asynchronous validation** to avoid blocking
- **Token validation libraries** for your platform
- **Batch processing** for multiple token validations
- **Memory management** for JWKS cache
- **Request timeouts** and retry logic

### Monitoring Examples

Example monitoring patterns for your implementation:

```javascript
// Comprehensive monitoring for token validation
class TokenValidationMonitoring {
  static logValidationEvent(event, details = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event: event,
      userId: details.userId,
      sessionId: details.sessionId,
      tokenId: details.tokenId,
      clientId: details.clientId,
      userAgent: details.userAgent,
      ipAddress: details.ipAddress,
      environment: process.env.NODE_ENV
    };
    
    console.log(JSON.stringify(logEntry));
    
    // Send to monitoring system
    this.sendToMonitoring(logEntry);
  }
  
  static alertSecurityEvent(event, details) {
    const alert = {
      severity: 'HIGH',
      event: event,
      timestamp: new Date().toISOString(),
      details: details
    };
    
    console.error('SECURITY ALERT:', JSON.stringify(alert));
    
    // Send immediate alert to security team
    this.sendSecurityAlert(alert);
  }
  
  static trackMetric(metric, value, tags = {}) {
    // Track validation performance metrics
    metrics.increment(`scotaccount.validation.${metric}`, value, {
      environment: process.env.NODE_ENV,
      ...tags
    });
  }
}

// Usage examples throughout validation process
TokenValidationMonitoring.logValidationEvent('token_validation_started', {
  userId: 'unknown',
  tokenId: decodedToken?.jti
});

TokenValidationMonitoring.trackMetric('validation_success', 1, {
  token_type: 'id_token'
});

TokenValidationMonitoring.alertSecurityEvent('audience_mismatch', {
  expected: expectedClientId,
  received: payload.aud
});
```

- **Validation failure tracking** and pattern investigation
- **Token expiration monitoring** to detect issues
- **Signature validation alerts** for potential attacks
- **Validation event logging** for audit purposes
- **JWKS refresh frequency** monitoring
- **State persistence cleanup** monitoring
- **Authentication flow completion rates**

## Next Steps

<div class="callout callout--success">
<strong>Ready to implement?</strong> Review the <a href="{{ '/architecture/' | url }}">Architecture Overview</a> to understand the complete system design.
</div>

<div class="callout callout--info">
<strong>Need more examples?</strong> See the <a href="{{ '/integration-examples/' | url }}">Integration Examples</a> for additional implementation patterns.
</div>

<div class="callout callout--warning">
<strong>Production deployment?</strong> Contact the ScotAccount team for security review and production deployment guidance before going live.
</div>
