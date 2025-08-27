# Unresolved Documentation Issues Requiring ScotAccount Team Clarification

## Critical Issues Requiring Immediate Clarification

### 1. Authorization Code Lifetime
**Issue**: Documentation states authorization codes expire after 10 minutes
**Problem**: No source verification found in Technical Documentation.txt
**Impact**: Developers need accurate timeout for code exchange implementation
**Action Required**: Please confirm the actual authorization code lifetime and single-use policy

### 2. GPG44 vs GPG45 Inconsistency  
**Issue**: Tech doc 1.txt line 16 states "gpg44 medium" for authentication
**Problem**: All other references use "gpg45 medium"
**Impact**: Confusion about security assurance level
**Action Required**: Confirm if this is a typo or if there's a distinction between authentication (GPG44) and identity verification (GPG45)

### 3. JWT Client Assertion Required Claims
**Issue**: Documentation doesn't specify exact required claims for client assertions
**Problem**: Developers unsure which claims are mandatory vs optional
**Impact**: Authentication failures if required claims are missing
**Action Required**: Provide definitive list of required JWT claims (iss, sub, aud, exp, iat, jti, etc.)

## High Priority Clarifications Needed

### 4. Session vs Token Lifetime Interaction
**Current Understanding**:
- User sessions: 4 hours (per Tech doc 3.txt line 1130)
- Access tokens: 15 minutes
- Refresh tokens: 15 minutes
**Question**: How do 15-minute tokens work within 4-hour sessions? Is there automatic token refresh?

### 5. IP Allowlist Requirements
**Issue**: Tech doc 2.txt mentions IP allowlisting but lacks implementation details
**Questions**:
- Is IP allowlisting mandatory for production?
- What format should IP addresses be submitted in?
- How are dynamic IPs or cloud services handled?
- What's the process for updating allowlisted IPs?

### 6. Private Key Security Requirements
**Issue**: Tech doc 2.txt line 99 states keys must be "mounted using tmpfs file at runtime"
**Questions**:
- Is tmpfs mounting mandatory or a recommendation?
- Are there acceptable alternatives (e.g., HSM, secure enclaves)?
- What are the audit requirements for key management?

## Medium Priority Documentation Gaps

### 7. Verified vs Unverified Identity States
**Issue**: Documentation doesn't explain "unverified" identity verification outcome
**Source Reference**: Tech doc 1.txt line 24, Tech doc 4.txt line 233
**Action Required**: Provide details on when/why identity verification returns "unverified"

### 8. Error Recovery Patterns
**Issue**: HTTP 501 returns no error code (N/A) per source
**Question**: How should clients handle 501 responses without error codes?

### 9. DIS-Client-Assertion Audience
**Discrepancy**: Documentation shows shortened URL without "/attributes/values" path
**Source**: Tech doc 1.txt line 232 suggests full path may be needed
**Action Required**: Confirm exact audience claim value for attribute requests

## Compliance and Standards Verification

### 10. Regulatory Compliance Claims
**Unverified Claims**:
- UK GDPR compliance
- WCAG 2.1 AA accessibility standard
- Specific data retention periods
**Action Required**: Provide compliance certificates or official statements

### 11. Business Continuity
**Missing Information**:
- Planned maintenance windows
- Disaster recovery RTO/RPO
- Service degradation handling
**Action Required**: Provide operational requirements for integration planning

## Testing Environment Specifics

### 12. Integration Environment Limitations
**Questions**:
- Are there rate limits in the integration environment?
- Is test data persistence guaranteed?
- Are there scheduled resets of test data?
- What monitoring/logging is available to developers?

## Recommended Documentation Additions

### From Development Teams
Based on the fact verification, these additions would help developers:

1. **Authorization Code Exchange Timing Diagram** - Show exact timing windows
2. **JWT Claim Examples** - Complete working examples with all required claims
3. **Error Handling Flow Chart** - Visual guide for error recovery strategies
4. **Security Checklist** - Pre-production security requirements verification
5. **Migration Guide** - For services moving from test to production

## Contact for Resolution

These issues were identified during systematic fact verification of ScotAccount technical documentation on 2025-08-27. Resolution of these items is critical for accurate developer guidance and successful service integration.

**Priority Response Requested For**:
- Items 1-3 (Critical)
- Items 4-6 (High Priority)

**Documentation Version**: Based on Tech doc 1-5.txt source materials
**Verification Method**: Line-by-line comparison with updated documentation