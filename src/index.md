---
layout: base.njk
title: "ScotAccount Technical Documentation"
description: "Scotland's centralised digital identity service providing secure user authentication and access to verified personal information for government services"
eleventyNavigation:
  key: home
  order: 1
---

## What ScotAccount Provides

ScotAccount offers two distinct and complementary capabilities for government services:

### 1. User Authentication
- **Persistent User Identity**: Each user receives a unique UUID that remains constant across all interactions
- **GPG45 Medium Assurance**: High confidence in user identity through comprehensive verification processes
- **Single Sign-On**: Users authenticate once and access multiple government services seamlessly
- **OpenID Connect Standard**: Built on industry-standard protocols with PKCE for enhanced security

### 2. Verified Attributes Access
- **Identity Data**: Independently verified name and date of birth (GPG45 Medium level)
- **Address Information**: Current address verified through credit reference agency checks
- **Email Verification**: Confirmed email address through verification loops
- **Mobile Verification**: Confirmed mobile number through SMS verification
- **Cross-Device Support**: Users can start verification on one device and complete on another
- **7-Day Flow Persistence**: Verification states persist for up to 7 days for user convenience

### Key Distinctions

**Authentication vs Verified Attributes**: Authentication establishes who the user is with a persistent UUID. Verified attributes provide additional verified personal information that users explicitly consent to share. Services can use authentication alone or combine it with verified attributes based on their specific needs.

**Session Management**: User sessions last up to 4 hours, with access tokens expiring after 15 minutes. Verification flows remain valid for 7 days to accommodate complex verification processes that may require time to complete.

## Quick Access to Key Resources

### New to ScotAccount?
- **[Getting Started Guide]({{ '/getting-started/' | url }})** - Understand the basics and set up your first integration
- **[Architecture Overview]({{ '/architecture/' | url }})** - System components and data flows
- **[Current Data Schema]({{ '/scotaccount-currentschema/' | url }})** - Complete JSON schema reference for all data structures

### Ready to Integrate?
- **[Implementation Guide]({{ '/scotaccount-guide/' | url }})** - Step-by-step technical implementation
- **[Complete Guide]({{ '/scotaccount-complete-guide/' | url }})** - Comprehensive implementation with detailed explanations
- **[Token Validation Module]({{ '/scotaccount-token-validation-module/' | url }})** - Secure token verification patterns

### Need Examples?
- **[Integration Examples]({{ '/integration-examples/' | url }})** - Working code examples and implementation patterns
- **[Testing Guide]({{ '/testing-guide/' | url }})** - Mock service setup and testing scenarios
- **[Error Reference]({{ '/error-reference/' | url }})** - Complete error codes and resolution strategies

### Testing Environment Links
- **Integration Environment**: `https://integration.scotaccount.service.gov.scot`
- **Mock Service**: `https://mock.scotaccount.service.gov.scot`
- **JWKS Endpoint**: `https://integration.scotaccount.service.gov.scot/.well-known/jwks.json`
- **OpenID Configuration**: `https://integration.scotaccount.service.gov.scot/.well-known/openid_configuration`

## Integration Journey

### Phase 1: Planning and Setup

1. Review architecture and requirements
2. Set up development environment
3. Configure initial authentication flow

### Phase 2: Implementation

1. Implement OpenID Connect authentication
2. Add token validation
3. Integrate verified attributes

### Phase 3: Testing and Deployment

1. Test with mock or integration environment
2. Verify all of your journeys and scenario permutations.
3. Production deployment and monitoring

## Core Features

### Authentication

- **Persistent User Identity**: Each user receives a unique UUID that never changes
- **GPG45 Medium Assurance**: High confidence in user verified identity
- **Single Sign-On**: Users authenticate once across multiple government services
- **Secure by Design**: Built on OpenID Connect with PKCE, state management, and JWT validation

### Verified Attributes

| Attribute    | Verification Method                | Use Cases                                     |
| ------------ | ---------------------------------- | --------------------------------------------- |
| **Identity** | GPG45 Medium identity verification | Legal identity confirmation, age verification |
| **Address**  | Credit reference agency checks     | Service delivery, eligibility verification    |
| **Email**    | Email confirmation loop            | Service communications, account recovery      |
| **Mobile**   | Text Message confirmation loop     | Service communications, account recovery      |

### Extended Verification Support

ScotAccount uniquely handles verification processes that can minutes or days:

- Users can start verification on one device and verify information on their mobile.
- Progress is automatically saved and resumed
- Your service receives results when verification completes

## Why Choose ScotAccount?

### For Government Services

- **Reduced Development Time**: No need to build authentication systems
- **Enhanced Security**: Built-in protection against common web attacks
- **Compliance Ready**: Data protection and audit capabilities included
- **Verified Data**: Access to independently validated user information

### For Users

- **Single Account**: One login for multiple government services
- **Data Control**: Users choose what information to share with each service
- **Secure Experience**: Industry-standard security with user-friendly interface
- **Device Flexibility**: Complete verification across multiple devices

### For Technical Teams

- **Standards-Based**: Built on OpenID Connect
- **Comprehensive Documentation**: Complete guides and working examples
- **Testing Tools**: Mock service for rapid development and testing
- **Production Support**: Dedicated support for live service operation

## Critical Implementation Reminders

<div class="callout callout--warning">
<strong>Session Timeouts</strong>: User sessions last 4 hours, access tokens expire after 15 minutes, and verification flows remain valid for 7 days. Plan your user experience accordingly.
</div>

<div class="callout callout--danger">
<strong>JWKS Key Rotation</strong>: Always fetch the latest JWKS before starting new flows. Keys rotate regularly for security. See our <a href="{{ '/scotaccount-complete-guide/' | url }}#jwks-handling">JWKS handling guide</a>.
</div>

<div class="callout callout--info">
<strong>GPG45 Timeline Warning</strong>: Cross-device verification flows can take minutes to days to complete. Design your service to handle asynchronous verification results appropriately.
</div>

## Next Steps by Role

<div class="callout callout--info">
<strong>New to ScotAccount?</strong> Start with our <a href="{{ '/getting-started/' | url }}">Getting Started guide</a> to understand the basics and set up your first integration.
</div>

<div class="callout callout--success">
<strong>Ready to integrate?</strong> Follow the <a href="{{ '/scotaccount-guide/' | url }}">Implementation Guide</a> for step-by-step technical instructions with common pitfalls guidance.
</div>

<div class="callout callout--primary">
<strong>Need examples?</strong> Explore <a href="{{ '/integration-examples/' | url }}">working code examples</a> and use our comprehensive <a href="{{ '/testing-guide/' | url }}">testing scenarios</a>.
</div>

<div class="callout callout--warning">
<strong>Need architecture details?</strong> Review the <a href="{{ '/architecture/' | url }}">Architecture Overview</a> to understand system components and data flows.
</div>

## Business Rules Summary

- **Single Flow Requirement**: Authentication must complete before requesting verified attributes
- **User Consent**: Users explicitly consent to each attribute request during the flow
- **Data Freshness**: Attribute data reflects verification status at time of request - not stored permanently
- **DIS-Client-Assertion**: Required header for all attribute requests - see <a href="{{ '/scotaccount-complete-guide/' | url }}#client-assertion">implementation details</a>
- **State Persistence**: Maintain state for 7 days to support cross-device verification flows
