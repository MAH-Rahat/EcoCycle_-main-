import express from 'express';
import User from '../models/User.js'; 
import bcrypt from 'bcryptjs';

const router = express.Router();

/** * SENIOR SECURED ADMIN CODE
 * I have updated this to a more complex string to prevent 
 * unauthorized admin registrations.
 */
const ADMIN_SECRET_CODE = "ECO-ULTRA-SECURE-2026-X"; 


// --- REGISTER ---
router.post('/register', async (req, res) => {
    const { name, email, mobile, username, password, role, adminCode } = req.body;

    // --- CRITICAL DEBUGGING LOG ---
    console.log(`[DEBUG] Attempting registration for role: ${role}`);
    if (role === 'admin') {
        // We log only the status, not the full code for security in logs
        console.log(`[DEBUG] Admin Code provided: ${adminCode ? "YES" : "NO"}`);
    }

    try {
        // Check if Email OR Username already exists (More robust check)
        const existingUser = await User.findOne({ 
            $or: [{ email }, { username }] 
        });

        if (existingUser) {
            return res.status(400).json({ 
                message: 'User already exists with this email or username.' 
            });
        }

        // --- ADMIN CODE VERIFICATION ---
        if (role === 'admin') {
            const inputCode = String(adminCode || '').trim();

            if (inputCode !== ADMIN_SECRET_CODE) {
                console.warn(`[SECURITY] Failed admin registration attempt from email: ${email}`);
                return res.status(401).json({ message: 'Invalid Admin Private Code.' });
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
            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                points: user.points,
                token: 'JWT_SKIPPED_FOR_TESTING', 
            });
        }
    } catch (error) {
        console.error('SERVER REGISTER CRASH ERROR:', error); 
        
        if (error.code === 11000) { 
             return res.status(400).json({ message: 'Email or Username already exists. Please use unique credentials.' });
        }
        
        res.status(500).json({ message: 'Internal server error during registration.' });
    }
});

// --- LOGIN ---
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Find user by email
        const user = await User.findOne({ email });

        // Check if user exists and password matches
        if (user && (await user.matchPassword(password))) {
            
            // --- UPDATED: ACTIVITY TRACKING ---
            user.lastLogin = Date.now(); 
            user.activityCount = (user.activityCount || 0) + 1;
            await user.save();
            // ----------------------------------

            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                points: user.points, 
                token: 'JWT_SKIPPED_FOR_TESTING', 
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password.' });
        }
    } catch (error) {
        console.error('SERVER LOGIN ERROR:', error);
        res.status(500).json({ message: 'Internal server error during login.' });
    }
});

export default router;