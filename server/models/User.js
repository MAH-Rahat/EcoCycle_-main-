import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Address subdocument schema
const addressSchema = new mongoose.Schema({
    street: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    city: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    zipCode: {
        type: String,
        required: true,
        trim: true,
        maxlength: 20
    },
    coordinates: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: true,
            validate: {
                validator: function(coords) {
                    return coords.length === 2 && 
                           coords[0] >= -180 && coords[0] <= 180 && // longitude
                           coords[1] >= -90 && coords[1] <= 90;     // latitude
                },
                message: 'Coordinates must be [longitude, latitude] with valid ranges'
            }
        }
    },
    isDefault: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// User preferences schema
const userPreferencesSchema = new mongoose.Schema({
    notifications: {
        pickup: {
            type: Boolean,
            default: true
        },
        rewards: {
            type: Boolean,
            default: true
        },
        challenges: {
            type: Boolean,
            default: true
        }
    },
    privacy: {
        showInLeaderboard: {
            type: Boolean,
            default: true
        },
        showFullName: {
            type: Boolean,
            default: true
        },
        shareImpactData: {
            type: Boolean,
            default: true
        }
    }
}, {
    _id: false // Don't create separate _id for preferences
});

// User profile schema
const userProfileSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50
    },
    lastName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50
    },
    phone: {
        type: String,
        trim: true,
        validate: {
            validator: function(phone) {
                if (!phone) return true; // Optional field
                return /^\+?[1-9]\d{1,14}$/.test(phone);
            },
            message: 'Phone number must be in valid international format'
        }
    },
    addresses: [addressSchema],
    preferences: {
        type: userPreferencesSchema,
        default: () => ({})
    }
}, {
    _id: false // Don't create separate _id for profile
});

const userSchema = new mongoose.Schema({
    // Legacy fields for backward compatibility
    name: { 
        type: String, 
        required: true 
    },
    email: { 
        type: String, 
        required: true, 
        unique: true,
        lowercase: true,
        trim: true,
        validate: {
            validator: function(email) {
                return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
            },
            message: 'Please provide a valid email address'
        }
    },
    mobile: { 
        type: String 
    },
    username: { 
        type: String, 
        required: true, 
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 30
    },
    password: { 
        type: String, 
        required: true,
        minlength: 6
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
    // New profile structure (initialized with defaults)
    profile: {
        type: userProfileSchema,
        default: function() {
            return {
                firstName: this.name ? this.name.split(' ')[0] : '',
                lastName: this.name ? this.name.split(' ').slice(1).join(' ') || this.name.split(' ')[0] : '',
                phone: this.mobile || undefined,
                addresses: [],
                preferences: {
                    notifications: {
                        pickup: true,
                        rewards: true,
                        challenges: true
                    },
                    privacy: {
                        showInLeaderboard: true,
                        showFullName: true,
                        shareImpactData: true
                    }
                }
            };
        }
    },
    // --- ACTIVITY TRACKING FIELDS ---
    lastLogin: { 
        type: Date, 
        default: Date.now 
    },
    activityCount: { 
        type: Number, 
        default: 0 
    },
    // --- SECURITY FIELDS ---
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    // This provides createdAt (Joined Date) and updatedAt automatically
    timestamps: true 
});

// Create geospatial index for address coordinates
addressSchema.index({ coordinates: '2dsphere' });

// Removed pre-save middleware temporarily to fix registration issues

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