---
layout: base.njk
title: "Implementation Guide"
description: "Technical guide for implementing ScotAccount authentication and verified attributes"
eleventyNavigation:
  key: implementation-guide
  order: 4
---

This guide provides technical implementation instructions for integrating with ScotAccount. Follow these steps to build secure authentication with optional verified attributes.

## Implementation Overview

ScotAccount integration follows a four-phase approach:

1. **Setup & Registration** - Generate keys and register your service
2. **Basic Authentication** - Implement OpenID Connect authentication flow
3. **Verified Attributes** - Add identity, address, and email verification
4. **Production Deployment** - Go live with monitoring and security measuresr

## Phase 1: Setup & Registration

### Generate Cryptographic Keys

**EC Key Pair**:

```bash
# Generate EC private key
openssl ecparam -genkey -name prime256v1 -out ec_private_key.pem

# Extract public key
openssl ec -in ec_private_key.pem -pubout -out ec_public_key.pem
```

### Secure Key Storage

Store private keys securely using a secrets manager. You dont have to use keyvault or secrets manager but it must not be in your application codebase:

**AWS Secrets Manager**:

```bash
aws secretsmanager create-secret \
  --name "scotaccount/private-key" \
  --secret-string file://private_key.pem
```

**Azure Key Vault**:

```bash
az keyvault secret set \
  --vault-name "your-keyvault" \
  --name "scotaccount-private-key" \
  --file private_key.pem
```

### Service Registration

Submit these details to the ScotAccount team:

**Required Information**:

- **Service name** and description
- **Public key** (from generated key pair)
- **Redirect URIs** (where users return after authentication)
- **Post-logout redirect URIs** (where users go after logout)
- **Required scopes** (see scope reference below)
- **Production IP addresses** (To secure token ex)
- **Technical contact** details

**Scope Reference**:

- `openid` - Required for all integrations
- `scotaccount.gpg45.medium` - Verified identity (GPG45 Medium)
- `scotaccount.address` - Verified postal address
- `scotaccount.email` - Verified email address
- `scotaccount.mobile` - Verified mobile number

### Registration Response

You'll receive:

- **Client ID** - Your unique service identifier
- **Configuration URLs** - Integration and production endpoints
- **Testing credentials** - For development environment access

## Phase 2: Basic Authentication

![ScotAccount High-Level Architecture]({{ '/assets/diagrams/auth-flow.png' | url }})

_Figure: Illustration of authentication flow._

### Discovery Endpoint Integration

Always retrieve current configuration dynamically from the discovery endpoint:

**Discovery Endpoint URL:**

```
https://authz.integration.scotaccount.service.gov.scot/.well-known/openid-configuration
```

**Example Discovery Response:**

```json
{
  "issuer": "https://authz.integration.scotaccount.service.gov.scot",
  "authorisation_endpoint": "https://authz.integration.scotaccount.service.gov.scot/authorize",
  "token_endpoint": "https://authz.integration.scotaccount.service.gov.scot/token",
  "jwks_uri": "https://authz.integration.scotaccount.service.gov.scot/jwks.json",
  "registration_endpoint": "https://authz.integration.scotaccount.service.gov.scot/register",
  "scopes_supported": [
    "openid",
    "scotaccount.email",
    "scotaccount.gpg45.medium",
    "scotaccount.address"
  ],
  "response_types_supported": ["code"],
  "response_modes_supported": ["query"],
  "grant_types_supported": ["authorisation_code", "refresh_token"],
  "subject_types_supported": ["pairwise"],
  "id_token_signing_alg_values_supported": ["RS256"],
  "token_endpoint_auth_methods_supported": ["private_key_jwt"],
  "token_endpoint_auth_signing_alg_values_supported": ["RS256", "ES256"],
  "claims_supported": ["sub", "iss", "aud", "exp", "iat", "nonce", "sid"]
}
```

**Key configuration values**:

- `authorisation_endpoint` - Where to send authentication requests
- `token_endpoint` - Where to exchange codes for tokens
- `jwks_uri` - Public keys for token validation

<div class="callout callout--info">
<strong>Implementation needed?</strong> See the <a href="{{ '/integration-examples/' | url }}#discovery-endpoint-integration">Discovery Endpoint Integration</a> example for code implementation.
</div>

### PKCE Implementation

Generate PKCE parameters for security. Your application must create:

- **Code verifier**: Random string between 43-128 characters (e.g., `dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk`)
- **Code challenge**: SHA256 hash of the verifier, base64url encoded (e.g., `E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM`)
- **Code challenge method**: Always `S256`

<div class="callout callout--info">
<strong>Implementation needed?</strong> See the <a href="{{ '/integration-examples/' | url }}#pkce-implementation">PKCE Implementation</a> example for code implementation.
</div>

### Authorization Request

Build the authentication URL with all required parameters:

**Authorization Endpoint URL:**

```
https://authz.integration.scotaccount.service.gov.scot/authorize
```

**Complete Authorization Request Example:**

```
GET https://authz.integration.scotaccount.service.gov.scot/authorize?
    client_id=your-client-id&
    redirect_uri=https://yourservice.gov.scot/auth/callback&
    response_type=code&
    scope=openid&
    state=af0ifjsldkj-unique-state-value&
    nonce=n-0S6_WzA2Mj-unique-nonce-value&
    code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&
    code_challenge_method=S256
```

Each parameter serves a specific purpose:

- **client_id**: Your unique identifier assigned during registration
- **redirect_uri**: Where ScotAccount sends users after authentication
- **response_type**: Always `code` for the authorisation code flow
- **scope**: Space-separated list of requested permissions
- **state**: Random value for CSRF protection (⚠️ MUST be persisted - authentication flows remain valid for 7 days)
- **nonce**: Random value for replay protection
- **code_challenge**: SHA256 hash of your code verifier, base64url encoded
- **code_challenge_method**: Always `S256` for SHA256

<div class="callout callout--warning">
<strong>⚠️ Critical: 7-Day Authentication Flow Validity</strong><br>
Authentication flows remain valid for 7 days - you MUST persist state parameters and PKCE verifiers securely. Users may begin authentication and return days later to complete it. Your application must handle this extended validity period.
</div>

<div class="callout callout--info">
<strong>Implementation needed?</strong> See the <a href="{{ '/integration-examples/' | url }}#authorisation-request-builder">Authorization Request Builder</a> example for code implementation.
</div>

### Callback Handler

Process the authentication response from ScotAccount:

**Example Callback URL:**

```
https://yourservice.gov.scot/auth/callback?
    code=SplxlOBeZQQYbYS6WxSbIA&
    state=af0ifjsldkj
```

Your application must:

1. Extract the authorisation code and state parameter
2. Validate the state parameter matches your stored value
3. Handle any error responses appropriately

<div class="callout callout--info">
<strong>Implementation needed?</strong> See the <a href="{{ '/integration-examples/' | url }}#callback-handler">Callback Handler</a> example for code implementation.
</div>

### JWT Client Assertion

Create signed JWT for token exchange to prove your service's identity:

**Client Assertion JWT Payload Example:**

```json
{
  "iss": "your-client-id",
  "sub": "your-client-id",
  "aud": "https://authz.integration.scotaccount.service.gov.scot/token",
  "exp": 1757847083,
  "iat": 1741953083,
  "jti": "239a5659-0533-4faa-ba97-8f6ee057843f"
}
```

**Signed JWT Example:**

```
eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI2b3ZmeHRqYWl2bHB5Iiw...
```

<div class="callout callout--info">
<strong>Implementation needed?</strong> See the <a href="{{ '/integration-examples/' | url }}#jwt-client-assertion">JWT Client Assertion</a> example for code implementation.
</div>

### Token Exchange

Exchange authorisation code for tokens:

**Token Endpoint URL:**

```
https://authz.integration.scotaccount.service.gov.scot/token
```

**Token Exchange Request Example:**

```http
POST /token HTTP/1.1
Host: authz.integration.scotaccount.service.gov.scot
Content-Type: application/x-www-form-urlencoded

grant_type=authorisation_code&
code=SplxlOBeZQQYbYS6WxSbIA&
redirect_uri=https://yourservice.gov.scot/auth/callback&
client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer&
client_assertion=eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI2b3ZmeHRq...&
code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
```

**Success Response Example:**

```json
{
  "access_token": "eyJraWQiOiJXZ2lHIiwidHlwIjoiYXQrand0IiwiYWxnIjoiUlMyNTYifQ...",
  "refresh_token": "eyJlbmMiOiJBMTI4Q0JDLUhTMjU2IiwiYWxnIjoiZGlyIn0...",
  "id_token": "eyJraWQiOiJXZ2lHIiwiYWxnIjoiUlMyNTYifQ...",
  "token_type": "Bearer",
  "expires_in": 900,
  "scope": "openid"
}
```

<div class="callout callout--info">
<strong>Implementation needed?</strong> See the <a href="{{ '/integration-examples/' | url }}#token-exchange">Token Exchange</a> example for code implementation.
</div>

### ID Token Validation

Validate and extract user information from the ID token:

**Example ID Token (Encoded):**

```
eyJraWQiOiJXZ2lHIiwiYWxnIjoiUlMyNTYifQ.eyJzdWIiOiI0ZjY4OTNmNC02ZmJlLTQyM2UtYTVjYy1kM2M5M2U1YTdjNDEiLCJhdWQiOiI1eWh5Z2tzY3R3cHFnIiwiaXNzIjoiaHR0cHM6Ly9hdXRoei5pbnRlZ3JhdGlvbi5zY290YWNjb3VudC5zZXJ2aWNlLmdvdi5zY290IiwiZXhwIjoxNjc4OTMyNjYyLCJpYXQiOjE2Nzg5MzE3NjIsIm5vbmNlIjoiQmRITERXUFJtWThXQllONkJFdEZmSTJSVm9KbXlDUnBwR0ZJdDJoR3k3QSIsImp0aSI6ImZQX1hfMnc2NWlVIiwic2lkIjoieXhaMlZwT255ZFYwQ1Q4ajFTYmxmenRSWURya3EtU0ozT0g3ZWpGN0dRZyJ9.db79iKccqKkXF4MF2IThOV05AZHrlvmNZWAW5ojUzyQoKzHSlPtCEeC3sqwsah84gHMqU0A9ACWPbE8SECdpzOvL6QVCfoWjwuiMEzMsOZvCHccMEpeNX8rbB7_L5Mo5lLOpVl80jIezKNQJ8NMQoOgMGaBm5qkgLTVFuYqVnvpzAEb44xDeSYe7__jaXOUBiGIWMqopeqJRmR1cy5yJ9ShqDa_xoBVmAxXXXv0ZOanE7E7-LCBApdvFNRA-JUUrjMIYUNn8cSkupye6bjLElLT_qPKJc6N0mSOhH43oU5GB-heMhNX18p-07J5pFFAHotcP6VsA2mE7y96gLQ1XrA
```

**Decoded Header:**

```json
{
  "kid": "WgiG",
  "alg": "RS256"
}
```

**Decoded Payload:**

```json
{
  "sub": "4f6893f4-6fbe-423e-a5cc-d3c93e5a7c41",
  "aud": "5yhygksctwpqg",
  "iss": "https://authz.integration.scotaccount.service.gov.scot",
  "exp": 1678932662,
  "iat": 1678931762,
  "nonce": "BdHLDWPRmY8WBYN6BEtFfI2RVoJmyCRppGFIt2hGy7A",
  "jti": "fP_X_2w65iU",
  "sid": "yxZ2VpOnydV0CT8j1SblfztRYDrkq-SJ3OH7ejF7GQg"
}
```

Your application must validate:

- JWT signature using ScotAccount's public keys
- Token expiration time
- Issuer matches ScotAccount's identifier
- Audience matches your client ID
- Nonce matches your original request

<div class="callout callout--info">
<strong>Implementation needed?</strong> See the <a href="{{ '/integration-examples/' | url }}#id-token-validation">ID Token Validation</a> example for code implementation.
</div>

## Phase 3: Verified Attributes

### Requesting Additional Scopes

To access verified attributes, request additional scopes in a new authorisation flow when required:

**Authorization Request with Additional Scopes:**

```
https://authz.integration.scotaccount.service.gov.scot/authorize?
    client_id=your-client-id&
    redirect_uri=https://yourservice.gov.scot/auth/callback&
    response_type=code&
    scope=openid%20scotaccount.email%20scotaccount.address%20scotaccount.gpg45.medium&
    state=your-state&
    nonce=your-nonce&
    code_challenge=your-code-challenge&
    code_challenge_method=S256
```

After exchanging the code for an access token, request attributes:

**Attribute Request:**

```http
GET https://issuer.main.integration.scotaccount.service.gov.scot/attributes/values
Authorization: Bearer eyJraWQiOiJXZ2lHIiwidHlwIjoiYXQrand0Iiw...
DIS-Client-Assertion: eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI2b3ZmeHRq...
```

**Attribute Response Example:**

```json
{
  "claimsToken": "eyJraWQiOiJkTVZEIiwiYWxnIjoiUlMyNTYifQ..."
}
```

**Decoded Claims Token Structure:**

```json
{
  "iss": "https://issuer.main.integration.scotaccount.service.gov.scot",
  "sub": "4f6893f4-6fbe-423e-a5cc-d3c93e5a7c41",
  "iat": 1678931762,
  "verified_claims": [
    {
      "scope": "scotaccount.gpg45.medium",
      "verification": {
        "outcome": "VERIFIED_SUCCESSFULLY",
        "trust_framework": "uk_tfida",
        "assurance_policy": "GPG_45",
        "confidence_level": "medium",
        "time": "2024-03-15T14:30:00Z",
        "verifier": {
          "organisation": "ScotAccount",
          "txn": "a4dbe877-df63-4608-95b0-3a7fe3a4d751"
        }
      },
      "claims": {
        "given_name": "John",
        "family_name": "Smith",
        "birth_date": "1990-05-15"
      }
    },
    {
      "scope": "scotaccount.address",
      "verification": {
        "outcome": "VERIFIED_SUCCESSFULLY",
        "trust_framework": "uk_tfida",
        "validation_method": "credit_reference_agency",
        "time": "2024-03-15T14:30:00Z",
        "verifier": {
          "organisation": "ScotAccount",
          "txn": "b5ece988-eg74-5719-a6c1-4b8gf4b5e862"
        }
      },
      "claims": {
        "address": {
          "building_number": "123",
          "street_name": "High Street",
          "postal_code": "EH1 1AA",
          "address_locality": "Edinburgh"
        }
      }
    }
  ]
}
```

<div class="callout callout--info">
<strong>Implementation needed?</strong> See the <a href="{{ '/integration-examples/' | url }}#phase-3-verified-attributes-examples">Verified Attributes Examples</a> for code implementation.
</div>

## Common Pitfalls and Critical Considerations

Understanding these common implementation mistakes will save significant development time and prevent production issues.

### 1. State Persistence Requirements

<div class="callout callout--danger">
<strong>Critical:</strong> You must persist state for at least 7 days to support cross-device verification flows.
</div>

**The Problem**: Many developers implement state storage with short expiry times (e.g., 1 hour session timeout), not realising that GPG45 verification can take days to complete.

**Why This Matters**: Users may start identity verification on desktop but need to complete document upload on mobile. If your state expires, users lose their progress and must restart verification.

**Correct Implementation**:

See the [State Expiry Issues example]({{ '/integration-examples/#state-expiry-issues' | url }}) for proper session management patterns that support 7-day verification flows.

**Reference**: [Testing Guide - Cross-Device Scenarios]({{ '/testing-guide/' | url }}#cross-device-testing)

### 2. GPG45 Cross-Device Flow Assumptions

<div class="callout callout--warning">
<strong>Warning:</strong> Never assume verification completes immediately or on the same device.
</div>

**The Problem**: Developers often design flows expecting users to complete verification in a single session on one device.

**Reality**: GPG45 Medium verification frequently requires:
- Document photo capture (better on mobile)
- Liveness detection (requires mobile camera)
- Address verification (may need time to gather documents)
- Credit reference checks (can take hours to process)

**Design Patterns for Cross-Device Support**:

See the [Cross-Device Flow Support example]({{ '/integration-examples/#cross-device-flow-support' | url }}) for implementing resumable verification flows.

**Reference**: [Architecture Overview - Cross-Device Flows]({{ '/architecture/' | url }}#cross-device-support)

### 3. Long-Lived Attribute Token Misconceptions

<div class="callout callout--danger">
<strong>Critical:</strong> ScotAccount does NOT provide long-lived attribute tokens. While user sessions last 4 hours, access tokens expire after 15 minutes.
</div>

**The Problem**: Developers assume they can store attribute access tokens for later use, similar to some API services.

**Reality**: 
- User sessions last up to 4 hours
- Access tokens expire after 15 minutes
- Access tokens expire with the session
- No refresh tokens are provided for attribute access
- Attributes must be requested while user is present and consents

**Correct Approach - Request Attributes When Needed**:

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
  
  try {
    const attributes = await scotAccountClient.fetchAttributes(
      currentSession.accessToken
    );
    
    // Store the attribute values, not the token
    await database.saveUserData({
      userId: currentSession.userId,
      verifiedName: attributes.given_name + ' ' + attributes.family_name,
      verifiedDOB: attributes.birth_date,
      verifiedEmail: attributes.email,
      verificationTimestamp: Date.now()
    });
    
    return attributes;
  } catch (error) {
    if (error.code === 401) {
      // Token expired - user must re-authenticate
      throw new Error('Session expired. Please log in again.');
    }
    throw error;
  }
}
```

**Reference**: [Complete Guide - Token Lifecycle]({{ '/scotaccount-complete-guide/' | url }}#token-lifecycle)

### 4. Missing DIS-Client-Assertion Header

<div class="callout callout--danger">
<strong>Critical:</strong> The DIS-Client-Assertion header is mandatory for all attribute requests.
</div>

**The Problem**: Developers successfully implement authentication but forget the additional client assertion header required for attribute requests.

**Symptom**: Authentication works, but attribute requests return 401 Unauthorized errors.

**Solution**:

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
    jti: generateUniqueId() // Prevent replay attacks
  };
  
  // Sign with your private key (same key used for token endpoint)
  return jwt.sign(payload, PRIVATE_KEY, { 
    algorithm: 'ES256',
    keyid: KEY_ID // Your key identifier
  });
}

// Use in attribute requests
const attributeResponse = await fetch(ATTRIBUTES_ENDPOINT, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'DIS-Client-Assertion': generateDISClientAssertion(), // Required!
    'Content-Type': 'application/json'
  }
});
```

**Reference**: [Complete Guide - DIS-Client-Assertion]({{ '/scotaccount-complete-guide/' | url }}#dis-client-assertion)

### 5. JWKS Refresh Failures

<div class="callout callout--warning">
<strong>Warning:</strong> Always fetch fresh JWKS before starting new authentication flows.
</div>

**The Problem**: Developers cache JWKS indefinitely or assume keys never change, causing token validation failures when ScotAccount rotates keys.

**Impact**: Suddenly all token validations fail when keys rotate, breaking authentication for all users.

**Robust JWKS Handling**:

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
    
    // Always fetch fresh JWKS if cache expired or key not found
    if (!cached || cached.expiresAt < now || !cached.keys[keyId]) {
      console.log('Refreshing JWKS cache...');
      await this.refreshJWKS();
    }
    
    const jwks = this.cache.get('jwks');
    if (!jwks.keys[keyId]) {
      // Try one more refresh in case keys rotated recently
      await this.refreshJWKS();
      const freshJwks = this.cache.get('jwks');
      if (!freshJwks.keys[keyId]) {
        throw new Error(`Signing key ${keyId} not found in JWKS`);
      }
      return freshJwks.keys[keyId];
    }
    
    return jwks.keys[keyId];
  }
  
  async refreshJWKS() {
    try {
      const response = await fetch(this.jwksUrl);
      const jwksData = await response.json();
      
      // Index keys by kid for fast lookup
      const keyMap = {};
      jwksData.keys.forEach(key => {
        keyMap[key.kid] = key;
      });
      
      this.cache.set('jwks', {
        keys: keyMap,
        expiresAt: Date.now() + this.cacheExpiry
      });
      
    } catch (error) {
      console.error('Failed to refresh JWKS:', error);
      throw new Error('Unable to fetch signing keys');
    }
  }
  
  // Force refresh - call before starting new auth flows
  async forceRefresh() {
    this.cache.delete('jwks');
    await this.refreshJWKS();
  }
}

// Use before starting auth flows
const jwksManager = new JWKSManager();

app.get('/auth/start', async (req, res) => {
  // Ensure we have fresh keys before starting auth
  await jwksManager.forceRefresh();
  
  // Proceed with auth flow
  const authUrl = buildAuthUrl(req.session.state);
  res.redirect(authUrl);
});
```

**Reference**: [Complete Guide - JWKS Management]({{ '/scotaccount-complete-guide/' | url }}#jwks-management)

### 6. Error Handling Best Practices

**Always Handle ScotAccount-Specific Error Patterns**:

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
    case 'session_expired':
      // 4-hour session limit reached
      return redirect('/login?reason=session_expired');
      
    case 'verification_pending':
      // User verification still in progress
      return showPendingStatus(error.resumeUrl);
      
    case 'insufficient_verification':
      // User didn't complete GPG45 verification
      return showVerificationRequired();
      
    case 'invalid_scope':
      // Configuration error - alert developers
      await alertDevelopmentTeam('Invalid scope configuration', error);
      return showConfigurationError();
      
    default:
      // See error reference for complete list
      return showGenericError();
  }
}
```

**Reference**: [Error Reference - Complete Error Codes]({{ '/error-reference/' | url }}) and [Testing Guide - Error Scenarios]({{ '/testing-guide/' | url }}#error-testing)

### Quick Prevention Checklist

Before deploying to production, verify:

- [ ] State persistence configured for 7+ days
- [ ] Cross-device user experience designed and tested
- [ ] No long-lived attribute token storage
- [ ] DIS-Client-Assertion header implemented for attribute requests
- [ ] JWKS refresh logic implemented with force refresh before auth
- [ ] Comprehensive error handling for all ScotAccount error codes
- [ ] Session timeout warnings displayed to users
- [ ] Graceful handling of verification pending states

**Reference**: [Testing Guide - Pre-Production Checklist]({{ '/testing-guide/' | url }}#production-checklist)

## Troubleshooting Guide

### "Why is my state parameter invalid after a few days?"

**Issue**: Your application is rejecting valid state parameters from users returning after several days.

**Root Cause**: ScotAccount authentication flows remain valid for **7 days**, but many applications only store state parameters for short periods (1-4 hours).

**Solution**:
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

await stateStore.set(stateValue, stateData, stateExpiry);
```

**Prevention**: Always design state storage to support the full 7-day authentication flow validity period.

### "Why can't I get long-lived tokens for attributes?"

**Issue**: Your application expects to store access tokens for later attribute retrieval, but tokens expire quickly.

**Root Cause**: ScotAccount implements a **"per-flow" token model** - there are no long-lived tokens for attribute access.

**Key Facts**:
- Access tokens expire after **15 minutes**
- Refresh tokens also expire after **15 minutes**
- ScotAccount sessions last **4 hours**
- Access tokens expire after **15 minutes**
- Attributes must be requested while the user is present and has an active session

**Solution**:
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
      clientAssertion: generateDISAssertion()
    });
    
    // Store the attribute values (not the token)
    await database.saveVerifiedData({
      userId: activeSession.userId,
      attributes: attributes.verified_claims,
      retrievedAt: Date.now(),
      verificationTransactions: extractTransactionIds(attributes)
    });
    
    return attributes;
  } catch (error) {
    if (error.status === 401) {
      throw new SessionExpiredError('Access token expired - user must re-authenticate');
    }
    throw error;
  }
}
```

**Prevention**: Design your application to request and store attribute **values**, not access tokens.

### "Why is my GPG45 verification taking so long?"

**Issue**: Users report that identity verification is "stuck" or takes unexpectedly long.

**Root Cause**: GPG45 Medium verification is a **user-driven process** that can take days or weeks to complete.

**Reality of GPG45 Verification**:
- Document capture may require specific lighting/angle conditions
- Liveness detection can fail multiple times requiring retries
- Address verification may need additional documentation from users
- Credit reference checks can take 24-48 hours to process
- Users often start on desktop but need mobile for document capture
- Verification can span multiple sessions across different devices

**Solution - Design for Extended Timelines**:
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
    return res.render('verification-failed', {
      message: 'Identity verification was not successful.',
      retryUrl: `/verify/retry/${req.query.state}`,
      supportGuidance: 'Please ensure documents are clear and well-lit.'
    });
  }
  
  // Handle successful verification
  // ...
});

// Provide status checking endpoint
app.get('/verification/status/:state', async (req, res) => {
  const stateData = await stateStore.get(req.params.state);
  
  if (!stateData) {
    return res.redirect('/verification/expired');
  }
  
  // Check if verification completed since last check
  const authUrl = buildResumeAuthUrl(req.params.state);
  
  res.render('verification-status', {
    continueUrl: authUrl,
    estimatedTime: calculateEstimatedCompletion(stateData.createdAt),
    tips: [
      'Ensure good lighting when taking document photos',
      'Use a mobile device for better document capture',
      'Have proof of address documents ready if required'
    ]
  });
});
```

**Prevention**: Set user expectations early that verification can take 24-48 hours and may require multiple attempts.

### "Why does my logout not work?"

**Issue**: Users are not properly logged out from ScotAccount when they log out from your application.

**Root Cause**: ScotAccount logout requires the **`id_token_hint`** parameter to identify the user session.

**Common Mistakes**:
- Not including `id_token_hint` parameter
- Using access token instead of ID token
- Not storing ID token during initial authentication

**Solution**:
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
    expiresAt: Date.now() + (4 * 60 * 60 * 1000) // 4-hour session
  };
  
  res.redirect('/dashboard');
});

// Implement proper logout with id_token_hint
app.post('/logout', async (req, res) => {
  const userAuth = req.session.userAuth;
  
  if (!userAuth || !userAuth.idToken) {
    // Local logout only if no ScotAccount session info
    req.session.destroy();
    return res.redirect('/logged-out');
  }
  
  // Build ScotAccount logout URL with required parameters
  const logoutUrl = new URL(scotAccountConfig.logoutEndpoint);
  logoutUrl.searchParams.set('id_token_hint', userAuth.idToken);
  logoutUrl.searchParams.set('post_logout_redirect_uri', 
    `${process.env.BASE_URL}/logout-complete`);
  logoutUrl.searchParams.set('state', generateSecureState());
  
  // Clear local session
  req.session.destroy();
  
  // Redirect to ScotAccount logout
  res.redirect(logoutUrl.toString());
});

// Handle post-logout callback
app.get('/logout-complete', (req, res) => {
  res.render('logout-success', {
    message: 'You have been successfully logged out of ScotAccount.'
  });
});
```

**Prevention**: Always store the ID token during authentication and include `id_token_hint` in logout requests.

### "Why are my tokens expiring so quickly?"

**Issue**: Your application experiences frequent authentication failures due to expired tokens.

**Root Cause**: ScotAccount uses **short-lived tokens** (15 minutes) by design for security.

**ScotAccount Token Lifetimes**:
- **Access tokens**: 15 minutes (non-renewable)
- **Refresh tokens**: 15 minutes (non-renewable)
- **ID tokens**: 15 minutes (for reference only)
- **Authorization codes**: Short-lived and single-use (exact lifetime pending confirmation from ScotAccount team)

This is **intentional security design** - tokens are not meant to be long-lived.

**Solution - Design for Short Token Lifetimes**:
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
    return Date.now() < this.expiresAt;
  }
  
  isSessionValid() {
    return Date.now() < this.sessionExpiresAt;
  }
  
  async refreshIfNeeded() {
    if (this.isTokenValid()) {
      return true; // Token still valid
    }
    
    if (!this.isSessionValid()) {
      throw new SessionExpiredError('4-hour session expired - user must re-authenticate');
    }
    
    try {
      // Try to refresh token
      const refreshedTokens = await this.refresh();
      this.updateTokens(refreshedTokens);
      return true;
    } catch (error) {
      if (error.code === 'invalid_grant') {
        throw new SessionExpiredError('Session expired - user must re-authenticate');
      }
      throw error;
    }
  }
}

// Use session management in API calls
async function makeScotAccountRequest(endpoint, session) {
  // Check if we need to refresh tokens
  await session.refreshIfNeeded();
  
  const response = await fetch(endpoint, {
    headers: {
      'Authorization': `Bearer ${session.accessToken}`,
      'DIS-Client-Assertion': generateClientAssertion()
    }
  });
  
  if (response.status === 401) {
    // Token expired despite refresh - session is done
    throw new SessionExpiredError('Authentication expired - please log in again');
  }
  
  return response;
}
```

**Prevention**: Design your application around 15-minute token lifetimes and 4-hour session limits. Never assume tokens will last longer.

## Implementation Checklist

### Pre-Development Setup

**Cryptographic Requirements**:
- [ ] **Generated EC P-256 or RSA key pair** using OpenSSL or equivalent
- [ ] **Stored private key securely** in secrets manager (AWS Secrets Manager, Azure Key Vault, etc.)
- [ ] **Public key extracted** and ready for registration submission
- [ ] **Key rotation strategy** planned for production

**Registration and Access**:
- [ ] **Obtained client_id** from ScotAccount team after registration
- [ ] **Received integration environment access** credentials
- [ ] **Confirmed redirect URIs** are registered and match your application
- [ ] **Confirmed post-logout redirect URIs** are registered
- [ ] **Identified required scopes** based on your application needs
- [ ] **Production IP addresses** provided to ScotAccount team for security

**Development Environment**:
- [ ] **Set up test environment** with HTTPS capability
- [ ] **Configured mock service access** for automated testing
- [ ] **Demo RP access** confirmed for manual testing
- [ ] **Local HTTPS setup** completed (required for redirect URIs)

### Development Implementation

**Core Authentication Flow**:
- [ ] **Implemented PKCE flow** with SHA256 code challenge generation
- [ ] **Added discovery endpoint integration** to fetch current configuration
- [ ] **Built authorization request** with all required parameters
- [ ] **Implemented callback handler** with state validation
- [ ] **Created JWT client assertion** signing with your private key
- [ ] **Implemented token exchange** with proper error handling
- [ ] **Added ID token validation** including signature verification

**State and Session Management**:
- [ ] **Added 7-day state persistence** using database or cache
- [ ] **Implemented session management** with 4-hour timeout
- [ ] **Added PKCE verifier storage** linked to state parameters
- [ ] **Implemented state cleanup** for expired authentication flows
- [ ] **Added cross-device support** for resumable authentication flows

**Advanced Features**:
- [ ] **Implemented JWKS rotation handling** with force refresh capability
- [ ] **Added DIS-Client-Assertion header** for all attribute requests
- [ ] **Implemented dual-flow pattern** for verified attributes
- [ ] **Added logout functionality** with id_token_hint parameter
- [ ] **Created attribute validation** and secure storage

**Error Handling and Resilience**:
- [ ] **Added comprehensive error handling** for all ScotAccount error codes
- [ ] **Implemented graceful token expiry handling** with user messaging
- [ ] **Added verification pending status** handling for GPG45 flows
- [ ] **Created session timeout warnings** for users
- [ ] **Added retry logic** for transient failures

### Testing and Validation

**Mock Service Testing**:
- [ ] **Tested basic authentication flow** using mock service
- [ ] **Verified PKCE implementation** works correctly
- [ ] **Tested state parameter handling** across multiple requests
- [ ] **Validated token parsing** and user data extraction
- [ ] **Tested error scenarios** using mock service error responses

**Integration Environment Testing**:
- [ ] **Tested with Demo RP** for manual flow verification
- [ ] **Completed full authentication flow** with real user interaction
- [ ] **Tested GPG45 verification flow** end-to-end
- [ ] **Validated cross-device scenarios** with mobile document capture
- [ ] **Tested logout functionality** with proper cleanup

**Error Scenario Testing**:
- [ ] **Handled all error scenarios** from error reference documentation
- [ ] **Tested expired state handling** after extended periods
- [ ] **Validated token expiry handling** with appropriate user messaging
- [ ] **Tested network failure scenarios** with retry logic
- [ ] **Verified verification pending status** handling

**Security and Performance Testing**:
- [ ] **Tested cross-device GPG45 flow** with different browsers/devices
- [ ] **Validated JWKS key rotation** handling with forced refresh
- [ ] **Tested concurrent user sessions** for scalability
- [ ] **Performed security review** of token handling and storage
- [ ] **Validated HTTPS enforcement** across all endpoints

### Production Deployment

**Environment Configuration**:
- [ ] **Updated all endpoints** to production URLs
- [ ] **Confirmed production IP addresses** are whitelisted
- [ ] **Switched to production discovery endpoint** for configuration
- [ ] **Updated JWKS endpoint** to production URL
- [ ] **Configured production secrets manager** access

**Monitoring and Logging**:
- [ ] **Implemented monitoring** for authentication success/failure rates
- [ ] **Added logging** for all authentication events (without sensitive data)
- [ ] **Set up alerts** for high error rates or system failures
- [ ] **Configured performance monitoring** for authentication latency
- [ ] **Added audit logging** for verified attribute access

**Security and Compliance**:
- [ ] **Tested with production credentials** in staging environment
- [ ] **Completed security penetration testing** of authentication flows
- [ ] **Reviewed all error messages** to ensure no sensitive data exposure
- [ ] **Validated GDPR compliance** for user data handling
- [ ] **Documented data retention policies** for verified attributes

**User Experience**:
- [ ] **Added user-friendly error messages** for all failure scenarios
- [ ] **Implemented progress indicators** for long-running verification
- [ ] **Created help documentation** for common user issues
- [ ] **Added session timeout warnings** with extend session options
- [ ] **Tested accessibility** of authentication flow interfaces

### Post-Deployment Validation

**Operational Readiness**:
- [ ] **Verified production authentication flow** with test users
- [ ] **Confirmed monitoring and alerting** are working correctly
- [ ] **Tested incident response procedures** for authentication failures
- [ ] **Validated backup and recovery** procedures for key material
- [ ] **Documented operational runbook** for common issues

**Ongoing Maintenance**:
- [ ] **Scheduled regular JWKS refresh** verification
- [ ] **Planned key rotation procedures** for ongoing security
- [ ] **Set up regular security reviews** of authentication implementation
- [ ] **Established process** for ScotAccount service updates
- [ ] **Created user feedback channels** for authentication issues

## Production Readiness Assessment

**Before moving to production, validate all checklist items above are complete. Pay particular attention to:**

- **State persistence** must support 7-day authentication flows
- **Token lifecycle** handling must account for 15-minute expiry times
- **Cross-device flows** must work seamlessly for GPG45 verification
- **Error handling** must cover all ScotAccount-specific error scenarios
- **Security** implementation must follow all private_key_jwt requirements

**Critical Success Criteria**:
1. Mock service integration tests pass consistently
2. Demo RP manual testing completes successfully
3. All error scenarios handled gracefully with user-friendly messages
4. Cross-device GPG45 verification tested and working
5. Production endpoints configured and tested in staging

## Phase 4: Production Deployment

### Environment Configuration

Update endpoints for production:

**Production Discovery Endpoint:**

```
https://authz.scotaccount.service.gov.scot/.well-known/openid-configuration
```

**Production Attribute Endpoint:**

```
https://issuer.main.scotaccount.service.gov.scot/attributes/values
```

<div class="callout callout--info">
<strong>Implementation needed?</strong> See the <a href="{{ '/integration-examples/' | url }}#environment-configuration">Environment Configuration</a> example for code implementation.
</div>

### Monitoring and Logging

Implement comprehensive monitoring for authentication events and metrics.

<div class="callout callout--info">
<strong>Implementation needed?</strong> See the <a href="{{ '/integration-examples/' | url }}#monitoring-and-logging">Monitoring and Logging</a> example for code implementation.
</div>

### Error Handling

Implement user-friendly error handling for various authentication scenarios.

<div class="callout callout--info">
<strong>Implementation needed?</strong> See the <a href="{{ '/integration-examples/' | url }}#error-handling">Error Handling</a> example for code implementation.
</div>

### Security Checklist

Before going live, verify:

- [ ] **Private keys** stored securely in secrets manager
- [ ] **HTTPS only** - no HTTP endpoints in production
- [ ] **State validation** implemented for CSRF protection
- [ ] **Nonce validation** prevents replay attacks
- [ ] **Token expiration** handled correctly
- [ ] **Session management** implemented securely
- [ ] **Error logging** without exposing sensitive data
- [ ] **Rate limiting** on authentication endpoints
- [ ] **Monitoring** and alerting configured

## Complete Example Implementation

For a complete working example, see the comprehensive Node.js/Express implementation.

<div class="callout callout--info">
<strong>Implementation needed?</strong> See the <a href="{{ '/integration-examples/' | url }}#complete-example-implementation">Complete Example Implementation</a> for a full working example.
</div>

## ScotAccount-Specific OIDC Implementation

ScotAccount implements OpenID Connect with several critical requirements that differ from standard OIDC implementations. Understanding these specifics is essential for successful integration.

### DIS-Client-Assertion Header Requirement

**⚠️ CRITICAL**: ScotAccount requires a custom `DIS-Client-Assertion` header in addition to standard client authentication.

When making requests to the token endpoint, you MUST include:
- Standard `client_assertion` in the request body
- Custom `DIS-Client-Assertion` header with the same JWT value

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
    client_id: clientId,
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: clientAssertionJwt,
    code_verifier: codeVerifier
  })
});
```

### Dual-Flow Requirement for Verified Attributes

ScotAccount enforces strict separation between authentication and verified attribute retrieval:

1. **Authentication Flow**: Returns only the persistent user UUID (sub claim)
2. **Attribute Flow**: Requires separate API call with valid access token

**Important**: There are no long-lived attribute tokens. Access tokens expire after 15 minutes and refresh tokens also have a 15-minute validity period.

### private_key_jwt Authentication Method

ScotAccount exclusively uses the `private_key_jwt` authentication method. This means:

- You MUST generate and securely store EC or RSA key pairs
- Client secrets are NOT supported
- Every token request requires a signed JWT assertion

**JWT Assertion Requirements**:
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

### Token Lifecycle Considerations

**Critical Timing Information**:
- **Authentication flows**: Valid for 7 days (requires persistent state storage)
- **ScotAccount sessions**: 4-hour timeout
- **Access tokens**: 15-minute validity
- **Refresh tokens**: 15-minute validity
- **Authorisation codes**: 10-minute validity, single-use only

### State Persistence Requirements

Due to the 7-day validity of authentication flows, your application MUST:

1. Persist state parameters in a database or cache
2. Persist PKCE code verifiers alongside state
3. Implement cleanup for expired state data
4. Handle users returning days after initiating authentication

**Example State Storage**:
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
if (!stateData || Date.now() > stateData.expiresAt) {
  throw new Error('Invalid or expired state');
}
```

### No Implicit or Hybrid Flows

ScotAccount supports ONLY the authorisation code flow with PKCE. The following are NOT supported:
- Implicit flow
- Hybrid flow
- Resource Owner Password Credentials flow
- Client Credentials flow

### Verification Metadata

When retrieving verified attributes, each claim includes comprehensive verification metadata:

```json
{
  "verification": {
    "outcome": "VERIFIED_SUCCESSFULLY",
    "trust_framework": "uk_tfida",
    "confidence_level": "medium",
    "validation_method": "credit_reference_agency",
    "time": "2024-03-15T14:30:00Z",
    "verifier": {
      "organisation": "ScotAccount",
      "txn": "unique-transaction-id"
    }
  }
}
```

Your application should:
- Check the `outcome` field before trusting claims
- Store the `txn` for audit purposes
- Consider the `confidence_level` for risk assessment

## Troubleshooting Common Issues

### Invalid Client Assertion

**Symptom**: `invalid_client` error during token exchange
**Solution**: Check JWT claims, expiration time, and private key format

### State Parameter Mismatch

**Symptom**: CSRF protection errors
**Solution**: Ensure state is generated, stored, and validated correctly

### Token Validation Failures

**Symptom**: JWT verification errors
**Solution**: Verify audience, issuer, and nonce claims match expected values

### PKCE Errors

**Symptom**: `invalid_grant` errors
**Solution**: Ensure code verifier and challenge are generated and used correctly

## Support and Next Steps

<div class="callout callout--success">
<strong>Implementation complete?</strong> Review the <a href="{{ '/scotaccount-token-validation-module/' | url }}">Token Validation Module</a> for advanced security patterns.
</div>

<div class="callout callout--info">
<strong>Need architecture details?</strong> See the <a href="{{ '/architecture/' | url }}">Architecture Overview</a> for system components and data flows.
</div>

<div class="callout callout--warning">
<strong>Ready for production?</strong> Contact the ScotAccount team for production onboarding and security review.
</div>
