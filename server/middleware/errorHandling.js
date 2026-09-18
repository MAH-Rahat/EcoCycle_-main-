/**
 * Secure Error Handling Middleware for EcoCycle Platform
 * 
 * This middleware implements secure error handling that prevents information disclosure
 * while providing useful feedback to legitimate users.
 * 
 * Validates: Requirements 1.5, 16.2
 * - Requirement 1.5: Return appropriate error messages without revealing system details
 * - Requirement 16.2: Log access attempts for security monitoring
 */

/**
 * Standardized Error Response Format
 * Provides consistent error structure across the application
 */
export class SecureError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.timestamp = new Date().toISOString();
        this.name = 'SecureError';
    }
}

/**
 * Authentication Error Types
 * Predefined secure error responses for authentication scenarios
 */
export const AuthErrors = {
    INVALID_CREDENTIALS: new SecureError(
        'Invalid credentials provided',
        401,
        'AUTHENTICATION_FAILED',
        { reason: 'The provided credentials are incorrect' }
    ),
    
    USER_NOT_FOUND: new SecureError(
        'Invalid credentials provided', // Same message as invalid credentials to prevent user enumeration
        401,
        'AUTHENTICATION_FAILED',
        { reason: 'The provided credentials are incorrect' }
    ),
    
    ACCOUNT_DISABLED: new SecureError(
        'Account access is currently unavailable',
        403,
        'ACCOUNT_UNAVAILABLE',
        { reason: 'Please contact support for assistance' }
    ),
    
    INVALID_TOKEN: new SecureError(
        'Authentication required',
        401,
        'INVALID_TOKEN',
        { reason: 'Please log in to access this resource' }
    ),
    
    TOKEN_EXPIRED: new SecureError(
        'Session expired',
        401,
        'TOKEN_EXPIRED',
        { reason: 'Please log in again to continue' }
    ),
    
    INSUFFICIENT_PERMISSIONS: new SecureError(
        'Access denied',
        403,
        'INSUFFICIENT_PERMISSIONS',
        { reason: 'You do not have permission to access this resource' }
    ),
    
    REGISTRATION_FAILED: new SecureError(
        'Registration could not be completed',
        400,
        'REGISTRATION_FAILED',
        { reason: 'Please check your information and try again' }
    ),
    
    DUPLICATE_USER: new SecureError(
        'Registration could not be completed',
        409,
        'REGISTRATION_FAILED',
        { reason: 'An account with this information already exists' }
    ),
    
    INVALID_ADMIN_CODE: new SecureError(
        'Registration could not be completed',
        403,
        'REGISTRATION_FAILED',
        { reason: 'Invalid authorization code provided' }
    ),
    
    VALIDATION_ERROR: new SecureError(
        'Invalid input provided',
        400,
        'VALIDATION_ERROR',
        { reason: 'Please check your input and try again' }
    )
};

/**
 * Validation Error Types
 * Predefined secure error responses for validation scenarios
 */
export const ValidationErrors = {
    USER_NOT_FOUND: new SecureError(
        'User not found',
        404,
        'USER_NOT_FOUND',
        { reason: 'The requested user does not exist' }
    ),
    
    OPERATION_FAILED: new SecureError(
        'Operation could not be completed',
        500,
        'OPERATION_FAILED',
        { reason: 'Please try again later' }
    ),
    
    INVALID_PHONE_FORMAT: new SecureError(
        'Invalid phone number format',
        400,
        'INVALID_PHONE_FORMAT',
        { reason: 'Phone number must be in valid international format' }
    ),
    
    INVALID_PREFERENCES_FORMAT: new SecureError(
        'Invalid preferences format',
        400,
        'INVALID_PREFERENCES_FORMAT',
        { reason: 'Preferences must be a valid object' }
    ),
    
    INVALID_COORDINATES_FORMAT: new SecureError(
        'Invalid coordinates format',
        400,
        'INVALID_COORDINATES_FORMAT',
        { reason: 'Coordinates must be an array of [longitude, latitude]' }
    ),
    
    INVALID_COORDINATES_RANGE: new SecureError(
        'Invalid coordinates range',
        400,
        'INVALID_COORDINATES_RANGE',
        { reason: 'Longitude must be between -180 and 180, latitude between -90 and 90' }
    ),
    
    ADDRESS_NOT_FOUND: new SecureError(
        'Address not found',
        404,
        'ADDRESS_NOT_FOUND',
        { reason: 'The requested address does not exist' }
    ),
    
    CANNOT_DELETE_LAST_ADDRESS: new SecureError(
        'Cannot delete last address',
        400,
        'CANNOT_DELETE_LAST_ADDRESS',
        { reason: 'At least one address must be maintained' }
    )
};

/**
 * Security Logger
 * Logs security-relevant events for monitoring and analysis
 */
export class SecurityLogger {
    static logAuthAttempt(req, success, errorType = null, additionalInfo = {}) {
        const logData = {
            timestamp: new Date().toISOString(),
            requestId: req.requestId || 'unknown',
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            method: req.method,
            path: req.path,
            success,
            errorType,
            email: req.body?.email ? this.maskEmail(req.body.email) : 'unknown',
            ...additionalInfo
        };

        if (success) {
            console.log(`[AUTH_SUCCESS] ${JSON.stringify(logData)}`);
        } else {
            console.warn(`[AUTH_FAILURE] ${JSON.stringify(logData)}`);
        }

        // Log to security monitoring system (placeholder for future implementation)
        this.logToSecuritySystem(logData);
    }

    static logSecurityEvent(eventType, req, details = {}) {
        const logData = {
            timestamp: new Date().toISOString(),
            eventType,
            requestId: req.requestId || 'unknown',
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            method: req.method,
            path: req.path,
            ...details
        };

        console.warn(`[SECURITY_EVENT] ${JSON.stringify(logData)}`);
        this.logToSecuritySystem(logData);
    }

    static logDataAccess(req, resourceType, resourceId, success, details = {}) {
        const logData = {
            timestamp: new Date().toISOString(),
            eventType: 'DATA_ACCESS',
            requestId: req.requestId || 'unknown',
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            userId: req.user?._id || 'anonymous',
            userRole: req.user?.role || 'unknown',
            resourceType,
            resourceId,
            success,
            ...details
        };

        console.log(`[DATA_ACCESS] ${JSON.stringify(logData)}`);
        this.logToSecuritySystem(logData);
    }

    static maskEmail(email) {
        if (!email || typeof email !== 'string') return 'invalid';
        
        const [localPart, domain] = email.split('@');
        if (!localPart || !domain) return 'invalid';
        
        const maskedLocal = localPart.length > 2 
            ? localPart.substring(0, 2) + '*'.repeat(localPart.length - 2)
            : '*'.repeat(localPart.length);
        
        return `${maskedLocal}@${domain}`;
    }

    static logToSecuritySystem(logData) {
        // Placeholder for integration with external security monitoring system
        // In production, this would send logs to SIEM, security dashboard, etc.
        
        // For now, we'll store critical events in a simple format
        if (logData.eventType === 'AUTH_FAILURE' || logData.eventType === 'SECURITY_EVENT') {
            // In production, implement proper log aggregation
            // Example: send to ElasticSearch, Splunk, or cloud logging service
        }
    }
}

/**
 * Secure Error Response Formatter
 * Formats error responses to prevent information disclosure
 */
export class ErrorFormatter {
    static formatAuthError(error, req) {
        const baseResponse = {
            success: false,
            error: {
                code: error.code || 'AUTHENTICATION_ERROR',
                message: error.message || 'Authentication failed',
                timestamp: error.timestamp || new Date().toISOString(),
                requestId: req.requestId || 'unknown'
            }
        };

        // Add safe details if available
        if (error.details && typeof error.details === 'object') {
            baseResponse.error.details = error.details;
        }

        // In development, add more debugging information
        if (process.env.NODE_ENV === 'development') {
            baseResponse.debug = {
                path: req.path,
                method: req.method,
                ip: req.ip
            };
        }

        return baseResponse;
    }

    static formatValidationError(validationErrors, req) {
        // Sanitize validation errors to prevent information disclosure
        const sanitizedErrors = validationErrors.map(err => ({
            field: err.field || 'unknown',
            message: this.sanitizeValidationMessage(err.message || 'Invalid input')
        }));

        return {
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid input provided',
                details: {
                    fields: sanitizedErrors,
                    reason: 'Please check your input and try again'
                },
                timestamp: new Date().toISOString(),
                requestId: req.requestId || 'unknown'
            }
        };
    }

    static sanitizeValidationMessage(message) {
        // Remove potentially sensitive information from validation messages
        return message
            .replace(/\b\d{4,}\b/g, '[REDACTED]') // Remove long numbers (potential IDs)
            .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]') // Remove emails
            .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP]') // Remove IP addresses
            .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[UUID]'); // Remove UUIDs
    }
}

/**
 * Authentication Error Handler Middleware
 * Handles authentication-specific errors with secure responses
 */
export const authErrorHandler = (err, req, res, next) => {
    // Log the error for security monitoring
    SecurityLogger.logSecurityEvent('AUTH_ERROR', req, {
        errorType: err.name || 'UnknownError',
        errorCode: err.code || 'UNKNOWN',
        statusCode: err.statusCode || 500
    });

    // Handle different types of authentication errors
    if (err instanceof SecureError) {
        const response = ErrorFormatter.formatAuthError(err, req);
        return res.status(err.statusCode).json(response);
    }

    // Handle MongoDB duplicate key errors (user already exists)
    if (err.code === 11000) {
        const duplicateError = AuthErrors.DUPLICATE_USER;
        SecurityLogger.logAuthAttempt(req, false, 'DUPLICATE_USER', {
            duplicateField: Object.keys(err.keyPattern || {})[0] || 'unknown'
        });
        
        const response = ErrorFormatter.formatAuthError(duplicateError, req);
        return res.status(duplicateError.statusCode).json(response);
    }

    // Handle validation errors
    if (err.name === 'ValidationError') {
        const validationErrors = Object.values(err.errors || {}).map(e => ({
            field: e.path,
            message: e.message
        }));
        
        const response = ErrorFormatter.formatValidationError(validationErrors, req);
        return res.status(400).json(response);
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
        const tokenError = AuthErrors.INVALID_TOKEN;
        const response = ErrorFormatter.formatAuthError(tokenError, req);
        return res.status(tokenError.statusCode).json(response);
    }

    if (err.name === 'TokenExpiredError') {
        const expiredError = AuthErrors.TOKEN_EXPIRED;
        const response = ErrorFormatter.formatAuthError(expiredError, req);
        return res.status(expiredError.statusCode).json(response);
    }

    // Handle bcrypt errors (password hashing/comparison failures)
    if (err.message && err.message.includes('bcrypt')) {
        const authError = AuthErrors.INVALID_CREDENTIALS;
        SecurityLogger.logAuthAttempt(req, false, 'BCRYPT_ERROR');
        
        const response = ErrorFormatter.formatAuthError(authError, req);
        return res.status(authError.statusCode).json(response);
    }

    // Default secure error response for unknown errors
    const genericError = new SecureError(
        'An error occurred while processing your request',
        500,
        'INTERNAL_ERROR',
        { reason: 'Please try again later or contact support if the problem persists' }
    );

    // Log the original error for debugging (but don't expose it to the client)
    console.error(`[INTERNAL_ERROR] Unhandled error in auth: ${err.message}`, {
        stack: err.stack,
        requestId: req.requestId,
        path: req.path,
        method: req.method
    });

    const response = ErrorFormatter.formatAuthError(genericError, req);
    res.status(genericError.statusCode).json(response);
};

/**
 * General Secure Error Handler
 * Handles non-authentication errors with secure responses
 */
export const secureErrorHandler = (err, req, res, next) => {
    // Skip if response already sent
    if (res.headersSent) {
        return next(err);
    }

    // Log the error for monitoring
    SecurityLogger.logSecurityEvent('APPLICATION_ERROR', req, {
        errorType: err.name || 'UnknownError',
        errorMessage: err.message || 'Unknown error',
        statusCode: err.statusCode || 500
    });

    // Determine if this is a client error (4xx) or server error (5xx)
    const statusCode = err.statusCode || err.status || 500;
    const isClientError = statusCode >= 400 && statusCode < 500;

    let message, code, details;

    if (isClientError) {
        // For client errors, provide more specific information
        message = err.message || 'Bad request';
        code = err.code || 'CLIENT_ERROR';
        details = err.details || { reason: 'Please check your request and try again' };
    } else {
        // For server errors, provide generic message to prevent information disclosure
        message = 'An internal error occurred';
        code = 'INTERNAL_ERROR';
        details = { reason: 'Please try again later or contact support if the problem persists' };
        
        // Log server errors with full details for debugging
        console.error(`[SERVER_ERROR] ${err.message}`, {
            stack: err.stack,
            requestId: req.requestId,
            path: req.path,
            method: req.method,
            userId: req.user?._id,
            userRole: req.user?.role
        });
    }

    const response = {
        success: false,
        error: {
            code,
            message,
            details,
            timestamp: new Date().toISOString(),
            requestId: req.requestId || 'unknown'
        }
    };

    // Add debug information in development
    if (process.env.NODE_ENV === 'development' && !isClientError) {
        response.debug = {
            originalError: err.message,
            stack: err.stack?.split('\n').slice(0, 5), // Limit stack trace
            path: req.path,
            method: req.method
        };
    }

    res.status(statusCode).json(response);
};

/**
 * 404 Not Found Handler
 * Handles requests to non-existent endpoints
 */
export const notFoundHandler = (req, res) => {
    SecurityLogger.logSecurityEvent('NOT_FOUND', req, {
        attemptedPath: req.originalUrl
    });

    const response = {
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: 'The requested resource was not found',
            details: {
                reason: 'Please check the URL and try again'
            },
            timestamp: new Date().toISOString(),
            requestId: req.requestId || 'unknown'
        }
    };

    res.status(404).json(response);
};

/**
 * Async Error Wrapper
 * Wraps async route handlers to catch and forward errors
 */
export const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * Request Validation Helper
 * Validates request data and throws secure errors
 */
export class RequestValidator {
    static validateRequired(data, requiredFields, fieldNames = {}) {
        const missing = [];
        
        for (const field of requiredFields) {
            if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
                missing.push(fieldNames[field] || field);
            }
        }
        
        if (missing.length > 0) {
            throw new SecureError(
                'Required fields are missing',
                400,
                'VALIDATION_ERROR',
                { 
                    reason: 'Please provide all required information',
                    missingFields: missing
                }
            );
        }
    }
    
    static validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new SecureError(
                'Invalid email format',
                400,
                'VALIDATION_ERROR',
                { reason: 'Please provide a valid email address' }
            );
        }
    }
    
    static validatePassword(password) {
        if (!password || password.length < 6) {
            throw new SecureError(
                'Invalid password',
                400,
                'VALIDATION_ERROR',
                { reason: 'Password must be at least 6 characters long' }
            );
        }
    }
    
    static validateRole(role, allowedRoles = ['citizen', 'collector', 'admin']) {
        if (!allowedRoles.includes(role)) {
            throw new SecureError(
                'Invalid role specified',
                400,
                'VALIDATION_ERROR',
                { reason: 'Please specify a valid user role' }
            );
        }
    }
    
    static validateString(value, fieldName, minLength = 1, maxLength = 255) {
        if (typeof value !== 'string') {
            throw new SecureError(
                `Invalid ${fieldName} format`,
                400,
                'VALIDATION_ERROR',
                { reason: `${fieldName} must be a string` }
            );
        }
        
        const trimmedValue = value.trim();
        
        if (trimmedValue.length < minLength) {
            throw new SecureError(
                `Invalid ${fieldName} length`,
                400,
                'VALIDATION_ERROR',
                { reason: `${fieldName} must be at least ${minLength} characters long` }
            );
        }
        
        if (trimmedValue.length > maxLength) {
            throw new SecureError(
                `Invalid ${fieldName} length`,
                400,
                'VALIDATION_ERROR',
                { reason: `${fieldName} must be no more than ${maxLength} characters long` }
            );
        }
    }
}