---
layout: base.njk
title: "Complete Guide"
description: "Comprehensive technical guide for implementing ScotAccount authentication and verified attributes"
eleventyNavigation:
  key: complete-guide
  order: 5
---

## Complete Authentication Flow Summary

This section provides a step-by-step walkthrough of the entire authentication process with actual URLs and data exchanges.

[[toc]]

### Step 1: Discovery Configuration

```http
GET https://authz.integration.scotaccount.service.gov.scot/.well-known/openid-configuration
```

Response provides all endpoint URLs and supported features.

### Step 2: Start Authentication

Your application generates:

- Code verifier: `dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk`
- Code challenge: `E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM`
- State: `af0ifjsldkj`
- Nonce: `n-0S6_WzA2Mj`

Redirect user to:

```
https://authz.integration.scotaccount.service.gov.scot/authorize?
    client_id=your-client-id&
    redirect_uri=https://yourservice.gov.scot/auth/callback&
    response_type=code&
    scope=openid&
    state=af0ifjsldkj&
    nonce=n-0S6_WzA2Mj&
    code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&
    code_challenge_method=S256
```

### Step 3: User Authenticates

User logs in at ScotAccount and is redirected back:

```
https://yourservice.gov.scot/auth/callback?
    code=SplxlOBeZQQYbYS6WxSbIA&
    state=af0ifjsldkj
```

### Step 4: Exchange Code for Tokens

Create client assertion JWT:

```json
{
  "iss": "your-client-id",
  "sub": "your-client-id",
  "aud": "https://authz.integration.scotaccount.service.gov.scot/token",
  "exp": 1757847083,
  "iat": 1741953083,
  "jti": "unique-id-here"
}
```

Make token request:

```http
POST https://authz.integration.scotaccount.service.gov.scot/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code=SplxlOBeZQQYbYS6WxSbIA&
redirect_uri=https://yourservice.gov.scot/auth/callback&
client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer&
client_assertion=eyJhbGciOiJSUzI1NiJ9...&
code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
```

Receive tokens:

```json
{
  "access_token": "eyJraWQiOiJXZ2lHIiw...",
  "id_token": "eyJraWQiOiJXZ2lHIiw...",
  "refresh_token": "eyJlbmMiOiJBMTI4Q0...",
  "token_type": "Bearer",
  "expires_in": 900
}
```

### Step 5: Validate ID Token

Extract and validate claims from ID token:

```json
{
  "sub": "4f6893f4-6fbe-423e-a5cc-d3c93e5a7c41", // User's UUID
  "aud": "your-client-id",
  "iss": "https://authz.integration.scotaccount.service.gov.scot",
  "nonce": "n-0S6_WzA2Mj",
  "sid": "session-id-for-logout"
}
```

### Step 6: Request Verified Attributes (Optional)

If you need verified data, start new flow with additional scopes:

```
https://authz.integration.scotaccount.service.gov.scot/authorize?
    client_id=your-client-id&
    redirect_uri=https://yourservice.gov.scot/auth/callback&
    response_type=code&
    scope=openid%20scotaccount.email%20scotaccount.address&
    // ... other parameters
```

After getting new access token, request attributes:

```http
GET https://issuer.main.integration.scotaccount.service.gov.scot/attributes/values
Authorization: Bearer [access-token]
DIS-Client-Assertion: [new-client-assertion-for-attributes-endpoint]
```

### Step 7: Logout

When user logs out:

```http
GET https://authz.integration.scotaccount.service.gov.scot/authorize/logout?
    id_token_hint=[id-token]&
    post_logout_redirect_uri=https://yourservice.gov.scot/logout&
    state=logout-state
```

---

## Understanding ScotAccount: A Developer's Perspective

ScotAccount serves as Scotland's centralised digital identity provider, offering government services a secure way to authenticate citizens and access verified personal information. Think of it as a trusted intermediary that handles the complex work of identity verification so your service doesn't have to build these capabilities from scratch.

### The Value Proposition for Developers

Rather than building your own authentication system with all the associated complexity of password management, identity verification, and security compliance, ScotAccount provides several key benefits. Users authenticate once with ScotAccount and can then access multiple government services seamlessly. Your service gains access to verified identity data that has been independently validated through rigorous processes. The system provides security by design through OpenID Connect standards, protecting against common web vulnerabilities. Additionally, you benefit from built-in compliance support with data protection and audit capabilities already implemented.

### Core Concepts You Need to Understand

The distinction between authentication and verified attributes is fundamental to understanding how ScotAccount works. Authentication proves that someone is a returning user by providing you with a persistent UUID that uniquely identifies them across all interactions. Verified attributes go further, providing specific information about that person that has been independently verified through various means such as credit reference checks, document verification, or email confirmation processes.

ScotAccount uses token-based security rather than traditional password handling. Instead of your service managing user credentials, ScotAccount provides cryptographically signed tokens that prove user identity and permissions. This delegation model means your service redirects users to ScotAccount for authentication, then receives cryptographic proof of successful authentication without ever handling user credentials directly.

### Why OpenID Connect and OAuth 2.0 Matter

OpenID Connect builds upon OAuth 2.0 to provide a standardised approach to identity and authorisation. OAuth 2.0 handles the authorisation aspect, determining what a user is allowed to access, whilst OpenID Connect adds the identity layer, proving who the user actually is. This separation of concerns allows for more flexible and secure implementations.

The protocols include sophisticated protection mechanisms against common attack vectors. Cross-Site Request Forgery protection through state parameters, authorization code interception protection through PKCE, and replay attack protection through nonce values all work together to create a robust security framework.

---

## Architecture Overview

![ScotAccount High-Level Architecture]({{ '/assets/diagrams/architecture-context.png' | url }})

_Figure: High-level architecture of ScotAccount and its integration with core DIS components._

This architecture diagram illustrates the complete integration pattern between your government service and ScotAccount. The flow begins when a user visits your service and needs to authenticate. Your web application redirects them to ScotAccount's authentication service, which handles the actual credential verification process.

Once authentication is complete, ScotAccount redirects the user back to your service with an authorization code. Your backend processes this code by exchanging it for tokens through ScotAccount's token service. If your service needs verified attributes about the user, you can make additional requests to the attribute service using the access token you received.

The final steps involve storing or updating user information in your database, creating an appropriate session, and granting access to your service. Throughout this process, tokens are cryptographically signed JWTs that you validate using ScotAccount's public keys, ensuring authenticity and integrity.

---

## Phase 1: Setup & Registration

### Understanding What You Need to Prepare

Before you can integrate with ScotAccount, you need to establish a secure, trusted relationship between your service and ScotAccount's infrastructure. This involves several critical components that work together to ensure secure communication and proper authorization.

The foundation of this relationship is cryptographic key management. You'll generate a public-private key pair where you keep the private key absolutely secure within your systems and provide the public key to ScotAccount during registration. ScotAccount uses your public key to verify that API requests are genuinely coming from your service.

Network configuration is equally important, particularly for production deployments. ScotAccount implements IP allowlisting as a security measure, meaning only requests from pre-registered IP addresses will be accepted. You'll need to identify all the IP addresses that your service will use to communicate with ScotAccount.

Service endpoint configuration defines how ScotAccount will interact with your service during authentication flows. The redirect URI is where ScotAccount will send users after they complete authentication, whilst the logout URI defines where users go after terminating their session.

### Cryptographic Key Generation Strategy

The security of your entire ScotAccount integration depends on proper cryptographic key management. should use Elliptic Curve keys

Elliptic Curve keys have smaller key sizes and good performance characteristics. The P-256 curve provides security roughly equivalent to a 3072-bit RSA keys whilst requiring significantly less computational resources. This can be particularly beneficial for high-volume services or resource-constrained environments.

Regardless of which key type you choose, the critical security requirement is proper private key storage. Your private key must never exist in plain text outside of your application's runtime memory. Use dedicated secret management systems like AWS Secrets Manager, Azure Key Vault, or HashiCorp Vault. The key should be loaded into your application at runtime and never written to configuration files, environment variables, or any persistent storage.

### Scope Planning and Data Requirements Analysis

Understanding which scopes your service requires is fundamental to a successful integration. Each scope represents a specific type of information or capability that ScotAccount can provide, and requesting the right combination of scopes ensures your service gets the data it needs whilst maintaining user trust through appropriate consent requests.

The openid scope is mandatory for all integrations as it provides the basic authentication functionality and the persistent user identifier that allows you to recognise returning users. This UUID is immutable and provides a reliable way to link user sessions and data across multiple interactions.

The scotaccount.gpg45.medium scope provides verified identity information including the user's given name, family name, and date of birth. This information has been verified to GPG45 medium assurance level through a comprehensive process that includes checking identity documents and performing various verification checks. This scope is essential for services that need to verify users' legal identities.

The scotaccount.address scope provides a verified postal address that has been checked against credit reference records. This verification process confirms that the user has a genuine connection to the provided address through financial or residency records. This scope is particularly useful for services that need to verify where users live for eligibility or delivery purposes.

The scotaccount.email scope provides an email address that has been verified through an email confirmation loop during the user's ScotAccount registration process. This ensures that the user actually controls the provided email address and can receive communications sent to it.

The scotaccount.mobile scope provides a mobile number that has been verified through an SMS confirmation loop during the user's ScotAccount registration process. This ensures that the user actually controls the provided mobile number and can receive communications sent to it.

When planning your scope requirements, consider implementing progressive consent where you request additional scopes only when they become necessary for specific functionality rather than requesting everything upfront. This approach can improve user experience and conversion rates.

### Registration Information Preparation

The registration process requires comprehensive information about your service configuration. This information is used to configure ScotAccount's systems to work with your specific deployment architecture and security requirements.

Your service information should include a clear service name and description that will be shown to users during authentication and consent flows. Users need to understand what service they're granting access to, so this information should be clear and recognisable.

Network configuration for production deployments must include all IP addresses that will make requests to ScotAccount's APIs. This typically includes your web servers, application servers, and any background services that might need to validate tokens or refresh authentication state. If your infrastructure uses load balancers, proxy servers, or content delivery networks, you need to understand how these affect the source IP addresses that ScotAccount will see.

Service endpoint configuration requires careful planning of your redirect and logout URIs. These URLs must be accessible to users' browsers and must exactly match what you register with ScotAccount. Even small differences in URL structure, query parameters, or trailing slashes will cause authentication failures.

Your cryptographic configuration section should specify whether you're using RSA or Elliptic Curve keys, the key length, and provide the complete public key content including all formatting and line breaks.

Scope requirements should list all the scopes your service needs along with a clear justification for why each scope is necessary. This helps ScotAccount understand your use case and ensures that you're requesting appropriate permissions for your service's functionality.

---

## Phase 2: Basic Authentication Implementation

### Understanding the OpenID Connect Flow

OpenID Connect authentication represents a sophisticated approach to solving the fundamental challenge of proving user identity in web applications. The protocol addresses many security and usability problems inherent in traditional username-and-password authentication through its delegation model.

When a user attempts to authenticate with your service via ScotAccount, they're not providing their credentials directly to your application. Instead, your application redirects them to ScotAccount, where they authenticate using whatever methods ScotAccount supports. Once authentication is complete, ScotAccount provides your application with cryptographic proof that the user has been authenticated, along with a persistent identifier that allows you to recognise that user in future interactions.

This delegation model provides several crucial benefits that make it superior to traditional authentication approaches. Your application never handles user passwords or other sensitive authentication credentials, reducing your security liability and simplifying compliance requirements. Users benefit from a consistent authentication experience across all government services that use ScotAccount, and they only need to maintain one set of authentication credentials for accessing multiple services.

The authentication flow incorporates several sophisticated protection mechanisms against common web application attacks. Understanding these mechanisms helps you appreciate why certain steps in the process are mandatory and why attempting to simplify or skip steps can introduce serious security vulnerabilities.

![ScotAccount Detailed flow diagram]({{ '/assets/diagrams/oidc-complete-flow.png' | url }})

_Figure: Illustration of authentication flow._

```plantuml
@startuml OpenID Connect Authentication Flow
!theme cerulean-outline

participant "User" as User
participant "Your Service" as Service
participant "ScotAccount" as SA
participant "Token Endpoint" as Token

User -> Service: 1. Access protected resource
Service -> Service: 2. Generate PKCE parameters\n(code_verifier, code_challenge)
Service -> Service: 3. Generate state & nonce\n(CSRF & replay protection)
Service -> User: 4. Redirect to ScotAccount\nwith auth request
User -> SA: 5. Authentication & consent
SA -> User: 6. Redirect back with\nauthorization code
User -> Service: 7. Callback with code & state
Service -> Service: 8. Validate state parameter\n(CSRF protection)
Service -> Service: 9. Create client assertion JWT\n(signed with private key)
Service -> Token: 10. Exchange code for tokens\n+ client assertion + code_verifier
Token -> Service: 11. Return access_token,\nid_token, refresh_token
Service -> Service: 12. Validate ID token signature\nand claims
Service -> Service: 13. Extract user UUID (sub)\nand create session
Service -> User: 14. Grant access to\nprotected resource

note over Service, Token
The client assertion proves your
service's identity using your private key.
The code_verifier proves you initiated
the original auth request (PKCE protection).
end note

@enduml
```

This comprehensive flow diagram illustrates every critical step in the OpenID Connect authentication process as implemented by ScotAccount. Each step serves specific security purposes and contributes to the overall integrity of the authentication system.

The process begins when a user attempts to access a protected resource in your service. Your service recognises that authentication is required and initiates the OpenID Connect flow by generating the necessary security parameters. The PKCE parameters protect against authorization code interception attacks, whilst the state and nonce parameters provide protection against CSRF and replay attacks respectively.

Your service then redirects the user to ScotAccount with a carefully constructed authorization request that includes all necessary parameters. ScotAccount handles the actual authentication process, which may involve multiple steps depending on the user's account status and the security requirements.

Once authentication is complete, ScotAccount redirects the user back to your service with an authorization code. Your service validates the state parameter to ensure the response corresponds to a request it actually made, then creates a client assertion JWT to prove its identity to ScotAccount.

The token exchange step involves your service sending the authorization code, client assertion, and PKCE code verifier to ScotAccount's token endpoint. ScotAccount validates all these components before issuing tokens that your service can use.

Finally, your service validates the received tokens, extracts the user's identifier, and creates an appropriate session to grant access to the protected resource.

### Discovery and Configuration Management

Before your application can authenticate users, it needs to understand ScotAccount's current configuration and capabilities. This information is provided through the OpenID Connect discovery mechanism, which returns a JSON document containing endpoint URLs, supported authentication methods, and other configuration details.

**Discovery Endpoint URL:**

```
https://authz.integration.scotaccount.service.gov.scot/.well-known/openid-configuration
```

**Example Discovery Request:**

```http
GET /.well-known/openid-configuration HTTP/1.1
Host: authz.integration.scotaccount.service.gov.scot
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

**JWKS Endpoint for Public Keys:**

```
https://authz.integration.scotaccount.service.gov.scot/jwks.json
```

**Example JWKS Response:**

```json
{
  "keys": [
    {
      "kty": "RSA",
      "e": "AQAB",
      "use": "sig",
      "kid": "WgiG",
      "n": "j37Y-Fmx2Pr9xCHXhBWvDRaXobvpikF2Nd2J_FoK8U5SlMeb..."
    }
  ]
}
```

Dynamic configuration retrieval is essential because it allows your service to adapt to changes in ScotAccount's infrastructure without requiring code updates. ScotAccount may periodically update endpoint URLs, rotate cryptographic keys, or modify supported authentication methods. By retrieving configuration dynamically, your service can handle these changes automatically.

The discovery endpoint provides several critical pieces of information that your application will use throughout the authentication process. The issuer field identifies ScotAccount as the identity provider and must match the issuer claims in tokens that ScotAccount issues. The authorization_endpoint is where you'll send users to begin the authentication process, whilst the token_endpoint is where your application will exchange authorization codes for tokens.

The jwks_uri provides access to the cryptographic keys that ScotAccount uses to sign tokens. Your application will use these keys to validate the authenticity and integrity of tokens it receives. The various supported fields indicate which authentication methods, token types, and cryptographic algorithms ScotAccount supports, helping ensure compatibility between your implementation and ScotAccount's capabilities.

Implementing robust configuration management involves caching the discovery response to improve performance whilst ensuring that your application picks up configuration changes within a reasonable timeframe. Error handling should include fallback to cached configuration if the discovery endpoint is temporarily unavailable, helping maintain service availability during network issues or ScotAccount maintenance periods.

### PKCE Implementation Strategy

PKCE (Proof Key for Code Exchange) is a critical security enhancement that protects the authorization code flow against interception attacks. Understanding how PKCE works and implementing it correctly is essential for maintaining the security of your ScotAccount integration.

PKCE addresses a specific vulnerability in the OAuth 2.0 authorization code flow where an attacker might intercept the authorization code during the redirect back to your application. In traditional OAuth 2.0, this authorization code could then be exchanged for tokens by anyone who possesses it.

PKCE solves this problem by introducing a cryptographic challenge-response mechanism. Your application generates a random code verifier, calculates a corresponding code challenge using SHA256 hashing, and includes the code challenge in the initial authorization request. The authorization code that ScotAccount returns is cryptographically bound to this code challenge.

When your application exchanges the authorization code for tokens, it must provide the original code verifier. ScotAccount can then verify that the code verifier matches the code challenge from the original request, proving that the token exchange request is coming from the same application that initiated the authorization flow.

The security of PKCE depends entirely on the unpredictability of the code verifier. The code verifier must be generated using a cryptographically secure random number generator and must have sufficient entropy to resist brute-force attacks. The code verifier should be between 43 and 128 characters long and use the base64url character set.

The code challenge is calculated by taking the SHA256 hash of the code verifier and encoding it using base64url encoding. This one-way transformation ensures that even if an attacker intercepts the code challenge, they cannot derive the original code verifier.

### State Management for CSRF Protection

The state parameter provides protection against Cross-Site Request Forgery attacks by ensuring that authorization responses correspond to requests that your application actually initiated. Implementing state management correctly is crucial for maintaining the security of the authentication flow.

CSRF attacks occur when an attacker tricks a user into performing actions they didn't intend by exploiting their existing authenticated sessions. In the context of OpenID Connect, this could involve an attacker initiating an authentication flow and then tricking a victim into completing it, potentially allowing the attacker to gain access to the victim's account.

The state parameter prevents this attack by creating a unique, unpredictable value for each authentication request. Your application generates this value and includes it in the authorization request. ScotAccount returns the same state value in the authorization response, allowing your application to verify that the response corresponds to a request it actually made.

Proper state management involves generating cryptographically secure random state values that cannot be predicted by attackers. Each state value should be single-use and have a limited lifetime to prevent replay attacks. Your application should store the state value securely during the authentication flow and validate it when processing the authorization response.

The state validation step must occur before any other processing of the authorization response. If the state value doesn't match what your application originally generated, the entire response should be rejected as potentially malicious.

### Authorization Request Construction

The authorization request is the first step in the authentication flow where your application redirects the user to ScotAccount for authentication. Constructing this request correctly is crucial for both security and functionality.

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

Each parameter in the authorization request serves a specific purpose:

- **client_id**: Your unique identifier assigned during registration (e.g., `6ovfxtjaivlpy`)
- **redirect_uri**: Where ScotAccount sends users after authentication. Must exactly match your registered URI
- **response_type**: Always `code` for the authorization code flow
- **scope**: Space-separated list of requested permissions. `openid` is mandatory
- **state**: Random value for CSRF protection (you generate this)
- **nonce**: Random value for replay protection (you generate this)
- **code_challenge**: SHA256 hash of your code verifier, base64url encoded
- **code_challenge_method**: Always `S256` for SHA256

**Example with Additional Scopes:**

```
GET https://authz.integration.scotaccount.service.gov.scot/authorize?
    client_id=your-client-id&
    redirect_uri=https://yourservice.gov.scot/auth/callback&
    response_type=code&
    scope=openid%20scotaccount.email%20scotaccount.gpg45.medium&
    state=af0ifjsldkj&
    nonce=n-0S6_WzA2Mj&
    code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&
    code_challenge_method=S256
```

**What Happens Next:**

1. User is redirected to ScotAccount's login page
2. User authenticates and grants consent
3. ScotAccount redirects back to your redirect_uri with:
   ```
   https://yourservice.gov.scot/auth/callback?
       code=SplxlOBeZQQYbYS6WxSbIA&
       state=af0ifjsldkj
   ```

### Token Exchange and Client Authentication

The token exchange step is where your application proves its identity to ScotAccount and exchanges the authorization code for usable tokens. This critical step requires your service to create a special JWT called a "client assertion" that acts like a digital signature, proving you are who you claim to be.

**Token Endpoint URL:**

```
https://authz.integration.scotaccount.service.gov.scot/token
```

**Step 1: Create Your Client Assertion JWT**

Your service creates a JWT with these claims:

```json
{
  "iss": "your-client-id",
  "sub": "your-client-id",
  "aud": "https://authz.integration.scotaccount.service.gov.scot/token",
  "exp": 1757847083, // 6 months from now
  "iat": 1741953083, // Current time
  "jti": "239a5659-0533-4faa-ba97-8f6ee057843f" // Unique ID
}
```

This JWT is signed with your private key, resulting in something like:

```
eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI2b3ZmeHRqYWl2bHB5Iiw...
```

**Step 2: Make the Token Exchange Request**

```http
POST /token HTTP/1.1
Host: authz.integration.scotaccount.service.gov.scot
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code=SplxlOBeZQQYbYS6WxSbIA&
redirect_uri=https://yourservice.gov.scot/auth/callback&
client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer&
client_assertion=eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI2b3ZmeHRqYWl2bHB5Iiw...&
code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
```

**Request Parameters Explained:**

- **grant_type**: Always `authorization_code`
- **code**: The authorization code from the callback
- **redirect_uri**: Must match exactly what you used in the authorization request
- **client_assertion_type**: Always this exact URN value
- **client_assertion**: Your signed JWT proving your identity
- **code_verifier**: The original PKCE verifier you generated

**Step 3: Receive Tokens**

Success response:

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

Error response example:

```json
{
  "error": "invalid_grant",
  "error_description": "Authorization code is invalid or expired"
}
```

The key security aspects of this exchange:

- Your private key never leaves your system
- The client assertion proves only you could have made this request
- The code verifier proves you initiated the original flow
- All parameters are validated together for maximum security

### Token Validation and User Identity Extraction

Once your application receives tokens from ScotAccount, it must validate them thoroughly before trusting their contents. Token validation is a critical security step that ensures the tokens are authentic, haven't been tampered with, and are intended for your application.

JSON Web Tokens used by ScotAccount consist of three parts separated by dots: the header, payload, and signature. Understanding this structure through a concrete example helps clarify what you're validating and why each step matters.

**Example ID Token (Encoded):**

```
eyJraWQiOiJXZ2lHIiwiYWxnIjoiUlMyNTYifQ.eyJzdWIiOiI0ZjY4OTNmNC02ZmJlLTQyM2UtYTVjYy1kM2M5M2U1YTdjNDEiLCJhdWQiOiI1eWh5Z2tzY3R3cHFnIiwiaXNzIjoiaHR0cHM6Ly9hdXRoei5pbnRlZ3JhdGlvbi5zY290YWNjb3VudC5zZXJ2aWNlLmdvdi5zY290IiwiZXhwIjoxNjc4OTMyNjYyLCJpYXQiOjE2Nzg5MzE3NjIsIm5vbmNlIjoiQmRITERXUFJtWThXQllONkJFdEZmSTJSVm9KbXlDUnBwR0ZJdDJoR3k3QSIsImp0aSI6ImZQX1hfMnc2NWlVIiwic2lkIjoieXhaMlZwT255ZFYwQ1Q4ajFTYmxmenRSWURya3EtU0ozT0g3ZWpGN0dRZyJ9.db79iKccqKkXF4MF2IThOV05AZHrlvmNZWAW5ojUzyQoKzHSlPtCEeC3sqwsah84gHMqU0A9ACWPbE8SECdpzOvL6QVCfoWjwuiMEzMsOZvCHccMEpeNX8rbB7_L5Mo5lLOpVl80jIezKNQJ8NMQoOgMGaBm5qkgLTVFuYqVnvpzAEb44xDeSYe7__jaXOUBiGIWMqopeqJRmR1cy5yJ9ShqDa_xoBVmAxXXXv0ZOanE7E7-LCBApdvFNRA-JUUrjMIYUNn8cSkupye6bjLElLT_qPKJc6N0mSOhH43oU5GB-heMhNX18p-07J5pFFAHotcP6VsA2mE7y96gLQ1XrA
```

This encoded token contains three Base64URL-encoded sections separated by dots. Let's examine what's inside by decoding each section:

**Header (Decoded):**

```json
{
  "kid": "WgiG",
  "alg": "RS256"
}
```

The header tells us that this token is signed using RS256 (RSA with SHA-256) and identifies which key was used to sign it through the kid (key ID) field. Your application will use this kid to look up the correct public key from ScotAccount's JWKS endpoint.

**Payload (Decoded):**

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

The payload contains the actual claims about the authentication event. Each field serves a specific purpose in the validation process:

- **sub (Subject)**: This is the persistent user identifier (UUID) that uniquely identifies the user across all ScotAccount services. This is the primary piece of information you'll extract and store.
- **aud (Audience)**: Your client ID, confirming this token was issued specifically for your application.
- **iss (Issuer)**: ScotAccount's identifier, which must match the issuer from the discovery document.
- **exp (Expiration)**: Unix timestamp indicating when this token expires (15 minutes after issuance).
- **iat (Issued At)**: Unix timestamp of when the token was created.
- **nonce**: The random value you provided in the authorization request, used to prevent replay attacks.
- **jti (JWT ID)**: A unique identifier for this specific token.
- **sid (Session ID)**: ScotAccount's session identifier, used for session management and logout.

**Signature:**
The third part is the cryptographic signature that proves the token hasn't been tampered with and was genuinely issued by ScotAccount. This signature is created using ScotAccount's private key and can be verified using their public key.

Proper JWT validation involves several distinct steps, each of which protects against different types of attacks. Signature verification ensures the token hasn't been tampered with and was indeed issued by ScotAccount. This involves retrieving ScotAccount's current public keys from the JWKS endpoint and using them to verify the token's cryptographic signature.

The validation process involves several critical steps that must be performed in the correct order to ensure security. First, your service parses the JWT to extract the header and payload sections. Using the key identifier from the header, you retrieve the appropriate public key from ScotAccount's JWKS endpoint. This key is then used to verify the cryptographic signature, ensuring the token hasn't been tampered with and was genuinely issued by ScotAccount.

After signature verification, you must validate each claim in the token. The expiration time must be checked to ensure the token is still valid. The issuer must match ScotAccount's identifier exactly as provided in the discovery document. The audience must be your client ID, confirming this token was issued specifically for your service. The nonce must match the value your service provided in the original authorization request, preventing replay attacks.

Successful validation confirms that the token is authentic, current, and intended for your service. The subject claim then provides the persistent user identifier that your service uses to recognise this user in all future interactions. This UUID remains constant for each user across all their sessions and interactions with your service.

OpenID Connect specific validation includes verifying the nonce claim to prevent replay attacks. The nonce value in the token must match the nonce value your application included in the original authorization request. Additionally, the subject claim provides the persistent user identifier that your application will use to recognise the user in future interactions.

Once validation is complete, you can extract the user's persistent identifier from the sub claim and use it to establish or update the user's session within your application. This UUID uniquely and persistently identifies the user across all interactions with ScotAccount-integrated services and serves as the foundation for user identity management in your service.

---

## Phase 3: Verified Attributes Integration

### Understanding Attribute Requests

When your service needs verified information about users beyond their basic identity, you request additional scopes in the authentication flow. ScotAccount will then guide users through appropriate consent screens and return verified data that has been independently validated through various verification processes.

The key principle behind verified attributes is user consent and data minimisation. Users must be present and actively consent to sharing each type of verified information. ScotAccount cannot provide verified attributes through background API calls or long-lived tokens - the user must be actively involved in the process each time new attributes are requested.

This consent-based approach serves both privacy and security purposes. Users maintain control over what information they share with each service, and services are encouraged to request only the data they actually need. The verification processes that ScotAccount uses to validate attributes are rigorous and involve multiple independent checks to ensure accuracy.

```plantuml
@startuml Verified Attributes Flow
!theme cerulean-outline

participant "User" as User
participant "Your Service" as Service
participant "ScotAccount Auth" as Auth
participant "Attribute Service" as Attrs

User -> Service: 1. Access feature requiring\nverified information
Service -> Service: 2. Check if user has\nrequired attributes locally
alt User needs additional attributes
    Service -> Auth: 3. Auth request with\nadditional scopes
    Auth -> User: 4. Show consent screen\nfor data sharing
    User -> Auth: 5. Grant consent
    Auth -> Service: 6. Return auth code
    Service -> Auth: 7. Exchange for tokens\n(including access_token)
    Service -> Attrs: 8. Request attributes\nusing access_token + client_assertion
    Attrs -> Service: 9. Return verified\nattribute data (JWT)
    Service -> Service: 10. Validate attribute JWT\nand extract claims
    Service -> User: 11. Provide service using\nverified information
else User already has required attributes
    Service -> User: 12. Provide service immediately\nusing stored attributes
end

note over Service, Attrs
Attribute requests require user
presence and consent. Access tokens
are short-lived and single-use.
Each attribute has verification metadata.
end note

@enduml
```

This flow diagram illustrates the complete process for requesting and receiving verified attributes from ScotAccount. The process begins when a user attempts to access functionality that requires verified information beyond basic authentication.

Your service first checks whether the user already has the required attributes stored locally. If the necessary verified information is already available, your service can proceed immediately without requiring additional authentication or consent steps.

If additional attributes are needed, your service initiates a new authentication flow that includes the additional scopes for the required attributes. This triggers ScotAccount's consent process, where users are clearly informed about what information is being requested and why.

Upon user consent, ScotAccount provides an authorization code that your service exchanges for tokens, including an access token specifically scoped for the requested attributes. This access token is then used to make a request to ScotAccount's attribute service, which returns the verified information in the form of a signed JWT.

The attribute JWT contains not only the verified claims but also detailed verification metadata that describes how each piece of information was verified and what level of assurance it carries. Your service validates this JWT using the same cryptographic verification process used for ID tokens.

### Attribute Verification Levels and Trust

Understanding the different verification methods and assurance levels for each type of attribute helps you make informed decisions about which attributes to request and how to use the returned information appropriately.

GPG45 Medium identity verification represents a substantial level of assurance about a user's legal identity. This process involves checking official identity documents, performing various database checks, and applying sophisticated fraud detection techniques. When you receive identity information with GPG45 Medium verification, you can have high confidence that it represents the user's actual legal identity as it appears on official documentation.

Address verification through credit reference agencies provides strong assurance that the user has a genuine connection to the provided address. This verification process checks the address against multiple credit reference databases to confirm that the user has had a financial or legal connection to that address. While this doesn't necessarily mean they currently live there, it does provide significant assurance about the legitimacy of the address information.

Email verification through confirmation loops provides assurance that the user controls the provided email address at the time of verification. This process involves sending a confirmation email with a unique link or code that the user must access to complete the verification. While simpler than other verification methods, this still provides valuable assurance for services that need to communicate with users via email.

Each verified attribute includes metadata that describes the verification process used, the confidence level achieved, and the timestamp of when the verification was performed. This metadata allows your service to make informed decisions about how to use the verified information and what level of trust to place in it.

### Progressive Consent and User Experience

Implementing verified attributes effectively requires careful consideration of the user experience and the timing of attribute requests. Progressive consent, where you request additional attributes only when they become necessary for specific functionality, generally provides a better user experience than requesting all possible attributes upfront.

**Critical Design Consideration: Extended GPG45 Verification Processes**

The GPG45 medium identity verification process duration is entirely guided by the user's ability to complete the required steps. Users may take days, weeks, or even longer to provide necessary documents and complete verification steps. This creates specific challenges that services must design for:

**How ScotAccount Handles Extended Verification:**

1. **User initiates verification**: User begins GPG45 medium verification through your service's request
2. **ScotAccount saves progress**: ScotAccount maintains the user's progress through verification steps
3. **Time passes**: The user may take any amount of time to complete verification steps
4. **Sessions expire**: Your service session, ScotAccount session, and all tokens will have expired
5. **User returns and logs in**: When the user authenticates with ScotAccount again, ScotAccount automatically returns them to their saved point in the verification journey
6. **Service perspective**: Your service initiated an authentication flow but never received a callback

From your service's perspective, this appears as an abandoned authentication flow. However, ScotAccount is maintaining the user's verification progress and will continue the process when they return.

**Cross-Browser and Cross-Device Challenges:**

Users may start verification on one device/browser and complete it on another. This creates additional complexity:

- **State parameters won't match**: The state parameter your service generated on the original browser won't exist in the new browser session
- **Local session data is lost**: Any data stored in the original browser session isn't accessible
- **PKCE parameters are missing**: The code verifier stored in the original session is not available

**Recommended Patterns for Handling Extended Verification:**

**1. Track Verification Initiation**
Record when users start verification processes so you can provide appropriate messaging when they return:

- Store the user ID and timestamp when verification is initiated
- Track which scopes were requested
- Save any context about what the user was trying to accomplish

**2. Design for Stateless Returns**
Since users may return on different devices, avoid relying on session state:

- Don't depend on the original state parameter being available
- Store important context server-side linked to the user ID
- Be prepared to handle authentication callbacks without matching state parameters

**3. Implement Intelligent Return Handling**
When users authenticate without completing a previous flow:

- Check if they have previously initiated verification
- Provide clear messaging about continuing their verification
- Offer options to check status or proceed with limited functionality

**4. Clear Communication Patterns**

- **Before starting**: "Identity verification can take as long as you need. You can return anytime to continue where you left off."
- **When returning**: "Welcome back! Your identity verification is in progress. Would you like to continue verifying your identity or proceed with limited access?"
- **Status checking**: "You started identity verification on [date]. Continue verification to unlock full access."

**5. Handle Missing State Gracefully**
When receiving callbacks without matching state:

- Log the event for security monitoring
- Check if the user has pending verification requests
- Provide appropriate options rather than showing errors

**Example User Journeys:**

**Scenario 1: Same Device Return**

- Day 1: User starts application on laptop → Begins verification
- Day 3: User returns on same laptop → ScotAccount continues verification
- Day 4: User completes verification → Your service receives verified attributes

**Scenario 2: Cross-Device Journey**

- Day 1: User starts on mobile phone → Begins verification
- Day 2: User continues on desktop computer → ScotAccount recognises them and continues
- Day 5: User completes on tablet → Your service receives callback on different device

**Important Considerations:**

- The verification duration is entirely user-controlled
- ScotAccount handles all progress saving and continuation
- Your service must handle callbacks that arrive days/weeks after initiation
- Cross-device flows mean you cannot rely on session state
- Design your user experience to accommodate these realities

Consider a typical government service scenario where users might initially need only basic authentication to access general information, but later require identity verification to submit applications or access personalised services. By implementing progressive consent, you can allow users to access the general functionality immediately whilst requesting additional verified attributes only when they're actually needed.

This approach has several benefits for both user experience and conversion rates. Users are more likely to grant consent for data sharing when they understand the specific purpose for which the information will be used. Requesting attributes in context, when their necessity is clear, builds trust and reduces the likelihood of users abandoning the authentication process.

However, progressive consent also requires careful implementation to avoid creating frustrating user experiences. Your service should clearly communicate when additional verification will be required and provide smooth transitions between different levels of access.

### Attribute Data Structure and Validation

Verified attributes are returned in a structured JSON format within a signed JWT that includes both the actual attribute data and comprehensive verification metadata. Understanding this structure is essential for properly extracting and validating the information your service receives.

**Attributes Endpoint URL:**

```
https://issuer.main.integration.scotaccount.service.gov.scot/attributes/values
```

**Attribute Request Example:**

```http
GET /attributes/values HTTP/1.1
Host: issuer.main.integration.scotaccount.service.gov.scot
Authorization: Bearer eyJraWQiOiJXZ2lHIiwidHlwIjoiYXQrand0Iiw...
DIS-Client-Assertion: eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI2b3ZmeHRq...
```

**Important**: The DIS-Client-Assertion header contains a new client assertion JWT with the audience set to the attributes endpoint URL.

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

**Key Points About Attribute Responses:**

1. **Partial Success is Possible**: If you request multiple scopes, ScotAccount returns as many as it can verify. You might receive 0 to N attributes back.

2. **Verification Metadata**: Each attribute includes detailed verification information:

   - `outcome`: Whether verification succeeded, had warnings, or failed
   - `trust_framework`: The standards framework used (typically "uk_tfida")
   - `confidence_level`: The assurance level achieved
   - `validation_method`: How the data was verified
   - `time`: When verification occurred
   - `verifier`: Who performed the verification

3. **Error Responses**:
   - `404 Not Found`: User has no verified attributes
   - `401 Unauthorized`: Invalid access token or client assertion
   - `403 Forbidden`: Token doesn't have required scopes

The verified claims array contains one or more attribute objects, each corresponding to a scope that was requested and successfully provided. Each attribute object includes the scope identifier, the actual claims data, and detailed verification information.

When processing attribute data, your service should validate not only the cryptographic signature of the JWT but also examine the verification metadata to ensure that the attributes meet your specific requirements for assurance level and recency. Different use cases may require different levels of verification, and the metadata provides the information needed to make these determinations.

### Attribute Storage and Lifecycle Management

Once your service receives verified attributes, you need to consider how to store and manage this information throughout its lifecycle. Verified attributes represent sensitive personal information that requires appropriate protection and management practices.

Consider implementing appropriate data retention policies based on your service's specific requirements and legal obligations. Some verified attributes may remain valid for extended periods, whilst others may require periodic re-verification. The verification metadata can help inform these decisions by providing information about when attributes were last verified.

Implement secure storage practices that protect verified attributes both at rest and in transit. This includes using appropriate encryption, access controls, and audit logging to ensure that verified information is only accessed by authorised personnel for legitimate purposes.

Consider the relationship between ScotAccount's verification and your service's ongoing data management needs. While ScotAccount provides initial verification of attributes, your service may need to implement additional validation or updating processes based on its specific requirements and use patterns.

Plan for scenarios where users may need to update their verified information or where verification status may change over time. Your service should be able to handle requests for re-verification and should provide clear guidance to users about how to update their information when necessary.

---

## Testing Strategy & Mock Service Usage

### Understanding Testing Environments

ScotAccount provides a comprehensive Integration/Sandpit environment that contains two distinct deployments to support different phases of your integration testing. Understanding the purpose and capabilities of each deployment helps you plan an effective testing strategy that builds confidence in your integration before production deployment.

**Mock Service Deployment**

The mock service is a completely isolated test application designed to allow you to test the functionality and interactions of the ScotAccount service without the complexity of full data verification or live data management. This service enables rapid development and testing cycles by providing predictable responses for all the standard OIDC flows.

**Mock Service URL:**

```
https://mock-dis.main.integration.scotaccount.service.gov.scot/v2/
```

The mock service's key benefits include:

- No need to create or manage test user accounts
- Predictable responses for testing different code paths
- Ability to exercise all authentication and attribute flows
- Fast response times for automated testing
- Detailed documentation of limitations and behaviour at the service URL

The mock service is ideal for:

- Initial development of your integration
- Automated testing in CI/CD pipelines
- Testing error handling and edge cases
- Demonstrating journey completeness
- Rapid iteration during development

**Production-Like Environment**

The second deployment is a fully functional, production-like environment that provides a representative experience of the live ScotAccount service. This environment uses the same infrastructure, protocols, and security measures as production, giving you high confidence that integrations tested here will work correctly when you go live.

The production-like environment provides:

- Full OIDC protocol implementation
- Real authentication flows with test accounts
- Complete security measures including IP allowlisting
- Actual consent and verification user interfaces
- The same data structures and response formats as production

Key limitation to note:

- Identity verification always returns successful/verified status
- This makes it difficult to test failed verification scenarios
- Plan your testing accordingly to work around this limitation

### Testing Strategy Progression

An effective testing strategy progresses through both deployments in a structured manner, building confidence at each stage before moving to the next. Think of this as climbing a ladder where each rung provides the foundation for safely reaching the next level.

```mermaid
flowchart TD
    %% Phase 1: Development
    subgraph Development["Phase 1: Development Environment"]
        UT[Unit Tests]
        IT[Integration Tests]
        Mock[Mock Service<br/>Isolated Test Environment]

        UT --> Mock
        IT --> Mock
    end

    %% Phase 2: Integration Validation
    subgraph Validation["Phase 2: Integration Validation"]
        E2E[End-to-End Tests]
        UJT[User Journey Tests]
        ST[Security Tests]
        PLE[Production-Like Environment<br/>Full ScotAccount Features]

        E2E --> PLE
        UJT --> PLE
        ST --> PLE
    end

    %% Phase 3: Production
    subgraph Production["Phase 3: Production Deployment"]
        Smoke[Smoke Tests]
        Monitor[Continuous Monitoring]
        Prod[Production Environment<br/>Live Service]

        Smoke --> Prod
        Monitor --> Prod
    end

    %% Flow between phases
    Development --> Validation
    Validation --> Production

    %% Styling
    classDef devClass fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef valClass fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px
    classDef prodClass fill:#fff3e0,stroke:#e65100,stroke-width:2px

    class UT,IT,Mock devClass
    class E2E,UJT,ST,PLE valClass
    class Smoke,Monitor,Prod prodClass
```

**Understanding Each Testing Phase:**

**Phase 1: Development Environment** - This is where you build your foundation. The mock service acts as your safe practice space where you can make mistakes without consequences. Your unit tests verify individual components work correctly, while integration tests ensure these components play nicely together. The mock service responds instantly and predictably, allowing you to iterate quickly and build comprehensive test coverage.

**Phase 2: Integration Validation** - Here you prove your integration works with the real ScotAccount protocols. The production-like environment provides authentic OIDC flows, actual user interfaces, and full security measures. You'll run end-to-end tests that mirror real user journeys, specific user journey tests for different scenarios, and security tests to validate your implementation. Remember that identity verification always succeeds here, so plan your error handling based on specifications rather than test results.

**Phase 3: Production Deployment** - This is where your integration meets real users. Smoke tests verify basic functionality immediately after deployment, while continuous monitoring watches for issues that only appear under real-world conditions. Here you'll encounter actual verification outcomes, complete security controls, and the full complexity of production traffic.

The downward flow between phases represents increasing realism and decreasing flexibility. You cannot skip phases because each one validates different aspects of your integration. Starting in production would be like learning to swim by jumping into the ocean - theoretically possible but unnecessarily risky.

### Mock Service Implementation Guide

The mock service simulates all ScotAccount endpoints and responses, allowing you to develop and test your integration without managing test data. Think of it as a practice environment where you can make mistakes safely and learn how the service behaves. Visit the mock service URL for comprehensive documentation about its capabilities and limitations.

**Using the Mock Service Effectively:**

The beauty of the mock service lies in its simplicity. You don't need to register your client or provide IP addresses, which means you can start testing immediately. This rapid feedback loop is invaluable during initial development when you're still figuring out how all the pieces fit together.

The mock service provides predictable responses, which might seem artificial but serves an important purpose. When you're building your integration, you need to know that a specific request will always produce a specific response. This predictability allows you to build robust automated tests that won't fail due to external factors like network issues or data changes.

**Understanding Mock Service Boundaries:**

While the mock service is excellent for functional testing, it deliberately relaxes some security validations. For instance, it may not fully validate client assertion signatures or enforce strict parameter checking. This isn't a limitation but rather a feature that allows you to focus on getting the integration flow correct before worrying about every security detail.

Example mock service endpoints follow the same pattern as production:

- Discovery: `https://mock-dis.main.integration.scotaccount.service.gov.scot/v2/.well-known/openid-configuration`
- Authorization, Token, and other endpoints: Check the discovery response for exact URLs

The mock service documentation (available at the service URL) provides detailed information about which validations are relaxed and how responses differ from production behaviour. This transparency helps you understand exactly what you're testing and what you'll need to validate later in the production-like environment.

### Production-Like Environment Testing

Once your integration works correctly with the mock service, you're ready for the production-like environment. This transition is like moving from a flight simulator to an actual aircraft with an instructor - everything is real except for certain safety constraints.

**Key Testing Areas and What Makes Them Important:**

The production-like environment forces you to handle real-world complexity. Your client assertions must be properly signed, your PKCE parameters must be correctly generated, and your state management must be bulletproof. This is where you discover if your error handling can cope with actual ScotAccount responses rather than simulated ones.

Testing the consent flows with real UI is particularly valuable because it reveals user experience issues that the mock service cannot simulate. You'll see exactly how long each step takes, where users might get confused, and how your application needs to handle users who take unexpected paths through the authentication process.

**Working Around the Verification Limitation:**

The fact that GPG45 verification always succeeds in this environment is a significant limitation, but there are strategies to work around it. Design your error handling based on the technical specification rather than what you can test. Use defensive programming principles - assume that verification can fail and build your system to handle that gracefully, even if you can't test it directly.

Consider creating a "verification failed" simulation in your own code during testing. You can temporarily modify your attribute parsing logic to treat successful verifications as failures, allowing you to test your error handling paths. Just remember to remove this simulation before moving to production.

### Recommended Testing Approach

Starting with the mock service allows you to build momentum quickly. You can create a comprehensive test suite that exercises every path through your integration, giving you a safety net for future changes. Focus on getting the happy paths working first, then systematically add error handling for each type of failure the specification describes.

When you move to the production-like environment, approach it with fresh eyes. Run through your test scenarios manually first to get a feel for the real system. Pay attention to timing - how long do redirects take? How quickly do tokens expire? These real-world characteristics will inform how you design your user experience.

Document any scenarios you cannot test fully, particularly around verification failures. Create a plan for monitoring these scenarios in production so you can respond quickly if issues arise. Remember that the first time some error conditions occur will be in production, so comprehensive logging and alerting become your safety net.

This methodical progression from mock to production-like to production ensures that when you go live, you've tested everything that can be tested and have plans in place for everything that cannot.

---

---

## Quick Reference

### Essential Endpoints

The ScotAccount service provides different endpoints for different environments, each serving specific purposes in your integration journey. Understanding which endpoints to use in which circumstances is crucial for successful integration.

**Integration Environment**: The integration environment uses endpoints under the authz.integration.scotaccount.service.gov.scot domain and provides a complete ScotAccount implementation with test data. This environment is perfect for development, testing, and final validation before production deployment. The discovery endpoint provides current configuration information including all other endpoint URLs.

**Production Environment**: The production environment uses endpoints under the authz.scotaccount.service.gov.scot domain and provides the live ScotAccount service with real user data and full security controls. This environment requires IP allowlisting and uses production-grade security measures.

**Mock Environment**: The mock environment uses endpoints under the mock-dis.main.integration.scotaccount.service.gov.scot domain and provides simulated responses for development and automated testing. This environment doesn't require real authentication and can simulate various success and failure scenarios.

### Scope Reference and Data Mapping

Understanding exactly what data each scope provides helps you request appropriate permissions and handle the returned information correctly in your service.

**openid scope**: This mandatory scope provides basic authentication functionality and returns a persistent user identifier in the sub claim of the ID token. This UUID uniquely identifies the user across all ScotAccount-integrated services and never changes for a given user. The authentication process verifies the user's identity to GPG45 Medium assurance level.

**scotaccount.gpg45.medium scope**: This scope provides verified identity information including the user's given name, family name, and date of birth as they appear on official identity documents. The verification process involves checking identity documents and performing various database checks to achieve GPG45 Medium assurance level.

**scotaccount.address scope**: This scope provides a verified postal address that has been checked against credit reference records. The returned address includes detailed components such as building numbers, street names, locality information, and postal codes, along with verification metadata describing the validation process.

**scotaccount.email scope**: This scope provides an email address that has been verified through an email confirmation loop during the user's ScotAccount registration. The verification process confirms that the user controls the provided email address and can receive messages sent to it.

### Token Lifetimes and Usage Patterns

Understanding token lifetimes helps you implement appropriate caching, refresh, and error handling strategies in your integration.

**Authorization Code**: Authorization codes are single-use tokens with a 10-minute lifetime that must be exchanged for usable tokens immediately after being received. These codes cannot be stored or reused and should be processed as soon as they're received from the authorization callback.

**Access Token**: Access tokens have a 15-minute lifetime and are used for making API requests to ScotAccount's attribute service. These tokens are scoped to specific attributes and cannot be used beyond their intended scope or lifetime.

**ID Token**: ID tokens have a 15-minute lifetime and contain user identity claims that have been cryptographically signed by ScotAccount. These tokens should be validated immediately upon receipt and the claims extracted for use in your application.

**Refresh Token**: Refresh tokens have a 15-minute lifetime and provide limited token refresh capabilities. The refresh token mechanism in ScotAccount is primarily designed for extending access to attribute APIs rather than long-term session management.

**Session**: Service session duration is 1 hour.

### Common Error Codes and Resolution

Understanding common error scenarios and their resolutions helps you implement effective error handling and provide appropriate user guidance.

**Authorization Endpoint Errors (302 Redirect):**

```
https://yourservice.gov.scot/auth/callback?
    error=access_denied&
    error_description=User%20denied%20consent&
    state=your-state
```

Common authorization errors:

- `invalid_request`: Missing or invalid parameters (check scopes, redirect_uri)
- `access_denied`: User cancelled or denied consent
- `invalid_scope`: Requested scope not supported or not granted to your client
- `server_error`: ScotAccount internal error

**Token Endpoint Errors (400/401 JSON Response):**

```json
{
  "error": "invalid_grant",
  "error_description": "Authorization code is invalid or expired"
}
```

Common token errors:

- `invalid_client`: Your client_id is not recognised or client assertion validation failed
- `invalid_grant`: Authorization code expired, already used, or doesn't match your client
- `invalid_request`: Missing required parameters or malformed request
- `unauthorized_client`: Your client isn't authorised for the requested grant type

**Attribute Endpoint Errors:**

- `401 Unauthorized`: Access token expired or client assertion invalid
- `403 Forbidden`: Token lacks required scopes for requested attributes
- `404 Not Found`: No verified attributes available for the user
- `500 Internal Server Error`: ScotAccount service issue

**Resolution Guide:**

**invalid_client errors** typically indicate that your client_id is not recognised by ScotAccount or that your client authentication is failing. Verify that:

- Your client_id matches exactly what was registered
- Your client assertion JWT is properly signed with your registered private key
- The audience claim in your client assertion matches the endpoint URL exactly
- Your client assertion hasn't expired (check the 6-month expiry)

**invalid_request errors** indicate that required parameters are missing or malformed in your requests. Check that:

- All mandatory parameters are present and properly formatted
- Redirect URI matches exactly (including trailing slashes)
- Scopes are space-separated and URL-encoded
- PKCE parameters are properly generated and matched

**access_denied errors** occur when users deny consent for authentication or data sharing. Handle these gracefully by:

- Providing clear explanation of why permissions are needed
- Offering alternative ways to use your service without full permissions
- Not repeatedly requesting the same permissions in a loop

**invalid_grant errors** typically indicate authorization code issues. Ensure that:

- Codes are exchanged immediately (within 10 minutes)
- Each code is only used once
- The redirect_uri in token exchange matches the authorization request
- The PKCE verifier matches the original challenge

---

## Phase 4: Production Deployment

### Understanding Production Environment Differences

Moving from development and testing to production involves several important changes that affect both security and operational considerations. The production environment implements stricter security controls and requires additional configuration that isn't necessary during development.

The most significant difference is the IP allowlisting requirement for production deployments. Unlike the integration environment where any IP address can connect for testing purposes, production requires that you register all IP addresses that will communicate with ScotAccount's APIs. This security measure helps protect against unauthorised access and provides an additional audit trail for all API communications.

Production endpoints use different URLs from the integration environment, and you'll need to update your configuration accordingly. Your redirect URIs must use HTTPS in production (localhost HTTP URIs are not permitted), and your logout URIs must also be publicly accessible HTTPS endpoints.

### Production Configuration Checklist

**Environment Configuration Updates:**

- [ ] Update discovery endpoint to production URL
- [ ] Update all redirect URIs to use HTTPS production URLs
- [ ] Update logout URI to production HTTPS endpoint
- [ ] Generate new cryptographic keys for production (never reuse development keys)
- [ ] Register production public key with ScotAccount
- [ ] Provide complete list of production IP addresses for allowlisting

**Security Implementation Requirements:**

- [ ] Store private keys in dedicated secret management systems
- [ ] Implement comprehensive logging for all authentication events
- [ ] Add monitoring for authentication success/failure rates
- [ ] Configure alerting for unusual authentication patterns
- [ ] Implement session timeout handling appropriate for your service
- [ ] Add comprehensive error handling with user-friendly messages

**Operational Readiness:**

- [ ] Test complete authentication flows in production environment
- [ ] Verify all error scenarios handle gracefully
- [ ] Confirm monitoring and alerting systems are working
- [ ] Document support procedures for common user issues
- [ ] Establish communication channels with ScotAccount support team
- [ ] Plan for handling service outages or maintenance windows

### Production Endpoints

| Service       | Production Endpoint                                                           |
| ------------- | ----------------------------------------------------------------------------- |
| Discovery     | `https://authz.scotaccount.service.gov.scot/.well-known/openid-configuration` |
| Authorization | Retrieved from discovery (typically `/authorize`)                             |
| Token         | Retrieved from discovery (typically `/token`)                                 |
| JWKS          | Retrieved from discovery (typically `/jwks.json`)                             |
| Attributes    | Retrieved from discovery (typically `/attributes/values`)                     |

### Monitoring and Operational Considerations

Implementing comprehensive monitoring helps ensure reliable operation and quick identification of issues that might affect user experience. Authentication services require specific monitoring approaches that track both technical metrics and user experience indicators.

**Critical Metrics to Monitor:**

- Authentication success and failure rates over time
- Token validation errors and their frequency
- Discovery endpoint availability and response times
- JWKS endpoint accessibility and key rotation events
- User session duration and timeout patterns
- Error rates by error type to identify common issues

**Alerting Strategy:**
Configure alerts for metrics that indicate immediate problems requiring attention. Authentication failure rates above normal baselines might indicate service issues or potential security concerns. Discovery endpoint failures prevent new authentication flows from starting. JWKS endpoint issues prevent token validation and can cause widespread authentication failures.

**User Experience Monitoring:**
Track user journey completion rates through authentication flows to identify points where users commonly abandon the process. Monitor the time users spend on ScotAccount authentication pages, as unusually long times might indicate usability issues or service performance problems.

**Security Event Logging:**
Maintain comprehensive logs of all authentication events for both operational and security purposes. Log successful authentications with user identifiers and timestamps, failed authentication attempts with error details, and any unusual patterns that might indicate security issues. Ensure logs include sufficient detail for troubleshooting whilst protecting sensitive user information.

### Support and Incident Response

Establish clear procedures for handling authentication-related user issues and service incidents. Users may experience authentication problems due to various factors including expired sessions, browser issues, or temporary service disruptions.

**Common User Issues and Resolutions:**
Authentication failures often result from expired sessions, where users have remained on your service longer than ScotAccount's session lifetime. Implement clear messaging that explains when users need to re-authenticate and provides easy ways to restart the authentication process.

Browser compatibility issues can affect the authentication flow, particularly with older browsers or those with strict security settings. Provide guidance for users about supported browsers and common browser configuration issues that might prevent successful authentication.

**Service Incident Response:**
Develop procedures for handling ScotAccount service outages or degraded performance. Consider implementing fallback authentication methods for critical services, though these should be designed carefully to maintain security standards. Establish communication procedures with the ScotAccount operations team for reporting and coordinating resolution of service issues.

**Planned Maintenance Coordination:**
Work with the ScotAccount team to understand planned maintenance schedules that might affect your service. Some maintenance activities might require temporary changes to your service behaviour or user messaging to minimise impact on user experience.

### Security Considerations for Production

Production deployment requires implementing security measures that go beyond the basic integration requirements. These measures protect both your service and your users from various security threats whilst ensuring compliance with relevant security standards.

**Key Management in Production:**
Use dedicated secret management systems that provide encryption at rest, detailed access logging, and integration with your existing security infrastructure. Implement key rotation procedures that allow you to periodically update your cryptographic keys without service interruption. Plan for emergency key replacement procedures in case of suspected key compromise.

**Network Security:**
Ensure all communication with ScotAccount uses current TLS versions and cipher suites. Configure your network infrastructure to prevent unauthorised access to systems that handle authentication tokens or user session information. Implement appropriate firewall rules that restrict access to ScotAccount APIs to only the systems that require it.

**Audit and Compliance:**
Maintain audit logs that support your organisation's compliance requirements whilst protecting user privacy. Ensure that authentication-related data handling complies with relevant data protection regulations and your organisation's data governance policies. Regular review audit logs for unusual patterns that might indicate security issues or compliance concerns.

Understanding these production considerations helps ensure that your ScotAccount integration operates reliably and securely when serving real users in a live environment. Proper preparation for production deployment reduces the likelihood of issues after go-live and ensures that your service provides a positive user experience with ScotAccount authentication.
