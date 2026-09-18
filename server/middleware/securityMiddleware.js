import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import cors from 'cors';

/**
 * HTTPS Enforcement Middleware
 * Redirects HTTP requests to HTTPS in production
 * Validates: Requirements 1.4 - HTTPS enforcement for authentication endpoints
 */
export const httpsEnforcement = (req, res, next) => {
    // Skip HTTPS enforcement in development and test environments
    if (process.env.NODE_ENV !== 'production') {
        return next();
    }

    // Check if request is already HTTPS
    const isHttps = req.secure || 
                   req.headers['x-forwarded-proto'] === 'https' ||
                   req.headers['x-forwarded-ssl'] === 'on' ||
                   req.connection.encrypted;

    if (!isHttps) {
        // Log security violation for monitoring
        console.warn(`[SECURITY] HTTP request to secure endpoint - IP: ${req.ip}, Path: ${req.path}, User-Agent: ${req.get('User-Agent')}`);
        
        // For authentication endpoints, enforce HTTPS strictly
        if (req.path.startsWith('/api/auth')) {
            return res.status(426).json({
                error: {
                    code: 'HTTPS_REQUIRED',
                    message: 'HTTPS is required for authentication endpoints',
                    details: {
                        endpoint: req.path,
                        method: req.method,
                        redirectUrl: `https://${req.get('host')}${req.originalUrl}`,
                        reason: 'Authentication endpoints must use encrypted connections'
                    },
                    timestamp: new Date().toISOString(),
                    requestId: req.headers['x-request-id'] || 'unknown'
                }
            });
        }

        // For other sensitive endpoints (admin, user data), also enforce HTTPS
        if (req.path.startsWith('/api/admin') || 
            req.path.startsWith('/api/users') ||
            req.path.startsWith('/api/ecopoints')) {
            return res.status(426).json({
                error: {
                    code: 'HTTPS_REQUIRED',
                    message: 'HTTPS is required for sensitive data endpoints',
                    details: {
                        endpoint: req.path,
                        method: req.method,
                        redirectUrl: `https://${req.get('host')}${req.originalUrl}`,
                        reason: 'Sensitive data endpoints require encrypted connections'
                    },
                    timestamp: new Date().toISOString(),
                    requestId: req.headers['x-request-id'] || 'unknown'
                }
            });
        }

        // For other endpoints, redirect to HTTPS
        const httpsUrl = `https://${req.get('host')}${req.originalUrl}`;
        return res.redirect(301, httpsUrl);
    }

    next();
};

/**
 * Security Headers Configuration
 * Implements comprehensive security headers using Helmet
 * Validates: Requirements 1.4 - Security headers configuration
 */
export const securityHeaders = helmet({
    // Content Security Policy
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https://res.cloudinary.com", "https://maps.googleapis.com"],
            scriptSrc: ["'self'", "https://maps.googleapis.com"],
            connectSrc: ["'self'", "https://api.cloudinary.com", "wss:", "ws:"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
            reportUri: process.env.CSP_REPORT_URI || '/api/security/csp-report'
        }
    },
    
    // HTTP Strict Transport Security
    hsts: {
        maxAge: parseInt(process.env.HSTS_MAX_AGE) || 31536000, // 1 year
        includeSubDomains: true,
        preload: true
    },
    
    // X-Frame-Options
    frameguard: {
        action: 'deny'
    },
    
    // X-Content-Type-Options
    noSniff: true,
    
    // X-XSS-Protection
    xssFilter: true,
    
    // Referrer Policy
    referrerPolicy: {
        policy: 'strict-origin-when-cross-origin'
    },
    
    // Hide X-Powered-By header
    hidePoweredBy: true,
    
    // DNS Prefetch Control
    dnsPrefetchControl: {
        allow: false
    },
    
    // Expect-CT
    expectCt: {
        maxAge: 86400, // 24 hours
        enforce: process.env.NODE_ENV === 'production'
    },
    
    // Permissions Policy (formerly Feature Policy)
    permissionsPolicy: {
        camera: ['self'],
        microphone: ['self'],
        geolocation: ['self'],
        payment: ['none'],
        usb: ['none']
    }
});

/**
 * CORS Configuration
 * Configures Cross-Origin Resource Sharing with security considerations
 * Validates: Requirements 1.4 - CORS configuration
 */
export const corsConfig = cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = process.env.NODE_ENV === 'production' 
            ? [process.env.PRODUCTION_ORIGIN || 'https://ecocycle-frontend.vercel.app']
            : (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000').split(',');
        
        // In development, allow localhost with any port
        if (process.env.NODE_ENV === 'development') {
            const localhostRegex = /^http:\/\/localhost:\d+$/;
            const localhostIpRegex = /^http:\/\/127\.0\.0\.1:\d+$/;
            
            if (localhostRegex.test(origin) || localhostIpRegex.test(origin)) {
                return callback(null, true);
            }
        }
        
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`[SECURITY] CORS violation - Origin: ${origin} not in allowed origins: ${allowedOrigins.join(', ')}`);
            callback(new Error(`Origin ${origin} not allowed by CORS policy`));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-Request-ID',
        'X-API-Key'
    ],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 86400 // 24 hours
});

/**
 * Rate Limiting for Authentication Endpoints
 * Implements aggressive rate limiting for authentication attempts
 * Validates: Requirements 1.4 - Rate limiting for authentication attempts
 */
export const authRateLimit = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5, // Limit each IP to 5 requests per windowMs for auth endpoints
    message: {
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many authentication attempts, please try again later',
            details: {
                retryAfter: '15 minutes',
                maxAttempts: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5,
                windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000
            },
            timestamp: new Date().toISOString()
        }
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res) => {
        // Log rate limit violations for security monitoring
        console.warn(`[SECURITY] Auth rate limit exceeded for IP: ${req.ip}, Path: ${req.path}, User-Agent: ${req.get('User-Agent')}, Request-ID: ${req.requestId}`);
        
        res.status(429).json({
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many authentication attempts, please try again later',
                details: {
                    retryAfter: '15 minutes',
                    maxAttempts: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5,
                    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
                    ip: req.ip,
                    path: req.path
                },
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
    },
    // Skip rate limiting for successful requests to avoid penalizing legitimate users
    skip: (req, res) => {
        return res.statusCode < 400;
    }
});

/**
 * General API Rate Limiting
 * Implements moderate rate limiting for general API endpoints
 */
export const generalRateLimit = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.GENERAL_RATE_LIMIT_MAX) || 100, // Limit each IP to 100 requests per windowMs for general endpoints
    message: {
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later',
            details: {
                retryAfter: '15 minutes',
                maxAttempts: parseInt(process.env.GENERAL_RATE_LIMIT_MAX) || 100,
                windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000
            },
            timestamp: new Date().toISOString()
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        console.warn(`[SECURITY] General rate limit exceeded for IP: ${req.ip}, Path: ${req.path}, Request-ID: ${req.requestId}`);
        
        res.status(429).json({
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many requests, please try again later',
                details: {
                    retryAfter: '15 minutes',
                    maxAttempts: parseInt(process.env.GENERAL_RATE_LIMIT_MAX) || 100,
                    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
                    ip: req.ip,
                    path: req.path
                },
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
    }
});

/**
 * Slow Down Middleware for Authentication
 * Progressively delays responses for repeated authentication attempts
 */
export const authSlowDown = slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 2, // Allow 2 requests per windowMs without delay
    delayMs: () => 500, // Add 500ms delay per request after delayAfter (v2 syntax)
    maxDelayMs: 20000, // Maximum delay of 20 seconds
    validate: { delayMs: false }, // Disable delayMs warning
    // Use handler instead of onLimitReached for v7+ compatibility
    handler: (req, res, next, options) => {
        console.warn(`[SECURITY] Slow down limit reached for IP: ${req.ip}, Path: ${req.path}, Request-ID: ${req.requestId}`);
        next();
    }
});

/**
 * Request ID Middleware
 * Adds unique request ID for tracking and security monitoring
 */
export const requestId = (req, res, next) => {
    const requestId = req.headers['x-request-id'] || 
                     `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    
    next();
};

/**
 * Security Logging Middleware
 * Logs security-relevant events for monitoring
 */
export const securityLogging = (req, res, next) => {
    const startTime = Date.now();
    
    // Log security-relevant requests
    if (req.path.startsWith('/api/auth') || 
        req.path.startsWith('/api/admin') ||
        req.method === 'DELETE') {
        
        console.log(`[SECURITY] ${req.method} ${req.path} - IP: ${req.ip} - User-Agent: ${req.get('User-Agent')} - Request-ID: ${req.requestId}`);
    }
    
    // Override res.json to log response status for security endpoints
    const originalJson = res.json;
    res.json = function(data) {
        const duration = Date.now() - startTime;
        
        if (req.path.startsWith('/api/auth') && res.statusCode >= 400) {
            console.warn(`[SECURITY] Auth failure - ${req.method} ${req.path} - Status: ${res.statusCode} - Duration: ${duration}ms - IP: ${req.ip} - Request-ID: ${req.requestId}`);
        }
        
        return originalJson.call(this, data);
    };
    
    next();
};

/**
 * Content Type Validation Middleware
 * Ensures proper content types for API endpoints
 */
export const contentTypeValidation = (req, res, next) => {
    // Only validate content type for POST, PUT, PATCH requests with body
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && 
        req.headers['content-length'] && 
        parseInt(req.headers['content-length']) > 0) {
        
        const contentType = req.headers['content-type'];
        
        if (!contentType || !contentType.includes('application/json')) {
            return res.status(400).json({
                error: {
                    code: 'INVALID_CONTENT_TYPE',
                    message: 'Content-Type must be application/json',
                    details: {
                        received: contentType || 'none',
                        expected: 'application/json'
                    },
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId
                }
            });
        }
    }
    
    next();
};

/**
 * Body Size Limiting Middleware
 * Prevents large payload attacks
 */
export const bodySizeLimit = (req, res, next) => {
    const maxSize = 10 * 1024 * 1024; // 10MB limit
    const contentLength = parseInt(req.headers['content-length'] || '0');
    
    if (contentLength > maxSize) {
        console.warn(`[SECURITY] Large payload attempt - Size: ${contentLength} bytes, IP: ${req.ip}, Path: ${req.path}`);
        
        return res.status(413).json({
            error: {
                code: 'PAYLOAD_TOO_LARGE',
                message: 'Request payload too large',
                details: {
                    maxSize: '10MB',
                    receivedSize: `${Math.round(contentLength / 1024 / 1024 * 100) / 100}MB`
                },
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
    }
    
    next();
};

/**
 * Input Sanitization Middleware
 * Sanitizes user input to prevent injection attacks
 */
export const inputSanitization = (req, res, next) => {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body);
    }
    
    // Sanitize query parameters - avoid setting read-only property
    if (req.query && typeof req.query === 'object') {
        // Create a new sanitized query object and replace individual properties
        const sanitizedQuery = sanitizeObject(req.query);
        Object.keys(req.query).forEach(key => {
            delete req.query[key];
        });
        Object.assign(req.query, sanitizedQuery);
    }
    
    next();
};

/**
 * Helper function to sanitize objects recursively
 */
function sanitizeObject(obj) {
    if (obj === null || typeof obj !== 'object') {
        return sanitizeValue(obj);
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        // Sanitize key names to prevent prototype pollution
        const sanitizedKey = sanitizeValue(key);
        if (sanitizedKey !== '__proto__' && sanitizedKey !== 'constructor' && sanitizedKey !== 'prototype') {
            sanitized[sanitizedKey] = sanitizeObject(value);
        }
    }
    
    return sanitized;
}

/**
 * Helper function to sanitize individual values
 */
function sanitizeValue(value) {
    if (typeof value !== 'string') {
        return value;
    }
    
    // Remove potentially dangerous characters and patterns
    return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+\s*=/gi, '') // Remove event handlers
        .replace(/\$\{.*?\}/g, '') // Remove template literals
        .trim();
}

/**
 * Authentication Attempt Monitoring
 * Monitors and logs authentication attempts for security analysis
 */
export const authAttemptMonitoring = (req, res, next) => {
    // Only monitor authentication endpoints
    if (!req.path.startsWith('/api/auth')) {
        return next();
    }
    
    const startTime = Date.now();
    const clientInfo = {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        origin: req.get('Origin'),
        referer: req.get('Referer'),
        requestId: req.requestId,
        timestamp: new Date().toISOString()
    };
    
    // Override res.json to capture response data
    const originalJson = res.json;
    res.json = function(data) {
        const duration = Date.now() - startTime;
        
        // Log authentication attempts
        if (req.path.includes('/login') || req.path.includes('/register')) {
            const isSuccess = res.statusCode < 400;
            const logLevel = isSuccess ? 'info' : 'warn';
            
            console[logLevel](`[AUTH] ${req.method} ${req.path} - Status: ${res.statusCode} - Duration: ${duration}ms - IP: ${clientInfo.ip} - Request-ID: ${clientInfo.requestId}`);
            
            // Log failed attempts with more detail for security monitoring
            if (!isSuccess) {
                console.warn(`[SECURITY] Failed auth attempt - Email: ${req.body?.email || 'unknown'} - IP: ${clientInfo.ip} - User-Agent: ${clientInfo.userAgent}`);
            }
        }
        
        return originalJson.call(this, data);
    };
    
    next();
};

/**
 * Security Headers Validation
 * Validates that required security headers are present in requests
 */
export const securityHeadersValidation = (req, res, next) => {
    // Skip validation for non-sensitive endpoints
    if (!req.path.startsWith('/api/auth') && 
        !req.path.startsWith('/api/admin') &&
        !req.path.startsWith('/api/users')) {
        return next();
    }
    
    const warnings = [];
    
    // Check for missing security headers in production
    if (process.env.NODE_ENV === 'production') {
        if (!req.get('X-Requested-With') && req.method !== 'GET') {
            warnings.push('Missing X-Requested-With header');
        }
        
        if (req.get('Origin') && !req.get('Referer')) {
            warnings.push('Missing Referer header with Origin present');
        }
    }
    
    // Log warnings but don't block requests (for compatibility)
    if (warnings.length > 0) {
        console.warn(`[SECURITY] Security header warnings for ${req.path}: ${warnings.join(', ')} - IP: ${req.ip}`);
    }
    
    next();
};