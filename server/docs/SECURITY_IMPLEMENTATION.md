# EcoCycle Security Implementation

## Overview

This document describes the comprehensive security middleware implementation for the EcoCycle waste management platform, fulfilling **Requirement 1.4: THE EcoCycle_System SHALL enforce HTTPS for all authentication endpoints**.

## Security Features Implemented

### 1. HTTPS Enforcement

**Location**: `server/middleware/securityMiddleware.js` - `httpsEnforcement`

- **Strict HTTPS enforcement** for authentication endpoints (`/api/auth/*`)
- **Enhanced protection** for sensitive data endpoints (`/api/admin/*`, `/api/users/*`, `/api/ecopoints/*`)
- **Automatic HTTPS redirect** for non-sensitive endpoints in production
- **Development environment bypass** for local testing
- **Comprehensive logging** of security violations

**Implementation Details**:
- Returns HTTP 426 (Upgrade Required) for HTTP requests to secure endpoints
- Checks multiple HTTPS indicators: `req.secure`, `x-forwarded-proto`, `x-forwarded-ssl`, `req.connection.encrypted`
- Provides detailed error responses with redirect URLs

### 2. Security Headers

**Location**: `server/middleware/securityMiddleware.js` - `securityHeaders`

Implements comprehensive security headers using Helmet.js:

- **Content Security Policy (CSP)**: Prevents XSS attacks
- **HTTP Strict Transport Security (HSTS)**: Forces HTTPS connections
- **X-Frame-Options**: Prevents clickjacking attacks
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **X-XSS-Protection**: Enables browser XSS filtering
- **Referrer Policy**: Controls referrer information
- **Permissions Policy**: Controls browser features
- **Expect-CT**: Certificate transparency enforcement

### 3. CORS Configuration

**Location**: `server/middleware/securityMiddleware.js` - `corsConfig`

- **Environment-specific origin control**
- **Production whitelist**: Only allows verified frontend domains
- **Development flexibility**: Allows localhost with any port
- **Credential support**: Enables secure cookie transmission
- **Comprehensive headers**: Supports all necessary request headers

### 4. Rate Limiting

**Location**: `server/middleware/securityMiddleware.js` - `authRateLimit`, `generalRateLimit`

#### Authentication Rate Limiting
- **5 requests per 15 minutes** for authentication endpoints
- **Aggressive protection** against brute force attacks
- **Detailed logging** of rate limit violations
- **Skip successful requests** to avoid penalizing legitimate users

#### General API Rate Limiting
- **100 requests per 15 minutes** for general endpoints
- **Balanced protection** without hindering normal usage
- **Configurable via environment variables**

### 5. Progressive Slow Down

**Location**: `server/middleware/securityMiddleware.js` - `authSlowDown`

- **Progressive delays** for repeated authentication attempts
- **500ms delay increment** after 2 requests
- **Maximum 20-second delay** to prevent DoS
- **Automatic recovery** after the time window

### 6. Input Sanitization

**Location**: `server/middleware/securityMiddleware.js` - `inputSanitization`

- **XSS prevention**: Removes script tags and JavaScript protocols
- **Event handler removal**: Strips dangerous event attributes
- **Prototype pollution protection**: Prevents dangerous object keys
- **Recursive sanitization**: Handles nested objects and arrays

### 7. Request Tracking

**Location**: `server/middleware/securityMiddleware.js` - `requestId`

- **Unique request IDs** for security monitoring
- **Request correlation** across logs
- **Security audit trails**

### 8. Security Logging

**Location**: `server/middleware/securityMiddleware.js` - `securityLogging`

- **Authentication attempt monitoring**
- **Failed login tracking**
- **Security violation logging**
- **Performance metrics** for security endpoints

### 9. Content Validation

**Location**: `server/middleware/securityMiddleware.js` - `contentTypeValidation`, `bodySizeLimit`

- **Content-Type validation**: Ensures proper JSON content
- **Payload size limits**: Prevents large payload attacks (10MB limit)
- **Request validation**: Validates security headers

### 10. Authentication Monitoring

**Location**: `server/middleware/securityMiddleware.js` - `authAttemptMonitoring`

- **Real-time authentication tracking**
- **Failed attempt analysis**
- **Client information logging**
- **Response time monitoring**

## Configuration

### Environment Variables

```env
# Security Configuration
NODE_ENV = development
HTTPS_REDIRECT = true
SECURITY_LOGGING = true
RATE_LIMIT_WINDOW_MS = 900000
AUTH_RATE_LIMIT_MAX = 5
GENERAL_RATE_LIMIT_MAX = 100

# CORS Configuration
ALLOWED_ORIGINS = http://localhost:5173,http://localhost:3000
PRODUCTION_ORIGIN = https://ecocycle-frontend.vercel.app

# Security Headers
CSP_REPORT_URI = /api/security/csp-report
HSTS_MAX_AGE = 31536000
```

### Middleware Order

The security middleware is applied in the following order for optimal protection:

1. **Request ID**: Tracking and correlation
2. **HTTPS Enforcement**: Force secure connections
3. **Security Headers**: Apply protective headers
4. **CORS Configuration**: Control cross-origin requests
5. **Security Logging**: Monitor security events
6. **Body Size Limit**: Prevent large payloads
7. **Content Type Validation**: Validate request format
8. **Input Sanitization**: Clean user input
9. **Security Headers Validation**: Verify security headers

## Security Endpoints

### CSP Violation Reporting

**Endpoint**: `POST /api/security/csp-report`

- Receives Content Security Policy violation reports
- Logs security violations for analysis
- Returns 204 No Content as per CSP specification

### Security Health Check

**Endpoint**: `GET /api/security/health`

- Provides security configuration status
- Returns current security settings
- Useful for monitoring and debugging

## Testing

### Test Coverage

The security middleware includes comprehensive tests covering:

- **HTTPS enforcement** for all authentication endpoints
- **Sensitive endpoint protection** (admin, users, ecopoints)
- **Input sanitization** against XSS attacks
- **Request ID generation** and tracking
- **Property-based testing** for HTTPS enforcement

### Running Tests

```bash
cd server
npm test
```

All tests validate the security requirements and ensure proper protection against common web vulnerabilities.

## Security Compliance

This implementation addresses the following security requirements:

- ✅ **Requirement 1.4**: HTTPS enforcement for authentication endpoints
- ✅ **OWASP Top 10 Protection**: XSS, injection, security misconfiguration
- ✅ **Rate Limiting**: Brute force attack prevention
- ✅ **Input Validation**: Malicious input sanitization
- ✅ **Security Headers**: Comprehensive browser protection
- ✅ **CORS Security**: Cross-origin request control
- ✅ **Audit Logging**: Security event monitoring

## Monitoring and Alerting

The security middleware provides extensive logging for:

- Authentication attempts and failures
- Rate limit violations
- HTTPS enforcement violations
- Input sanitization events
- CSP violations
- Security header warnings

All security events are logged with:
- Timestamp
- IP address
- User agent
- Request ID
- Endpoint path
- Security violation type

## Production Deployment

For production deployment, ensure:

1. **Environment variables** are properly configured
2. **HTTPS certificates** are valid and properly configured
3. **Rate limiting** is appropriate for expected traffic
4. **Security monitoring** is in place
5. **Log aggregation** is configured for security analysis

## Future Enhancements

Potential security improvements:

- **IP-based blocking** for repeated violations
- **Geolocation-based access control**
- **Advanced bot detection**
- **Security metrics dashboard**
- **Automated threat response**