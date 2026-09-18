import mongoose from 'mongoose';

/**
 * WasteLog Model
 * Represents a waste logging entry by a citizen
 * Validates: Requirements 2.1, 2.4 - Waste logging and validation
 */

const wasteLogSchema = new mongoose.Schema({
    citizenId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    wasteType: {
        type: String,
        required: true,
        enum: ['plastic', 'paper', 'glass', 'metal', 'organic', 'electronic', 'hazardous'],
        index: true
    },
    weight: {
        type: Number,
        required: true,
        min: [0.1, 'Weight must be at least 0.1 kg'],
        max: [1000, 'Weight cannot exceed 1000 kg']
    },
    photos: [{
        type: String,
        validate: {
            validator: function(url) {
                if (!url) return true; // Allow empty/null photos
                return /^https:\/\/res\.cloudinary\.com\//.test(url);
            },
            message: 'Photo must be a valid Cloudinary URL'
        }
    }],
    description: {
        type: String,
        maxlength: [500, 'Description cannot exceed 500 characters'],
        trim: true
    },
    location: {
        address: {
            street: String,
            city: String,
            zipCode: String
        },
        coordinates: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point'
            },
            coordinates: {
                type: [Number], // [longitude, latitude]
                validate: {
                    validator: function(coords) {
                        return coords.length === 2 && 
                               coords[0] >= -180 && coords[0] <= 180 && // longitude
                               coords[1] >= -90 && coords[1] <= 90;    // latitude
                    },
                    message: 'Invalid coordinates format'
                }
            }
        }
    },
    ecoPointsEarned: {
        type: Number,
        default: 0,
        min: 0
    },
    co2Saved: {
        type: Number,
        default: 0,
        min: 0
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending',
        index: true
    },
    verifiedAt: {
        type: Date
    },
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    rejectionReason: {
        type: String,
        maxlength: [200, 'Rejection reason cannot exceed 200 characters']
    },
    // Legacy fields for backward compatibility
    citizen: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    material: {
        type: String,
        enum: ['Plastic', 'Paper', 'Metal', 'Glass', 'E-Waste', 'Organic', 'Other']
    },
    photo: String,
    collector: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    pickupDetails: {
        isRequested: {
            type: Boolean,
            default: false
        },
        address: String,
        requestedTime: Date
    },
    // --- NEW FIELDS FOR PICKUP DISPATCH & ASSIGNMENT ---
    pickupStatus: {
        type: String,
        enum: ['Not Requested', 'Requested', 'Assigned', 'In Transit', 'Completed', 'Cancelled'],
        default: 'Not Requested',
        index: true
    },
    assignedCollector: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    scheduledPickupTime: {
        type: Date
    },
    dispatchNotes: {
        type: String,
        maxlength: [300, 'Dispatch notes cannot exceed 300 characters']
    },
    // ----------------------------------------------------
    adminNote: String,
    pointsEarned: Number,
    pointsAwarded: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
wasteLogSchema.index({ citizenId: 1, createdAt: -1 });
wasteLogSchema.index({ status: 1 });
wasteLogSchema.index({ wasteType: 1 });
wasteLogSchema.index({ 'location.coordinates': '2dsphere' });
wasteLogSchema.index({ createdAt: -1 });
wasteLogSchema.index({ pickupStatus: 1 }); // Index for pickup queries

// Virtual for backward compatibility
wasteLogSchema.virtual('citizen_populated', {
    ref: 'User',
    localField: 'citizenId',
    foreignField: '_id',
    justOne: true
});

// Pre-save middleware for data validation and normalization
wasteLogSchema.pre('save', function(next) {
    // Ensure backward compatibility
    if (this.citizenId && !this.citizen) {
        this.citizen = this.citizenId;
    }
    if (this.citizen && !this.citizenId) {
        this.citizenId = this.citizen;
    }
    
    // Map new wasteType to legacy material field
    if (this.wasteType && !this.material) {
        const typeMapping = {
            'plastic': 'Plastic',
            'paper': 'Paper',
            'metal': 'Metal',
            'glass': 'Glass',
            'electronic': 'E-Waste',
            'organic': 'Organic',
            'hazardous': 'Other'
        };
        this.material = typeMapping[this.wasteType] || 'Other';
    }
    
    // Map legacy material to new wasteType
    if (this.material && !this.wasteType) {
        const materialMapping = {
            'Plastic': 'plastic',
            'Paper': 'paper',
            'Metal': 'metal',
            'Glass': 'glass',
            'E-Waste': 'electronic',
            'Organic': 'organic',
            'Other': 'hazardous'
        };
        this.wasteType = materialMapping[this.material] || 'hazardous';
    }
    
    // Handle legacy photo field
    if (this.photo && (!this.photos || this.photos.length === 0)) {
        this.photos = [this.photo];
    }
    if (this.photos && this.photos.length > 0 && !this.photo) {
        this.photo = this.photos[0];
    }
    
    // Handle legacy points fields
    if (this.ecoPointsEarned && !this.pointsEarned) {
        this.pointsEarned = this.ecoPointsEarned;
    }
    if (this.pointsEarned && !this.ecoPointsEarned) {
        this.ecoPointsEarned = this.pointsEarned;
    }
    
    // Normalize status values
    if (this.status) {
        const statusMapping = {
            'Pending': 'pending',
            'Accepted': 'verified',
            'Collected': 'verified',
            'Rejected': 'rejected',
            'On Hold': 'pending'
        };
        if (statusMapping[this.status]) {
            this.status = statusMapping[this.status];
        }
    }
    
    if (typeof next === 'function') {
        next();
    }
});

// Static methods for validation
wasteLogSchema.statics.validateWasteData = function(data) {
    const errors = [];
    
    if (!data.citizenId && !data.citizen) {
        errors.push('Citizen ID is required');
    }
    
    if (!data.wasteType && !data.material) {
        errors.push('Waste type is required');
    }
    
    if (!data.weight || data.weight < 0.1) {
        errors.push('Weight must be at least 0.1 kg');
    }
    
    if (data.weight && data.weight > 1000) {
        errors.push('Weight cannot exceed 1000 kg');
    }
    
    if (data.description && data.description.length > 500) {
        errors.push('Description cannot exceed 500 characters');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
};

// Instance methods
wasteLogSchema.methods.calculatePoints = async function() {
    const WasteTypeConfig = mongoose.model('WasteTypeConfig');
    try {
        const config = await WasteTypeConfig.findOne({ 
            type: this.wasteType || this.material?.toLowerCase(),
            isActive: true 
        });
        
        if (config) {
            this.ecoPointsEarned = Math.round(config.pointsPerKg * this.weight);
            this.co2Saved = config.co2SavedPerKg * this.weight;
            this.pointsEarned = this.ecoPointsEarned; // Backward compatibility
        }
        
        return this.ecoPointsEarned;
    } catch (error) {
        console.error('Error calculating points:', error);
        return 0;
    }
};

wasteLogSchema.methods.verify = function(verifiedBy, note) {
    this.status = 'verified';
    this.verifiedAt = new Date();
    this.verifiedBy = verifiedBy;
    if (note) {
        this.adminNote = note;
    }
    return this.save();
};

wasteLogSchema.methods.reject = function(rejectedBy, reason) {
    this.status = 'rejected';
    this.verifiedAt = new Date();
    this.verifiedBy = rejectedBy;
    this.rejectionReason = reason;
    return this.save();
};

// Create model with both names for compatibility
const WasteLog = mongoose.model('WasteLog', wasteLogSchema);
const Waste = mongoose.model('Waste', wasteLogSchema);

export default WasteLog;
export { Waste };