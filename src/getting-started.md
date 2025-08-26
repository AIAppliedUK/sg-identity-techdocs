---
layout: base.njk
title: "Getting Started with ScotAccount"
description: "Quick start guide for developers integrating with ScotAccount"
eleventyNavigation:
  key: getting-started
  order: 2
---

Get up and running with ScotAccount in quickly. This guide covers the essential steps to integrate ScotAccount into your application.

## Prerequisites

Before you begin, ensure you have:

- **Development environment** set up with HTTPS capability
- **EC P-256 key pair** Eliptic Curve keys generated using OpenSSL
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

The first step in your implementation is get the authentication flow working. This will prove connectivity and your applications ability to send requests to the ScotAccount serveice and handle the redirects to enable the user to complete the login steps necessary to complete authentication.

1. **Implement discovery endpoint** - Retrieve current configuration automatically
2. **Build PKCE parameters** - Generate code verifier and challenge
3. **Create authorization request** - Build secure authentication URL
4. **Implement callback handler** - Process authentication response
5. **Build JWT client assertion** - Use your private key for token requests
6. **Complete token exchange** - Get access and ID tokens
7. **Validate ID tokens** - Extract and verify user identity

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

Build the authorization URL and redirect users to ScotAccount using a redirect like the one shown below

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
    code=authorization-code&
    state=your-state-value
```

**Critical**: Always validate the state parameter matches your original value.

### 5. Exchange Code for Tokens

Once you receive this callback you then must create a JWT client assertion and exchange the authorization code:

```http
POST https://authz.integration.scotaccount.service.gov.scot/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code=authorization-code&
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

- **Always required** for all authorization requests
- Protects against authorization code interception attacks
- Must use SHA256 method (`S256`)

### State Parameter Validation

- **Generate unique state** for each authorization request
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

```javascript
// Store user session after successful authentication
const userSession = {
  uuid: idToken.sub,
  sessionId: idToken.sid,
  authenticatedAt: Date.now(),
  expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
};
```

### Logout Implementation

```javascript
// Redirect to ScotAccount logout
const logoutUrl = `https://authz.integration.scotaccount.service.gov.scot/authorize/logout?
  id_token_hint=${idToken}&
  post_logout_redirect_uri=${encodeURIComponent(postLogoutUrl)}&
  state=logout-state`;
```

## Next Steps

<div class="callout callout--success">
<strong>Ready for detailed implementation?</strong> Move on to the <a href="{{ '/scotaccount-guide/' | url }}">Implementation Guide</a> for technical details.
</div>

<div class="callout callout--info">
<strong>Need verified attributes?</strong> Learn about <a href="{{ '/scotaccount-token-validation-module/' | url }}">token validation</a> and attribute handling.
</div>

<div class="callout callout--warning">
<strong>Planning for production?</strong> Review the <a href="{{ '/architecture/' | url }}">architecture overview</a> to understand system components and scalability considerations.
</div>

<div class="callout callout--info">
<strong>Need a deeper dive on how ScotAcocunt works?</strong> Learn about <a href="{{ '/scotaccount-complete-guide/' | url }}">Comprehensive Implementation Guide</a> to understand the details regarding the implementation.
</div>

## Support and Resources

- **Integration support**: Contact the ScotAccount team for technical assistance
- **Testing environment**: Use integration endpoints for development and testing
- **Documentation**: Refer to the comprehensive implementation guide for detailed implementation information
- **Security**: Follow all security requirements for production deployment
