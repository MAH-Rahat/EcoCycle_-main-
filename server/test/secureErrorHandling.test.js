/**
 * Secure Error Handling Tests
 * 
 * Tests the secure error handling middleware to ensure:
 * - Error messages don't reveal system details (Requirement 1.5)
 * - Request logging for security monitoring (Requirement 16.2)
 * - Standardized error response format
 * - Proper authentication error handling
 */

import { 
    SecureError, 
    AuthErrors, 
    SecurityLogger, 
    ErrorFormatter,
    RequestValidator 
} from '../middleware/errorHandling.js';

describe('Secure Error Handling', () => {
    describe('Security Logging', () => {
        test('should mask email addresses correctly', () => {
            expect(SecurityLogger.maskEmail('test@example.com')).toBe('te**@example.com');
            expect(SecurityLogger.maskEmail('a@example.com')).toBe('*@example.com');
            expect(SecurityLogger.maskEmail('ab@example.com')).toBe('**@example.com');
            expect(SecurityLogger.maskEmail('longusername@example.com')).toBe('lo**********@example.com');
            expect(SecurityLogger.maskEmail('invalid-email')).toBe('invalid');
            expect(SecurityLogger.maskEmail('')).toBe('invalid');
        });
    });

    describe('Error Response Format', () => {
        test('should format authentication errors consistently', () => {
            const mockReq = { 
                requestId: 'test-123', 
                path: '/api/auth/login', 
                method: 'POST', 
                ip: '127.0.0.1' 
            };
            const error = AuthErrors.INVALID_CREDENTIALS;
            
            const formatted = ErrorFormatter.formatAuthError(error, mockReq);

            expect(formatted).toMatchObject({
                success: false,
                error: {
                    code: 'AUTHENTICATION_FAILED',
                    message: 'Invalid credentials provided',
                    details: {
                        reason: 'The provided credentials are incorrect'
                    },
                    timestamp: expect.any(String),
                    requestId: 'test-123'
                }
            });
        });

        test('should sanitize validation messages', () => {
            const message = 'User with ID 123456789 and email test@example.com not found at IP 192.168.1.1';
            const sanitized = ErrorFormatter.sanitizeValidationMessage(message);
            
            expect(sanitized).toBe('User with ID [REDACTED] and email [EMAIL] not found at IP [IP]');
        });

        test('should format validation errors with sanitized messages', () => {
            const mockReq = { requestId: 'test-789' };
            const validationErrors = [
                { field: 'email', message: 'Invalid email test@example.com provided' },
                { field: 'password', message: 'Password must be at least 6 characters' }
            ];

            const formatted = ErrorFormatter.formatValidationError(validationErrors, mockReq);

            expect(formatted).toMatchObject({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid input provided',
                    details: {
                        fields: [
                            { field: 'email', message: 'Invalid email [EMAIL] provided' },
                            { field: 'password', message: 'Password must be at least 6 characters' }
                        ],
                        reason: 'Please check your input and try again'
                    },
                    requestId: 'test-789'
                }
            });
        });
    });

    describe('Request Validation', () => {
        test('should validate required fields correctly', () => {
            const data = { name: 'Test', email: '' };
            
            expect(() => {
                RequestValidator.validateRequired(data, ['name', 'email', 'password']);
            }).toThrow(SecureError);

            try {
                RequestValidator.validateRequired(data, ['name', 'email', 'password']);
            } catch (error) {
                expect(error.code).toBe('VALIDATION_ERROR');
                expect(error.details.missingFields).toContain('email');
                expect(error.details.missingFields).toContain('password');
            }
        });

        test('should validate email format correctly', () => {
            expect(() => {
                RequestValidator.validateEmail('invalid-email');
            }).toThrow(SecureError);
            
            expect(() => {
                RequestValidator.validateEmail('valid@example.com');
            }).not.toThrow();
        });

        test('should validate password strength correctly', () => {
            expect(() => {
                RequestValidator.validatePassword('123');
            }).toThrow(SecureError);
            
            expect(() => {
                RequestValidator.validatePassword('validpassword');
            }).not.toThrow();
        });

        test('should validate user roles correctly', () => {
            expect(() => {
                RequestValidator.validateRole('invalid-role');
            }).toThrow(SecureError);
            
            expect(() => {
                RequestValidator.validateRole('citizen');
            }).not.toThrow();

            expect(() => {
                RequestValidator.validateRole('collector');
            }).not.toThrow();

            expect(() => {
                RequestValidator.validateRole('admin');
            }).not.toThrow();
        });
    });

    describe('SecureError Class', () => {
        test('should create SecureError with default values', () => {
            const error = new SecureError('Test error');
            
            expect(error.message).toBe('Test error');
            expect(error.statusCode).toBe(500);
            expect(error.code).toBe('INTERNAL_ERROR');
            expect(error.details).toBeNull();
            expect(error.timestamp).toBeDefined();
            expect(error.name).toBe('SecureError');
        });

        test('should create SecureError with custom values', () => {
            const details = { reason: 'Custom reason' };
            const error = new SecureError('Custom error', 400, 'CUSTOM_ERROR', details);
            
            expect(error.message).toBe('Custom error');
            expect(error.statusCode).toBe(400);
            expect(error.code).toBe('CUSTOM_ERROR');
            expect(error.details).toBe(details);
        });
    });

    describe('Predefined Auth Errors', () => {
        test('should have consistent error structure for INVALID_CREDENTIALS', () => {
            const error = AuthErrors.INVALID_CREDENTIALS;
            
            expect(error.statusCode).toBe(401);
            expect(error.code).toBe('AUTHENTICATION_FAILED');
            expect(error.message).toBe('Invalid credentials provided');
            expect(error.details.reason).toBe('The provided credentials are incorrect');
        });

        test('should have consistent error structure for USER_NOT_FOUND', () => {
            const error = AuthErrors.USER_NOT_FOUND;
            
            // Should be the same as INVALID_CREDENTIALS to prevent user enumeration
            expect(error.statusCode).toBe(401);
            expect(error.code).toBe('AUTHENTICATION_FAILED');
            expect(error.message).toBe('Invalid credentials provided');
            expect(error.details.reason).toBe('The provided credentials are incorrect');
        });

        test('should have consistent error structure for DUPLICATE_USER', () => {
            const error = AuthErrors.DUPLICATE_USER;
            
            expect(error.statusCode).toBe(409);
            expect(error.code).toBe('REGISTRATION_FAILED');
            expect(error.message).toBe('Registration could not be completed');
            expect(error.details.reason).toBe('An account with this information already exists');
        });

        test('should have consistent error structure for INVALID_ADMIN_CODE', () => {
            const error = AuthErrors.INVALID_ADMIN_CODE;
            
            expect(error.statusCode).toBe(403);
            expect(error.code).toBe('REGISTRATION_FAILED');
            expect(error.message).toBe('Registration could not be completed');
            expect(error.details.reason).toBe('Invalid authorization code provided');
        });

        test('should have consistent error structure for ACCOUNT_DISABLED', () => {
            const error = AuthErrors.ACCOUNT_DISABLED;
            
            expect(error.statusCode).toBe(403);
            expect(error.code).toBe('ACCOUNT_UNAVAILABLE');
            expect(error.message).toBe('Account access is currently unavailable');
            expect(error.details.reason).toBe('Please contact support for assistance');
        });
    });

    describe('Error Message Security', () => {
        test('should not reveal system details in error messages', () => {
            const errors = Object.values(AuthErrors);
            
            errors.forEach(error => {
                // Check that error messages don't contain sensitive information
                expect(error.message).not.toMatch(/database/i);
                expect(error.message).not.toMatch(/mongodb/i);
                expect(error.message).not.toMatch(/sql/i);
                expect(error.message).not.toMatch(/server/i);
                expect(error.message).not.toMatch(/internal/i);
                expect(error.message).not.toMatch(/stack/i);
                expect(error.message).not.toMatch(/error/i);
                
                // Check that details don't reveal system internals
                if (error.details && error.details.reason) {
                    expect(error.details.reason).not.toMatch(/database/i);
                    expect(error.details.reason).not.toMatch(/mongodb/i);
                    expect(error.details.reason).not.toMatch(/sql/i);
                }
            });
        });

        test('should provide user-friendly error messages', () => {
            const errors = Object.values(AuthErrors);
            
            errors.forEach(error => {
                // Check that error messages are user-friendly
                expect(error.message.length).toBeGreaterThan(10);
                expect(error.details).toBeDefined();
                expect(error.details.reason).toBeDefined();
                expect(error.details.reason.length).toBeGreaterThan(10);
            });
        });
    });
});