---
layout: base.njk
title: "Testing Guide"
description: "Comprehensive testing guide for ScotAccount integration"
eleventyNavigation:
  key: testing-guide
  order: 6
---

A complete guide to testing your ScotAccount integration using the mock service, demo Relying Party, and automated testing approaches. This guide covers both manual and automated testing strategies to ensure robust integration before production deployment.

## Quick Connectivity Test

Before diving into complex integration testing, verify basic connectivity to ScotAccount services:

### Simple Health Check

```bash
# Test discovery endpoint connectivity
curl -X GET https://authz.integration.scotaccount.service.gov.scot/.well-known/openid-configuration

# Expected response: JSON configuration document
# Response time should be < 500ms
```

### Discovery Endpoint Validation

```javascript
async function testConnectivity() {
  const discoveryUrl = 'https://authz.integration.scotaccount.service.gov.scot/.well-known/openid-configuration';
  
  try {
    const response = await fetch(discoveryUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const config = await response.json();
    
    // Validate required endpoints exist
    const requiredEndpoints = [
      'authorization_endpoint',
      'token_endpoint',
      'jwks_uri',
      'issuer'
    ];
    
    for (const endpoint of requiredEndpoints) {
      if (!config[endpoint]) {
        throw new Error(`Missing ${endpoint}`);
      }
    }
    
    console.log('✓ Connectivity test passed');
    console.log('✓ All required endpoints available');
    return true;
    
  } catch (error) {
    console.error('✗ Connectivity test failed:', error);
    return false;
  }
}
```

## Testing Environments

ScotAccount provides dedicated testing environments to support your development and integration testing needs.

### Environment URLs

| Environment | Purpose | Base URL |
|-------------|---------|----------|
| **Mock Service** | Automated testing without UI | `https://mock-dis.main.integration.scotaccount.service.gov.scot/v2/` |
| **Demo RP** | Manual testing interface | `https://oidc-private-client.integration.scotaccount.service.gov.scot/integration` |
| **Demo RP (Mock)** | Demo RP pointing to mock service | `https://oidc-private-client.integration.scotaccount.service.gov.scot/mock-dis/v2/` |
| **Integration** | Full integration testing | `https://authz.integration.scotaccount.service.gov.scot` |

## Mock Service Documentation

The mock service provides a simplified ScotAccount implementation for automated testing. It bypasses user interaction whilst maintaining the same API interface as the production service.

### Mock Service URL

```
https://mock-dis.main.integration.scotaccount.service.gov.scot/v2/
```

### Mock Service Endpoints

The mock service provides three core endpoints:

1. **Authorisation Endpoint**: `/authorize`
   - Handles the authorisation process
   - Returns authorisation codes without user interaction
   
2. **Token Endpoint**: `/token`
   - Exchanges authorisation codes for tokens
   - Returns mock tokens with valid structure
   
3. **Attributes Endpoint**: `/attributes/values`
   - Returns mock verified attribute data
   - Supports all standard attribute scopes

### Important Mock Service Limitations

<div class="callout callout--warning">
<strong>Critical: Mock Service Validation Differences</strong>

The mock service does NOT validate the following security parameters:

- **code_challenge** - Value not validated (PKCE bypass)
- **code_verifier** - Value not validated (PKCE bypass)
- **client_id** - Value not validated (any client_id accepted)
- **prompt** - Parameter ignored
- **nonce** - Parameter ignored
- **JWT claims** - sub, iss, and aud claims not validated in client assertions

These limitations make the mock service unsuitable for security testing but ideal for functional testing.
</div>

### Mock Service Request Examples

#### Authorisation Request to Mock Service

```javascript
// Mock service authorisation - no user interaction required
const mockAuthUrl = new URL('https://mock-dis.main.integration.scotaccount.service.gov.scot/v2/authorize');

mockAuthUrl.searchParams.append('client_id', 'test-client'); // Any value accepted
mockAuthUrl.searchParams.append('redirect_uri', 'https://localhost:3000/callback');
mockAuthUrl.searchParams.append('response_type', 'code');
mockAuthUrl.searchParams.append('scope', 'openid gpg-45-medium');
mockAuthUrl.searchParams.append('state', 'test-state-123');
mockAuthUrl.searchParams.append('nonce', 'test-nonce-456'); // Ignored but include for compatibility
mockAuthUrl.searchParams.append('code_challenge', 'dummy-challenge'); // Not validated
mockAuthUrl.searchParams.append('code_challenge_method', 'S256');

// Mock service returns immediate redirect with auth code
// No user interaction required
```

#### Token Exchange with Mock Service

```javascript
async function getMockToken(authCode) {
  const response = await fetch('https://mock-dis.main.integration.scotaccount.service.gov.scot/v2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: 'https://localhost:3000/callback',
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: 'dummy-jwt-assertion', // Not validated
      code_verifier: 'dummy-verifier' // Not validated
    })
  });
  
  return await response.json();
}
```

#### Mock Attributes Request

```javascript
async function getMockAttributes(accessToken) {
  const response = await fetch('https://mock-dis.main.integration.scotaccount.service.gov.scot/v2/attributes/values', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'DIS-Client-Assertion': 'dummy-assertion', // Not validated
      'Content-Type': 'application/json'
    }
  });
  
  return await response.json();
}
```

### Mock Service Response Examples

#### Mock ID Token Claims

```json
{
  "sub": "mock-user-uuid-12345",
  "aud": "test-client",
  "iss": "https://mock-dis.main.integration.scotaccount.service.gov.scot/v2",
  "iat": 1676775009,
  "exp": 1676775909,
  "nonce": "test-nonce-456",
  "sid": "mock-session-id"
}
```

#### Mock Verified Attributes Response

```json
{
  "names": [
    {
      "nameParts": [
        {
          "type": "GivenName",
          "value": "Test"
        },
        {
          "type": "FamilyName",
          "value": "User"
        }
      ],
      "validFrom": "2020-01-01",
      "validUntil": "2025-12-31"
    }
  ],
  "birthDates": [
    {
      "value": "1990-01-01"
    }
  ],
  "addresses": [
    {
      "buildingNumber": "1",
      "streetName": "Test Street",
      "addressLocality": "Edinburgh",
      "postalCode": "EH1 1AA",
      "addressCountry": "GB",
      "validFrom": "2020-01-01"
    }
  ]
}
```

## Demo Relying Party Application

The Demo RP provides a web interface for manual testing of your integration configuration.

### Demo RP URLs

- **Integration Backend**: `https://oidc-private-client.integration.scotaccount.service.gov.scot/integration`
- **Mock Backend**: `https://oidc-private-client.integration.scotaccount.service.gov.scot/mock-dis/v2/`

### Using the Demo RP

1. **Access the Demo RP** at the appropriate URL
2. **Configure your parameters**:
   - Client ID (use your registered client_id for integration)
   - Redirect URI
   - Requested scopes
3. **Initiate authentication flow**
4. **Complete the authentication process**
5. **Review the returned tokens and claims**

### Demo RP Features

- Visual flow progression tracking
- Token decoding and display
- Error message display
- Request/response logging
- Scope testing interface

## Manual Testing Procedures

### Authentication Flow Testing

#### Test Case 1: Basic Authentication

```gherkin
Given a user with valid ScotAccount credentials
When the user initiates authentication with scope "openid"
Then the user should be redirected to ScotAccount login
And after successful authentication
Then an authorisation code should be returned
And the code should be exchangeable for tokens
And the ID token should contain a valid sub claim
```

#### Test Case 2: Verified Attributes Request

```gherkin
Given a user with verified identity attributes
When the user requests scope "openid gpg-45-medium"
Then the user should see a consent screen
And after granting consent
Then verified attributes should be retrievable
And attributes should match the requested scope
```

#### Test Case 3: User Cancellation

```gherkin
Given a user at the ScotAccount login screen
When the user cancels the authentication
Then the user should be redirected with error "access_denied"
And the error_description should indicate cancellation
And the state parameter should be preserved
```

### Manual Testing Checklist

- [ ] **Discovery endpoint accessible**
- [ ] **JWKS endpoint returns valid keys**
- [ ] **Authentication flow completes successfully**
- [ ] **State parameter validated correctly**
- [ ] **Nonce claim present in ID token**
- [ ] **Session management working (4-hour timeout)**
- [ ] **Logout flow completes successfully**
- [ ] **Error handling for invalid parameters**
- [ ] **Verified attributes retrieval (if applicable)**
- [ ] **Token expiration handled correctly**

## Automated Testing Approaches

### Unit Testing PKCE Implementation

```javascript
describe('PKCE Implementation', () => {
  test('should generate valid code verifier', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9-._~]{43,128}$/);
  });
  
  test('should generate correct code challenge', () => {
    const verifier = 'test-verifier-string';
    const challenge = generateCodeChallenge(verifier);
    
    // Verify SHA256 hash
    const expected = base64UrlEncode(
      crypto.createHash('sha256').update(verifier).digest()
    );
    
    expect(challenge).toBe(expected);
  });
  
  test('should handle state persistence', () => {
    const state = generateState();
    sessionStorage.setItem('oauth_state', state);
    
    // Simulate callback
    const returnedState = state;
    expect(validateState(returnedState)).toBe(true);
  });
});
```

### Integration Testing with Mock Service

```javascript
describe('ScotAccount Integration', () => {
  const mockServiceBase = 'https://mock-dis.main.integration.scotaccount.service.gov.scot/v2';
  
  beforeEach(() => {
    // Setup test client
    this.client = new ScotAccountClient({
      baseUrl: mockServiceBase,
      clientId: 'test-client',
      redirectUri: 'http://localhost:3000/callback'
    });
  });
  
  test('should complete full authentication flow', async () => {
    // Start authentication
    const authUrl = await this.client.createAuthUrl({
      scope: 'openid',
      state: 'test-state',
      nonce: 'test-nonce'
    });
    
    expect(authUrl).toContain('/authorize');
    expect(authUrl).toContain('client_id=test-client');
    
    // Simulate authorisation callback
    const authCode = 'mock-auth-code';
    
    // Exchange code for tokens
    const tokens = await this.client.exchangeCode(authCode);
    
    expect(tokens).toHaveProperty('access_token');
    expect(tokens).toHaveProperty('id_token');
    
    // Decode and validate ID token (mock service doesn't sign properly)
    const idToken = decodeJwt(tokens.id_token);
    expect(idToken.sub).toBeTruthy();
    expect(idToken.aud).toBe('test-client');
  });
  
  test('should retrieve verified attributes', async () => {
    // Get access token first
    const tokens = await this.client.authenticate();
    
    // Request attributes
    const attributes = await this.client.getAttributes(tokens.access_token);
    
    expect(attributes).toHaveProperty('names');
    expect(attributes.names[0]).toHaveProperty('nameParts');
  });
  
  test('should handle errors correctly', async () => {
    // Test with invalid auth code
    await expect(
      this.client.exchangeCode('invalid-code')
    ).rejects.toThrow('invalid_grant');
  });
});
```

### End-to-End Testing

```javascript
describe('E2E Authentication Flow', () => {
  test('should complete authentication with real interaction', async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    try {
      // Navigate to your application
      await page.goto('http://localhost:3000');
      
      // Click login button
      await page.click('#login-button');
      
      // Wait for redirect to ScotAccount
      await page.waitForNavigation();
      expect(page.url()).toContain('scotaccount.service.gov.scot');
      
      // For mock service, authentication is automatic
      // For integration environment, you would need test credentials
      
      // Wait for callback
      await page.waitForFunction(
        () => window.location.pathname === '/callback'
      );
      
      // Verify successful authentication
      const userInfo = await page.evaluate(() => {
        return JSON.parse(localStorage.getItem('user'));
      });
      
      expect(userInfo).toHaveProperty('sub');
      
    } finally {
      await browser.close();
    }
  });
});
```

### Load Testing

```javascript
const loadTest = async () => {
  const scenarios = [
    {
      name: 'Authentication Flow',
      weight: 70, // 70% of traffic
      fn: async () => {
        await testAuthenticationFlow();
      }
    },
    {
      name: 'Token Exchange',
      weight: 20, // 20% of traffic
      fn: async () => {
        await testTokenExchange();
      }
    },
    {
      name: 'Attribute Retrieval',
      weight: 10, // 10% of traffic
      fn: async () => {
        await testAttributeRetrieval();
      }
    }
  ];
  
  // Run load test
  const results = await runLoadTest({
    scenarios,
    duration: 300, // 5 minutes
    rampUp: 60, // 1 minute ramp-up
    targetRPS: 10 // 10 requests per second
  });
  
  // Analyse results
  console.log('Load Test Results:');
  console.log(`Average response time: ${results.avgResponseTime}ms`);
  console.log(`95th percentile: ${results.p95}ms`);
  console.log(`Error rate: ${results.errorRate}%`);
};
```

## Test Data Management

### Mock User Profiles

The mock service supports different user profiles based on the requested scopes:

| Scope | Mock Data Returned |
|-------|-------------------|
| `openid` | Basic user identifier only |
| `openid gpg-45-low` | Name and date of birth |
| `openid gpg-45-medium` | Name, date of birth, and address |
| `openid gpg-45-high` | All available attributes |

### Test Data Examples

```javascript
const testUsers = {
  basic: {
    sub: 'test-user-001',
    name: 'Test User'
  },
  verified: {
    sub: 'test-user-002',
    name: 'Verified User',
    birthDate: '1990-01-01',
    address: {
      street: '1 Test Street',
      city: 'Edinburgh',
      postcode: 'EH1 1AA'
    }
  }
};
```

## Security Testing Considerations

### What the Mock Service Does NOT Test

<div class="callout callout--danger">
<strong>Warning: Security Features Not Tested by Mock Service</strong>

The mock service cannot be used to test:
- PKCE security (code_challenge/code_verifier validation)
- Client authentication (client_id validation)
- JWT signature validation
- Token expiration
- Rate limiting
- Session security
- Nonce validation

Always perform security testing against the integration environment with proper validation enabled.
</div>

### Security Test Cases for Integration Environment

```javascript
describe('Security Tests (Integration Environment)', () => {
  test('should reject invalid code_verifier', async () => {
    const validVerifier = generateCodeVerifier();
    const validChallenge = generateCodeChallenge(validVerifier);
    
    // Get auth code with valid challenge
    const authCode = await getAuthCode(validChallenge);
    
    // Try to exchange with wrong verifier
    const wrongVerifier = 'wrong-verifier';
    
    await expect(
      exchangeCode(authCode, wrongVerifier)
    ).rejects.toThrow('invalid_grant');
  });
  
  test('should reject expired JWT assertions', async () => {
    const expiredJwt = generateJwt({
      exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
    });
    
    await expect(
      exchangeCodeWithAssertion(authCode, expiredJwt)
    ).rejects.toThrow('invalid_client');
  });
  
  test('should enforce nonce validation', async () => {
    const nonce = 'test-nonce-123';
    const tokens = await authenticateWithNonce(nonce);
    
    const idToken = decodeAndVerifyJwt(tokens.id_token);
    expect(idToken.nonce).toBe(nonce);
  });
});
```

## Performance Testing

### Response Time Benchmarks

Expected response times for integration environment:

| Endpoint | Expected Response Time | Maximum Acceptable |
|----------|----------------------|-------------------|
| Discovery | < 200ms | 500ms |
| Authorise (redirect) | < 300ms | 1000ms |
| Token Exchange | < 500ms | 2000ms |
| Attributes | < 400ms | 1500ms |

### Performance Test Implementation

```javascript
async function performanceTest() {
  const metrics = {
    discovery: [],
    token: [],
    attributes: []
  };
  
  // Test discovery endpoint
  for (let i = 0; i < 100; i++) {
    const start = Date.now();
    await fetch(DISCOVERY_URL);
    metrics.discovery.push(Date.now() - start);
  }
  
  // Calculate statistics
  const stats = calculateStats(metrics.discovery);
  console.log(`Discovery Endpoint:`);
  console.log(`  Average: ${stats.mean}ms`);
  console.log(`  P95: ${stats.p95}ms`);
  console.log(`  P99: ${stats.p99}ms`);
  
  // Assert performance requirements
  expect(stats.p95).toBeLessThan(500);
}
```

## Troubleshooting Common Test Issues

### Mock Service Issues

| Issue | Cause | Resolution |
|-------|-------|------------|
| No auth code returned | Invalid redirect_uri format | Ensure redirect_uri is properly URL-encoded |
| Token exchange fails | Malformed request | Check Content-Type header is `application/x-www-form-urlencoded` |
| Attributes return empty | Wrong endpoint URL | Verify using `/v2/attributes/values` endpoint |
| CORS errors | Direct browser requests | Use server-side requests or proxy |

### Integration Environment Issues

| Issue | Cause | Resolution |
|-------|-------|------------|
| Invalid client error | Unregistered client_id | Confirm registration with ScotAccount team |
| PKCE validation fails | Incorrect challenge method | Ensure using SHA256 (`S256`) method |
| Session timeout | 4-hour limit exceeded | Implement session refresh logic |
| Signature validation fails | Wrong public key | Fetch current keys from JWKS endpoint |

## Test Report Template

```markdown
## ScotAccount Integration Test Report

**Date**: [Date]
**Environment**: [Mock/Integration]
**Test Suite Version**: [Version]

### Test Summary
- Total Tests: [Number]
- Passed: [Number]
- Failed: [Number]
- Skipped: [Number]

### Functional Tests
- [ ] Discovery endpoint configuration
- [ ] Authentication flow
- [ ] Token exchange
- [ ] ID token validation
- [ ] Attribute retrieval
- [ ] Session management
- [ ] Logout flow

### Security Tests
- [ ] PKCE validation
- [ ] State parameter validation
- [ ] Nonce validation
- [ ] JWT signature verification
- [ ] Token expiration
- [ ] Client authentication

### Performance Tests
- Discovery endpoint: [X]ms average
- Token exchange: [X]ms average
- Attribute retrieval: [X]ms average

### Issues Found
1. [Issue description and severity]
2. [Issue description and severity]

### Recommendations
- [Recommendation 1]
- [Recommendation 2]
```

## Next Steps

After completing testing:

1. **Review test coverage** - Ensure all integration points are tested
2. **Document test results** - Maintain test reports for audit purposes
3. **Plan production migration** - Create deployment checklist
4. **Implement monitoring** - Set up production monitoring based on test metrics
5. **Schedule security review** - Arrange penetration testing if required

## Related Documentation

- [Getting Started]({{ '/getting-started/' | url }}) - Initial setup and configuration
- [Error Reference]({{ '/error-reference/' | url }}) - Complete error code documentation
- [Implementation Guide]({{ '/scotaccount-guide/' | url }}) - Detailed technical implementation