import express from 'express';
import User from '../models/User.js'; 
import bcrypt from 'bcryptjs';
import generateToken from '../utils/generateToken.js';
import { 
    SecureError, 
    AuthErrors, 
    SecurityLogger, 
    ErrorFormatter,
    RequestValidator,
    asyncHandler 
} from '../middleware/errorHandling.js';

const router = express.Router();

/** * SENIOR SECURED ADMIN CODE
 * I have updated this to a more complex string to prevent 
 * unauthorized admin registrations.
 */
const ADMIN_SECRET_CODE = "ECO-ULTRA-SECURE-2026-X"; 


// --- REGISTER ---
router.post('/register', asyncHandler(async (req, res) => {
    const { name, email, mobile, username, password, role, adminCode } = req.body;

    // Validate required fields
    RequestValidator.validateRequired(
        { name, email, username, password, role },
        ['name', 'email', 'username', 'password', 'role'],
        {
            name: 'Full Name',
            email: 'Email Address',
            username: 'Username',
            password: 'Password',
            role: 'User Role'
        }
    );

    // Validate email format
    RequestValidator.validateEmail(email);

    // Validate password strength
    RequestValidator.validatePassword(password);

    // Validate role
    RequestValidator.validateRole(role);

    // Log registration attempt
    SecurityLogger.logAuthAttempt(req, false, 'REGISTRATION_ATTEMPT', {
        role,
        hasAdminCode: !!adminCode
    });

    try {
        // Check if Email OR Username already exists (More robust check)
        const existingUser = await User.findOne({ 
            $or: [{ email }, { username }] 
        });

        if (existingUser) {
            SecurityLogger.logAuthAttempt(req, false, 'DUPLICATE_USER', {
                existingField: existingUser.email === email ? 'email' : 'username'
            });
            throw AuthErrors.DUPLICATE_USER;
        }

        // --- ADMIN CODE VERIFICATION ---
        if (role === 'admin') {
            const inputCode = String(adminCode || '').trim();

            if (inputCode !== ADMIN_SECRET_CODE) {
                SecurityLogger.logAuthAttempt(req, false, 'INVALID_ADMIN_CODE', {
                    providedCodeLength: inputCode.length
                });
                throw AuthErrors.INVALID_ADMIN_CODE;
            }
        }
        
        // --- PASSWORD HASHING ---
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = await User.create({
            name, 
            email, 
            mobile, 
            username, 
            password: hashedPassword,
            role,
            points: 100, // Grant 100 free points on creation
            adminCode: role === 'admin' ? ADMIN_SECRET_CODE : undefined,
            activityCount: 1 // Initial activity
        });

        if (user) {
            // Log successful registration
            SecurityLogger.logAuthAttempt(req, true, 'REGISTRATION_SUCCESS', {
                userId: user._id,
                role: user.role
            });

            // Log data access for user creation
            SecurityLogger.logDataAccess(req, 'USER', user._id, true, {
                action: 'CREATE',
                role: user.role
            });

            res.status(201).json({
                success: true,
                data: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    points: user.points,
                    token: generateToken(user._id)
                },
                message: 'Registration successful'
            });
        }
    } catch (error) {
        // If it's already a SecureError, re-throw it
        if (error instanceof SecureError) {
            throw error;
        }

        // Handle MongoDB duplicate key errors
        if (error.code === 11000) {
            SecurityLogger.logAuthAttempt(req, false, 'DUPLICATE_USER_DB', {
                duplicateField: Object.keys(error.keyPattern || {})[0] || 'unknown'
            });
            throw AuthErrors.DUPLICATE_USER;
        }
        
        // Log unexpected errors
        console.error('[AUTH_ERROR] Registration failed:', {
            error: error.message,
            stack: error.stack,
            requestId: req.requestId,
            email: SecurityLogger.maskEmail(email)
        });

        SecurityLogger.logAuthAttempt(req, false, 'REGISTRATION_ERROR', {
            errorType: error.name || 'UnknownError'
        });

        throw AuthErrors.REGISTRATION_FAILED;
    }
}));

// --- LOGIN ---
router.post('/login', asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Validate required fields
    RequestValidator.validateRequired(
        { email, password },
        ['email', 'password'],
        {
            email: 'Email Address',
            password: 'Password'
        }
    );

    // Validate email format
    RequestValidator.validateEmail(email);

    // Log login attempt
    SecurityLogger.logAuthAttempt(req, false, 'LOGIN_ATTEMPT');

    try {
        // Find user by email
        const user = await User.findOne({ email });

        // Log data access attempt
        SecurityLogger.logDataAccess(req, 'USER', user?._id || 'unknown', !!user, {
            action: 'READ',
            purpose: 'LOGIN_VERIFICATION'
        });

        // Check if user exists and password matches
        if (user && (await user.matchPassword(password))) {
            
            // Check if account is active
            if (!user.isActive) {
                SecurityLogger.logAuthAttempt(req, false, 'ACCOUNT_DISABLED', {
                    userId: user._id
                });
                throw AuthErrors.ACCOUNT_DISABLED;
            }

            // --- UPDATED: ACTIVITY TRACKING ---
            // Use findByIdAndUpdate to avoid validation issues with existing data
            await User.findByIdAndUpdate(
                user._id,
                {
                    $set: { lastLogin: Date.now() },
                    $inc: { activityCount: 1 }
                },
                { validateBeforeSave: false }
            );
            // ----------------------------------

            // Log successful login
            SecurityLogger.logAuthAttempt(req, true, 'LOGIN_SUCCESS', {
                userId: user._id,
                role: user.role,
                activityCount: (user.activityCount || 0) + 1
            });

            // Log data access for user update
            SecurityLogger.logDataAccess(req, 'USER', user._id, true, {
                action: 'UPDATE',
                purpose: 'LOGIN_TRACKING'
            });

            res.json({
                success: true,
                data: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    points: user.points,
                    token: generateToken(user._id)
                },
                message: 'Login successful'
            });
        } else {
            // Log failed login attempt
            SecurityLogger.logAuthAttempt(req, false, 'INVALID_CREDENTIALS', {
                userExists: !!user,
                userId: user?._id
            });
            
            throw AuthErrors.INVALID_CREDENTIALS;
        }
    } catch (error) {
        // If it's already a SecureError, re-throw it
        if (error instanceof SecureError) {
            throw error;
        }

        // Log unexpected errors
        console.error('[AUTH_ERROR] Login failed:', {
            error: error.message,
            stack: error.stack,
            requestId: req.requestId,
            email: SecurityLogger.maskEmail(email)
        });

        SecurityLogger.logAuthAttempt(req, false, 'LOGIN_ERROR', {
            errorType: error.name || 'UnknownError'
        });

        throw AuthErrors.INVALID_CREDENTIALS;
    }
}));

export default router;