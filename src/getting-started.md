---
layout: base.njk
title: "Getting Started with ScotAccount"
description: "Quick start guide for developers integrating with ScotAccount"
eleventyNavigation:
  key: getting-started
  order: 2
---

Get up and running with ScotAccount quickly. This guide covers the essential steps to integrate ScotAccount into your application.

## Quick Test Connectivity

Before diving into integration, verify you can connect to ScotAccount services:

```bash
# Simple connectivity test - should return JSON configuration
curl -X GET https://authz.integration.scotaccount.service.gov.scot/.well-known/openid-configuration
```

<div class="callout callout--success">
<strong>Quick Testing Available!</strong> Use our <strong>Mock Service</strong> for immediate testing without user interaction:
<ul>
<li><strong>Mock Service URL</strong>: https://mock-dis.main.integration.scotaccount.service.gov.scot/v2/</li>
<li><strong>Demo RP</strong>: https://oidc-private-client.integration.scotaccount.service.gov.scot/integration</li>
<li>See the <a href="{{ '/testing-guide/' | url }}">Testing Guide</a> for complete mock service documentation</li>
</ul>
</div>

## Testing Environments

ScotAccount provides multiple testing environments to support your development:

| Environment | Purpose | URL |
|-------------|---------|-----|
| **Mock Service** | Automated testing without UI | `https://mock-dis.main.integration.scotaccount.service.gov.scot/v2/` |
| **Integration** | Full integration testing | `https://authz.integration.scotaccount.service.gov.scot` |
| **Demo RP** | Manual testing interface | `https://oidc-private-client.integration.scotaccount.service.gov.scot/integration` |

## Prerequisites

Before you begin, ensure you have:

- **Development environment** set up with HTTPS capability
- **EC P-256 key pair** Elliptic Curve keys generated using OpenSSL
- **Basic understanding** of OpenID Connect
- **Access to ScotAccount** Mock and Integration environment

<div class="callout callout--info">
<strong>Need help with key generation?</strong> See our <a href="{{ '/scotaccount-complete-guide/#key-generation' | url }}">complete key generation guide</a> for step-by-step instructions.
</div>

## Quick Start Checklist

### Phase 1: Setup & Registration

Before you begin, ensure you have completed the following configuration and preparation steps.

1. **Generate key pair** - Create EC P-256 keys
2. **Stored private key securely** - Use a secrets manager (AWS Secrets Manager, Azure Key Vault) or suitable alternative
3. **Determine required scopes** - Basic authentication or verified attributes
4. **Define redirect URIs** - Set up callback URLs for your service
5. **Submit registration** - Provide details and public key the to ScotAccount team
6. **Receive client_id** - Get your unique client identifier

### Phase 2: Basic Authentication

The first step in your implementation is to get the authentication flow working. This will prove connectivity and your applications ability to send requests to the ScotAccount service and handle the redirects to enable the user to complete the login steps necessary to complete authentication.

<div class="callout callout--success">
<strong>Start with Mock Service</strong> - Before implementing the full flow, test your integration using the Mock Service which bypasses user interaction and validates your basic implementation without security complexity.
</div>

1. **Test with Mock Service** - Verify basic flow using automated testing service
2. **Implement discovery endpoint** - Retrieve current configuration automatically
3. **Build PKCE parameters** - Generate code verifier and challenge
4. **Create authorisation request** - Build secure authentication URL
5. **Implement callback handler** - Process authentication response
6. **Build JWT client assertion** - Use your private key for token requests
7. **Complete token exchange** - Get access and ID tokens
8. **Validate ID tokens** - Extract and verify user identity

### Phase 3: Verified Attributes (Optional)

1. **Choose additional scopes** - Select identity, address, or email verification
2. **Handle attribute requests** - Manage user consent flow
3. **Process attribute responses** - Parse verified claims data
4. **Validate and store data** - Implement secure data handling

### Phase 4: Production Deployment

1. **Update to production endpoints** - Switch from integration to live URLs
2. **Implement monitoring** - Add logging and error tracking
3. **Add error handling** - Create user-friendly error messages
4. **Complete security review** - Recommended: Run penetration testing

## Core Authentication Flow

![ScotAccount High-Level Architecture]({{ '/assets/diagrams/auth-flow.png' | url }})

_Figure: Illustration of authentication flow._

The ScotAccount authentication process follows these key steps:

Before you begin, retrieve the current configuration to ensure you have the latest url's scopes etc. This provides all endpoint URLs and supported features. Ensure your application leverages

```http
GET https://authz.integration.scotaccount.service.gov.scot/.well-known/openid-configuration
```

### 1. User attempts to login

User accesses your service and you determine the user needs to authenticate using ScotAccount.

### 2 & 3 Generate Security Parameters

During the first call to scotaccount, your application is responsible for implementing the PKCE client data and security required to succesfully implement an OIDC client.

Your application must generate:

- **Code verifier** - Random string for PKCE security
- **Code challenge** - SHA256 hash of the verifier
- **State parameter** - Unique value to prevent CSRF attacks
- **Nonce** - Random value for replay protection

### 4, 5 & 6 Redirect to ScotAccount

Build the authorisation URL and redirect users to ScotAccount using a redirect like the one shown below

```
https://authz.integration.scotaccount.service.gov.scot/authorize?
    client_id=your-client-id&
    redirect_uri=https://yourservice.gov.scot/auth/callback&
    response_type=code&
    scope=openid&
    state=your-state-value&
    nonce=your-nonce-value&
    code_challenge=your-code-challenge&
    code_challenge_method=S256
```

### 6 & 7. Handle Callback

The user will then authenticate at ScotAccount and return to your callback URL using a redirect we send to the users browser

```
https://yourservice.gov.scot/auth/callback?
    code=authorisation-code&
    state=your-state-value
```

**Critical**: Always validate the state parameter matches your original value.

### 5. Exchange Code for Tokens

Once you receive this callback you then must create a JWT client assertion and exchange the authorisation code:

```http
POST https://authz.integration.scotaccount.service.gov.scot/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorisation_code&
code=authorisation-code&
redirect_uri=https://yourservice.gov.scot/auth/callback&
client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer&
client_assertion=your-jwt-assertion&
code_verifier=your-code-verifier
```

### 6. Validate and Use Tokens

Extract user information from the ID token:

```json
{
  "sub": "4f6893f4-6fbe-423e-a5cc-d3c93e5a7c41",
  "aud": "your-client-id",
  "iss": "https://authz.integration.scotaccount.service.gov.scot",
  "nonce": "your-nonce-value",
  "sid": "session-id-for-logout"
}
```

The `sub` claim contains the user's persistent UUID identifier.

## Key Security Requirements

### PKCE (Proof Key for Code Exchange)

- **Always required** for all authorisation requests
- Protects against authorisation code interception attacks
- Must use SHA256 method (`S256`)

### State Parameter Validation

- **Generate unique state** for each authorisation request
- **Validate on callback** - reject if missing or incorrect
- **Store securely** during the authentication flow

### JWT Client Assertions

- **Use your private key** to sign assertions
- **Include required claims**: `iss`, `sub`, `aud`, `exp`, `iat`, `jti`
- **Set short expiration** (recommended: 60 seconds)

### ID Token Validation

- **Verify signature** using ScotAccount's public keys
- **Check audience** matches your `client_id`
- **Validate issuer** matches ScotAccount's URL
- **Confirm nonce** matches your original value

## Common Integration Patterns

### Session Management

See the [Session Management examples]({{ '/integration-examples/#example-session-management' | url }}) for secure session storage patterns.

### Logout Implementation

See the [Logout Implementation example]({{ '/integration-examples/#logout-implementation' | url }}) for handling user logout.

## Quick Reference Card

### Endpoints

**Integration Environment**:
- **Discovery**: `https://authz.integration.scotaccount.service.gov.scot/.well-known/openid-configuration`
- **Authorization**: `https://authz.integration.scotaccount.service.gov.scot/authorize`
- **Token**: `https://authz.integration.scotaccount.service.gov.scot/token`
- **Attributes**: `https://issuer.main.integration.scotaccount.service.gov.scot/attributes/values`
- **Logout**: `https://authz.integration.scotaccount.service.gov.scot/authorize/logout`
- **JWKS**: `https://authz.integration.scotaccount.service.gov.scot/jwks.json`

**Production Environment**:
- **Discovery**: `https://authz.scotaccount.service.gov.scot/.well-known/openid-configuration`
- **Authorization**: `https://authz.scotaccount.service.gov.scot/authorize`
- **Token**: `https://authz.scotaccount.service.gov.scot/token`
- **Attributes**: `https://issuer.main.scotaccount.service.gov.scot/attributes/values`
- **Logout**: `https://authz.scotaccount.service.gov.scot/authorize/logout`
- **JWKS**: `https://authz.scotaccount.service.gov.scot/jwks.json`

**Testing Services**:
- **Mock Service**: `https://mock-dis.main.integration.scotaccount.service.gov.scot/v2/`
- **Demo RP**: `https://oidc-private-client.integration.scotaccount.service.gov.scot/integration`

### Required Headers and Parameters

**Authorization Request**:
- `client_id` - Your registered client identifier
- `redirect_uri` - Your callback URL
- `response_type=code` - Always use authorization code flow
- `scope` - Space-separated scopes (minimum: `openid`)
- `state` - Unique CSRF protection value
- `nonce` - Replay protection value
- `code_challenge` - PKCE challenge (SHA256 hash)
- `code_challenge_method=S256` - Always SHA256

**Token Exchange**:
- `Content-Type: application/x-www-form-urlencoded`
- `grant_type=authorization_code`
- `code` - Authorization code from callback
- `redirect_uri` - Must match authorization request
- `client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer`
- `client_assertion` - Signed JWT with your private key
- `code_verifier` - PKCE verifier matching challenge

**Attribute Requests**:
- `Authorization: Bearer {access_token}`
- `DIS-Client-Assertion` - **Required**: Signed JWT header
- `Content-Type: application/json`

### Token Lifetimes

- **Access tokens**: 15 minutes
- **Refresh tokens**: 15 minutes 
- **ID tokens**: 15 minutes
- **Authorization codes**: Short-lived and single-use (exact lifetime pending confirmation from ScotAccount team)
- **Authentication flows**: 7 days
- **ScotAccount sessions**: 4 hours
- **Access/Refresh tokens**: 15 minutes

### Available Scopes

- `openid` - **Required**: Basic authentication
- `scotaccount.gpg45.medium` - Verified identity (GPG45 Medium)
- `scotaccount.address` - Verified postal address
- `scotaccount.email` - Verified email address
- `scotaccount.mobile` - Verified mobile number

### Critical Implementation Notes

- **State persistence**: Must store for 7 days minimum
- **PKCE required**: All authorization requests must include PKCE
- **No long-lived tokens**: Attributes must be requested per-flow
- **DIS-Client-Assertion**: Required header for all attribute requests
- **JWKS refresh**: Fetch fresh keys before each authentication flow
- **Cross-device support**: Users may complete verification on different devices

## Next Steps

<div class="callout callout--success">
<strong>Start Testing Immediately!</strong> Visit our <a href="{{ '/testing-guide/' | url }}">Testing Guide</a> to use the Mock Service and Demo RP for immediate integration testing.
</div>

<div class="callout callout--success">
<strong>Ready for detailed implementation?</strong> Move on to the <a href="{{ '/scotaccount-guide/' | url }}">Implementation Guide</a> for technical details.
</div>

<div class="callout callout--warning">
<strong>Need error handling?</strong> Review the <a href="{{ '/error-reference/' | url }}">Error Reference</a> for comprehensive error codes and resolution strategies.
</div>

<div class="callout callout--info">
<strong>Need verified attributes?</strong> Learn about <a href="{{ '/scotaccount-token-validation-module/' | url }}">token validation</a> and attribute handling.
</div>

<div class="callout callout--warning">
<strong>Planning for production?</strong> Review the <a href="{{ '/architecture/' | url }}">architecture overview</a> to understand system components and scalability considerations.
</div>

<div class="callout callout--info">
<strong>Need a deeper dive on how ScotAccount works?</strong> Learn about <a href="{{ '/scotaccount-complete-guide/' | url }}">Comprehensive Implementation Guide</a> to understand the details regarding the implementation.
</div>

## Support and Resources

- **Mock Service**: Use `https://mock-dis.main.integration.scotaccount.service.gov.scot/v2/` for automated testing
- **Demo RP**: Access manual testing interface at the provided URLs
- **Testing Guide**: Complete testing documentation with examples and troubleshooting
- **Error Reference**: Comprehensive error code documentation and resolution strategies
- **Integration support**: Contact the ScotAccount team for technical assistance
- **Security**: Follow all security requirements for production deployment
