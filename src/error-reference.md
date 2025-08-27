---
layout: base.njk
title: "Error Reference"
description: "Complete error code reference for ScotAccount integration"
eleventyNavigation:
  key: error-reference
  order: 7
---

A comprehensive reference for all error codes and responses you may encounter when integrating with ScotAccount. Understanding these error codes and their resolution strategies is critical for robust error handling in production environments.

## Error Response Format

All error responses from ScotAccount follow the OAuth 2.0 error response specification. Error responses are returned as JSON with appropriate HTTP status codes.

### Standard Error Response Structure

```json
{
  "error": "error_code",
  "error_description": "Human-readable error description"
}
```

## Authorisation Endpoint Errors

The authorisation endpoint (`/authorize`) returns errors via HTTP 302 redirects to your registered redirect_uri, with error parameters appended to the query string.

### 302 Redirect Error Format

```
https://yourservice.gov.scot/callback?
  error=access_denied&
  error_description=User+cancelled+authentication&
  state=your-state-value
```

### Common Authorisation Errors

| Error Code | Description | Resolution |
|------------|-------------|------------|
| `invalid_request` | Missing or invalid required parameters | Verify all required parameters are present and correctly formatted |
| `unauthorised_client` | Client not authorised for this request | Confirm client_id is correct and registered |
| `access_denied` | User denied the authorisation request | Handle user cancellation gracefully |
| `unsupported_response_type` | Response type not supported | Use `response_type=code` only |
| `invalid_scope` | Requested scope is invalid or unknown | Verify scope values against documentation |
| `server_error` | Unexpected server error | Retry with exponential backoff |
| `temporarily_unavailable` | Service temporarily unavailable | Retry after indicated time |

### Authorisation Error Handling Example

```javascript
// Handle authorisation callback errors
app.get('/auth/callback', (req, res) => {
  // Check for error parameter first
  if (req.query.error) {
    console.error(`Auth error: ${req.query.error}`);
    console.error(`Description: ${req.query.error_description}`);
    
    // Handle specific error types
    switch(req.query.error) {
      case 'access_denied':
        // User cancelled - redirect to login
        return res.redirect('/login?cancelled=true');
      
      case 'invalid_scope':
        // Configuration error - alert developers
        alertDevelopers('Invalid scope configuration');
        return res.status(500).send('Configuration error');
      
      default:
        // Generic error handling
        return res.status(500).send('Authentication failed');
    }
  }
  
  // Continue with normal flow if no error
  // ...
});
```

## Token Endpoint Errors

The token endpoint (`/token`) returns errors as JSON responses with appropriate HTTP status codes.

### HTTP Status Codes and Errors

| HTTP Code | Error Code | Description | Resolution |
|-----------|------------|-------------|------------|
| **400** | `invalid_request` | Malformed request or missing parameters | Verify request format and all required parameters |
| **400** | `invalid_client` | Client authentication failed | Check client_assertion JWT signature and claims |
| **400** | `invalid_grant` | Authorisation code invalid or expired | Ensure code is used within validity period |
| **400** | `unauthorised_client` | Client not authorised for grant type | Verify client configuration with ScotAccount team |
| **400** | `unsupported_grant_type` | Grant type not supported | Use `grant_type=authorization_code` only |
| **400** | `invalid_scope` | Requested scope exceeds authorised scope | Request only scopes authorised during authentication |
| **401** | `access_denied` | Token not valid | Verify token validity and permissions |
| **403** | `access_denied` | Access denied for this resource | Check client permissions |
| **500** | `internal_server_error` | Internal server error | Contact ScotAccount support if persistent |
| **501** | `server_error` | Not implemented | Feature not available |
| **502** | `bad_gateway` | Backend service unavailable | Retry with exponential backoff |
| **503** | `internal_server_error` | Internal server error | Contact ScotAccount support if persistent |

### Example Token Error Response

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "invalid_grant",
  "error_description": "Authorization code has expired"
}
```

### Token Error Handling Example

```javascript
async function exchangeCodeForToken(code, codeVerifier) {
  try {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: generateClientAssertion(),
        code_verifier: codeVerifier
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      
      // Handle specific error types
      switch(error.error) {
        case 'invalid_grant':
          // Code expired or already used
          throw new AuthError('Authentication expired. Please login again.');
          
        case 'invalid_client':
          // Client assertion issue
          console.error('Client authentication failed - check JWT signing');
          throw new AuthError('Configuration error');
          
        case 'invalid_request':
          // Missing or malformed parameters
          console.error(`Invalid request: ${error.error_description}`);
          throw new AuthError('Request formatting error');
          
        default:
          throw new AuthError(`Token exchange failed: ${error.error}`);
      }
    }
    
    return await response.json();
  } catch (err) {
    console.error('Token exchange error:', err);
    throw err;
  }
}
```

## Attributes Endpoint Errors

The attributes endpoint (`/attributes/values`) returns errors when requesting verified attributes.

### HTTP Status Codes and Errors

| HTTP Code | Error Code | Description | Resolution |
|-----------|------------|-------------|------------|
| **401** | `access_denied` | Invalid or expired access token | Request new access token |
| **402** | `invalid_session_id` | Session expired or invalid SID | User must re-authenticate |
| **403** | `access_denied` | Token not valid or insufficient permissions | Verify token and scopes |
| **404** | `not_found` | No data available for user | Handle gracefully - user may not have verified attributes |
| **500** | `internal_server_error` | Server error occurred | Retry with exponential backoff |
| **502** | `bad_gateway` | Backend service error | Retry after delay |
| **503** | `service_unavailable` | Service temporarily unavailable | Implement retry logic with backoff |

### Example Attributes Error Response

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "error": "access_denied",
  "error_description": "Access token has expired"
}
```

### Attributes Error Handling Example

```javascript
async function fetchVerifiedAttributes(accessToken) {
  const maxRetries = 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      const response = await fetch(ATTRIBUTES_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'DIS-Client-Assertion': generateClientAssertion(),
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status === 404) {
        // User has no verified attributes - this is valid
        return { hasAttributes: false };
      }
      
      if (response.status === 401 || response.status === 403) {
        // Token invalid - need new token
        throw new AuthError('Authentication required');
      }
      
      if (response.status >= 500) {
        // Server error - retry with backoff
        attempt++;
        if (attempt >= maxRetries) {
          throw new Error('Service unavailable after retries');
        }
        await sleep(Math.pow(2, attempt) * 1000); // Exponential backoff
        continue;
      }
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Attributes error: ${error.error_description}`);
      }
      
      return await response.json();
      
    } catch (err) {
      if (attempt >= maxRetries - 1) throw err;
      attempt++;
      await sleep(Math.pow(2, attempt) * 1000);
    }
  }
}
```

## Error Recovery Strategies

### Retry Logic Implementation

```javascript
class ScotAccountClient {
  async retryWithBackoff(fn, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        
        // Check if error is retryable
        if (this.isRetryableError(error)) {
          const delay = Math.min(1000 * Math.pow(2, i), 10000);
          await this.sleep(delay);
        } else {
          throw error; // Non-retryable error
        }
      }
    }
  }
  
  isRetryableError(error) {
    // Retry on 5xx errors and specific 4xx errors
    const retryableCodes = [500, 502, 503, 429];
    return retryableCodes.includes(error.statusCode);
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Session Management

```javascript
class SessionManager {
  handleSessionError(error) {
    switch(error.code) {
      case 402: // Session expired
        // Clear local session
        this.clearSession();
        // Redirect to login
        window.location.href = '/login?reason=session_expired';
        break;
        
      case 401: // Token expired
        // Attempt token refresh if available
        if (this.canRefresh()) {
          return this.refreshToken();
        }
        // Otherwise re-authenticate
        window.location.href = '/login?reason=token_expired';
        break;
        
      default:
        // Log unexpected errors
        console.error('Unexpected session error:', error);
        this.handleGenericError(error);
    }
  }
}
```

## Best Practices for Error Handling

### 1. Comprehensive Logging

```javascript
function logError(context, error, additionalData = {}) {
  const errorLog = {
    timestamp: new Date().toISOString(),
    context: context,
    error: {
      code: error.code,
      message: error.message,
      description: error.error_description
    },
    ...additionalData
  };
  
  // Send to logging service
  logger.error(errorLog);
  
  // Also log locally in development
  if (process.env.NODE_ENV === 'development') {
    console.error('ScotAccount Error:', errorLog);
  }
}
```

### 2. User-Friendly Error Messages

Map technical errors to user-friendly messages:

```javascript
const ERROR_MESSAGES = {
  'invalid_grant': 'Your session has expired. Please log in again.',
  'access_denied': 'You cancelled the login process.',
  'invalid_scope': 'We encountered a configuration issue. Please contact support.',
  'server_error': 'The service is temporarily unavailable. Please try again later.',
  'not_found': 'No verified information is available for your account.',
  'default': 'An unexpected error occurred. Please try again.'
};

function getUserMessage(errorCode) {
  return ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.default;
}
```

### 3. Error Monitoring and Alerting

```javascript
class ErrorMonitor {
  constructor() {
    this.errorCounts = new Map();
    this.alertThreshold = 5;
    this.windowMs = 60000; // 1 minute window
  }
  
  trackError(errorType) {
    const now = Date.now();
    const key = `${errorType}-${Math.floor(now / this.windowMs)}`;
    
    const count = (this.errorCounts.get(key) || 0) + 1;
    this.errorCounts.set(key, count);
    
    if (count >= this.alertThreshold) {
      this.sendAlert(errorType, count);
    }
    
    // Clean old entries
    this.cleanOldEntries(now);
  }
  
  sendAlert(errorType, count) {
    // Send to monitoring service
    alerting.notify({
      severity: 'warning',
      message: `High error rate detected: ${errorType} (${count} errors/minute)`,
      service: 'scotaccount-integration'
    });
  }
}
```

## Testing Error Scenarios

### Simulating Errors in Development

```javascript
class MockScotAccountService {
  constructor(errorMode = null) {
    this.errorMode = errorMode;
  }
  
  async authorize(params) {
    if (this.errorMode === 'invalid_scope') {
      throw {
        error: 'invalid_scope',
        error_description: 'Requested scope not available'
      };
    }
    // Normal flow
    return { code: 'mock-auth-code', state: params.state };
  }
  
  async exchangeToken(code) {
    if (this.errorMode === 'expired_code') {
      throw {
        status: 400,
        error: 'invalid_grant',
        error_description: 'Authorization code expired'
      };
    }
    // Normal flow
    return { access_token: 'mock-token', id_token: 'mock-id-token' };
  }
}
```

## Support and Escalation

### When to Contact Support

Contact the ScotAccount support team when encountering:

- Persistent 500-series errors after retry attempts
- Unexpected 400-series errors with valid requests
- Error patterns that indicate service degradation
- Errors not documented in this reference

### Information to Provide

When reporting errors, include:

1. **Error details**: HTTP status code, error code, and description
2. **Request details**: Endpoint, parameters (excluding sensitive data)
3. **Timestamp**: When the error occurred
4. **Frequency**: How often the error occurs
5. **Client ID**: Your registered client identifier
6. **Environment**: Integration or production
7. **Correlation ID**: If provided in error response

## Related Documentation

- [Testing Guide]({{ '/testing-guide/' | url }}) - Test error scenarios in mock environment
- [Getting Started]({{ '/getting-started/' | url }}) - Basic integration setup
- [Implementation Guide]({{ '/scotaccount-guide/' | url }}) - Detailed technical implementation