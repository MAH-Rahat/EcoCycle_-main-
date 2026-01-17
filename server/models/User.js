import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    },
    email: { 
        type: String, 
        required: true, 
        unique: true 
    },
    mobile: { 
        type: String 
    },
    username: { 
        type: String, 
        required: true, 
        unique: true 
    },
    password: { 
        type: String, 
        required: true 
    },
    role: { 
        type: String, 
        enum: ['citizen', 'collector', 'admin'], 
        default: 'citizen',
        required: true 
    },
    points: { 
        type: Number, 
        default: 0 
    },
    adminCode: { 
        type: String, 
        select: false 
    },
    // --- NEW ACTIVITY TRACKING FIELDS ---
    lastLogin: { 
        type: Date, 
        default: Date.now 
    },
    activityCount: { 
        type: Number, 
        default: 0 
    }
}, {
    // This provides createdAt (Joined Date) and updatedAt automatically
    timestamps: true 
});

// --- STABILITY NOTE ---
// The userSchema.pre('save') middleware is intentionally omitted.
// Password hashing is handled manually in authRoutes.js to prevent double-hashing bugs.

// Method to verify password for login
userSchema.methods.matchPassword = async function (enteredPassword) {
    // Compares plain text input from Login with the hashed string in the DB
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;