---
layout: base.njk
title: "Token Validation Examples"
description: "Example implementations for validating ID tokens and access tokens from ScotAccount"
eleventyNavigation:
  key: token-validation-examples
  order: 8
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
2. **Token refresh** handling in your application
3. **Validation failure logging** for monitoring
4. **Rate limiting** on validation endpoints
5. **Public key caching** with refresh logic
6. **Clock skew handling** with tolerance
7. **Custom claim validation** for verified attributes

## Testing Token Validation

### Unit Test Example

```javascript
const assert = require("assert");

describe("Token Validation", () => {
  it("should reject tokens with invalid signatures", async () => {
    const invalidToken = "invalid.jwt.token";

    try {
      await validateIdToken(invalidToken, "client-id", "nonce", "issuer");
      assert.fail("Should have thrown error");
    } catch (error) {
      assert(error.message.includes("Invalid"));
    }
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

## Implementation Considerations

### Performance Optimisation Examples

These examples show performance patterns you might implement:

- **JWKS key caching** with appropriate TTL
- **Connection pooling** for HTTP requests
- **Asynchronous validation** to avoid blocking
- **Token validation libraries** for your platform

### Monitoring Examples

Example monitoring patterns for your implementation:

- **Validation failure tracking** and pattern investigation
- **Token expiration monitoring** to detect issues
- **Signature validation alerts** for potential attacks
- **Validation event logging** for audit purposes

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
