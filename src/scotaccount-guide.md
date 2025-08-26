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
  "authorization_endpoint": "https://authz.integration.scotaccount.service.gov.scot/authorize",
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
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "subject_types_supported": ["pairwise"],
  "id_token_signing_alg_values_supported": ["RS256"],
  "token_endpoint_auth_methods_supported": ["private_key_jwt"],
  "token_endpoint_auth_signing_alg_values_supported": ["RS256", "ES256"],
  "claims_supported": ["sub", "iss", "aud", "exp", "iat", "nonce", "sid"]
}
```

**Key configuration values**:

- `authorization_endpoint` - Where to send authentication requests
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
- **response_type**: Always `code` for the authorization code flow
- **scope**: Space-separated list of requested permissions
- **state**: Random value for CSRF protection
- **nonce**: Random value for replay protection
- **code_challenge**: SHA256 hash of your code verifier, base64url encoded
- **code_challenge_method**: Always `S256` for SHA256

<div class="callout callout--info">
<strong>Implementation needed?</strong> See the <a href="{{ '/integration-examples/' | url }}#authorization-request-builder">Authorization Request Builder</a> example for code implementation.
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

1. Extract the authorization code and state parameter
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

Exchange authorization code for tokens:

**Token Endpoint URL:**

```
https://authz.integration.scotaccount.service.gov.scot/token
```

**Token Exchange Request Example:**

```http
POST /token HTTP/1.1
Host: authz.integration.scotaccount.service.gov.scot
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
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
          "organization": "ScotAccount",
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
          "organization": "ScotAccount",
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
