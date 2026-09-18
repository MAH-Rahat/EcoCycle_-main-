import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import PickupStatusHistory from './PickupStatusHistory.js';

const pickupSchema = new mongoose.Schema({
    citizenId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: false, // Made optional to prevent validation blocks during quick scheduling
        default: null
    },
    wasteLogIds: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Waste'
    }],
    address: {
        street: { type: String, default: 'Dhaka Central' },
        city: { type: String, default: 'Dhaka' },
        zipCode: { type: String, default: '1000' },
        coordinates: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point'
            },
            coordinates: {
                type: [Number], // [longitude, latitude]
                default: [90.4125, 23.8103] // Default to Dhaka coordinates
            }
        }
    },
    scheduledTime: { 
        type: Date, 
        required: false,
        default: Date.now
    },
    priority: { 
        type: String, 
        enum: ['low', 'medium', 'high', 'urgent'], 
        default: 'medium',
        required: true 
    },
    status: { 
        type: String, 
        default: 'pending', 
        enum: ['pending', 'assigned', 'en_route', 'arrived', 'in_progress', 'completed', 'cancelled']
    },
    // QR Code fields
    qrCode: {
        type: String,
        unique: true,
        sparse: true // Allows multiple null values
    },
    qrCodeImage: {
        type: String, // Base64 encoded QR code image
        required: false
    },
    qrVerified: {
        type: Boolean,
        default: false
    },
    qrVerifiedAt: {
        type: Date,
        required: false
    },
    qrVerifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    // Collector assignment
    assignedCollectorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    assignedAt: {
        type: Date,
        required: false
    },
    // Estimated weight from waste logs
    estimatedWeight: {
        type: Number,
        required: false,
        default: 1,
        min: 0
    },
    // Completion details
    actualWeight: {
        type: Number,
        required: false,
        min: 0
    },
    notes: {
        type: String,
        maxLength: 500
    },
    collectionPhotos: [{
        type: String // URLs to photos taken during collection
    }],
    completedAt: {
        type: Date,
        required: false
    },
    // Tracking
    estimatedArrival: {
        type: Date,
        required: false
    },
    collectorLocation: {
        lat: Number,
        lng: Number,
        updatedAt: Date
    },
    // Cancellation
    cancelledAt: {
        type: Date,
        required: false
    },
    cancellationReason: {
        type: String,
        maxLength: 500
    },
    cancelledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    }
}, { timestamps: true });

// Indexes for efficient queries
pickupSchema.index({ citizenId: 1, createdAt: -1 });
pickupSchema.index({ assignedCollectorId: 1, status: 1 });
pickupSchema.index({ status: 1, scheduledTime: 1 });
pickupSchema.index({ qrCode: 1 }, { unique: true, sparse: true });
pickupSchema.index({ 'address.coordinates': '2dsphere' });
pickupSchema.index({ priority: 1, createdAt: 1 });

// Pre-save normalization and immutability checks
pickupSchema.pre('save', async function(next) {
    // Ensure nested address and coordinate fields have defaults if partially missing
    if (!this.address) {
        this.address = { street: 'Dhaka Central', city: 'Dhaka', zipCode: '1000', coordinates: { type: 'Point', coordinates: [90.4125, 23.8103] } };
    } else {
        if (!this.address.street) this.address.street = 'Dhaka Central';
        if (!this.address.city) this.address.city = 'Dhaka';
        if (!this.address.zipCode) this.address.zipCode = '1000';
        if (!this.address.coordinates || !this.address.coordinates.coordinates || this.address.coordinates.coordinates.length !== 2) {
            this.address.coordinates = { type: 'Point', coordinates: [90.4125, 23.8103] };
        }
    }

    if (this.estimatedWeight === undefined || this.estimatedWeight === null) {
        this.estimatedWeight = 1;
    }

    // Prevent modification of collection report fields once pickup is completed
    if (!this.isNew && this.status === 'completed') {
        const originalDoc = await this.constructor.findById(this._id);
        
        if (originalDoc && originalDoc.status === 'completed') {
            const immutableFields = [
                'actualWeight',
                'notes', 
                'collectionPhotos',
                'completedAt',
                'qrVerified',
                'qrVerifiedAt',
                'qrVerifiedBy'
            ];
            
            for (const field of immutableFields) {
                if (this.isModified(field)) {
                    const error = new Error(`Collection report field '${field}' cannot be modified after pickup completion`);
                    error.name = 'CollectionReportImmutabilityError';
                    if (typeof next === 'function') {
                        return next(error);
                    } else {
                        throw error;
                    }
                }
            }
            
            if (this.isModified('status') && originalDoc.status === 'completed') {
                const error = new Error('Cannot change status of completed pickup');
                error.name = 'CollectionReportImmutabilityError';
                if (typeof next === 'function') {
                    return next(error);
                } else {
                    throw error;
                }
            }
        }
    }

    // Generate QR code when pickup is assigned
    if (this.isModified('status') && this.status === 'assigned' && !this.qrCode) {
        try {
            this.qrCode = `PICKUP-${uuidv4()}`;
            
            const qrData = JSON.stringify({
                pickupId: this._id,
                qrCode: this.qrCode,
                citizenId: this.citizenId,
                timestamp: new Date().toISOString()
            });
            
            this.qrCodeImage = await QRCode.toDataURL(qrData, {
                errorCorrectionLevel: 'M',
                type: 'image/png',
                quality: 0.92,
                margin: 1,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
        } catch (error) {
            console.error('QR code generation error:', error);
            if (typeof next === 'function') {
                return next(error);
            } else {
                throw error;
            }
        }
    }

    // Log status changes
    if (this.isModified('status') && !this.isNew) {
        const originalDoc = await this.constructor.findById(this._id);
        const fromStatus = originalDoc ? originalDoc.status : null;
        const toStatus = this.status;
        
        if (fromStatus !== toStatus) {
            this._statusChanged = {
                from: fromStatus,
                to: toStatus
            };
        }
    }
    
    if (typeof next === 'function') {
        next();
    }
});

// Log status change after save
pickupSchema.post('save', async function(doc) {
    if (doc._statusChanged) {
        try {
            const metadata = {};
            
            if (doc.status === 'assigned' && doc.assignedCollectorId) {
                metadata.assignedCollectorId = doc.assignedCollectorId;
                metadata.assignedAt = doc.assignedAt;
            }
            
            if (doc.status === 'en_route' && doc.estimatedArrival) {
                metadata.estimatedArrival = doc.estimatedArrival;
            }
            
            if (doc.collectorLocation) {
                metadata.location = doc.collectorLocation;
            }
            
            if (doc.status === 'in_progress' && doc.qrVerified) {
                metadata.qrVerified = doc.qrVerified;
                metadata.qrVerifiedAt = doc.qrVerifiedAt;
            }
            
            if (doc.status === 'completed') {
                metadata.actualWeight = doc.actualWeight;
                metadata.completedAt = doc.completedAt;
            }
            
            if (doc.status === 'cancelled') {
                metadata.cancelledAt = doc.cancelledAt;
                metadata.cancellationReason = doc.cancellationReason;
            }
            
            await PickupStatusHistory.logStatusChange(
                doc._id,
                doc._statusChanged.from,
                doc._statusChanged.to,
                doc.assignedCollectorId || doc.citizenId,
                `Status changed from ${doc._statusChanged.from || 'initial'} to ${doc._statusChanged.to}`,
                metadata
            );
        } catch (error) {
            console.error('Error logging status change:', error);
        }
        
        delete doc._statusChanged;
    }
});

// Method to verify QR code
pickupSchema.methods.verifyQRCode = function(scannedCode, collectorId) {
    if (this.qrCode !== scannedCode) {
        return { success: false, message: 'Invalid QR code' };
    }
    
    if (this.qrVerified) {
        return { success: false, message: 'QR code already verified' };
    }
    
    if (this.status !== 'arrived' && this.status !== 'in_progress') {
        return { success: false, message: 'Pickup not ready for verification' };
    }
    
    this.qrVerified = true;
    this.qrVerifiedAt = new Date();
    this.qrVerifiedBy = collectorId;
    this.status = 'in_progress';
    
    return { success: true, message: 'QR code verified successfully' };
};

// Method to complete pickup
pickupSchema.methods.completePickup = function(collectorId, completionData) {
    if (!this.qrVerified) {
        return { success: false, message: 'QR code must be verified before completion' };
    }
    
    if (this.status !== 'in_progress') {
        return { success: false, message: 'Pickup not in progress' };
    }
    
    if (!completionData.actualWeight || completionData.actualWeight <= 0) {
        return { success: false, message: 'Valid actual weight is required' };
    }
    
    this.status = 'completed';
    this.completedAt = new Date();
    this.actualWeight = completionData.actualWeight;
    this.notes = completionData.notes || null;
    this.collectionPhotos = completionData.photos || [];
    this._collectionReportCreated = true;
    
    return { success: true, message: 'Pickup completed successfully' };
};

// Method to get collection report (read-only)
pickupSchema.methods.getCollectionReport = function() {
    if (this.status !== 'completed') {
        return null;
    }
    
    return {
        pickupId: this._id,
        collectorId: this.qrVerifiedBy,
        actualWeight: this.actualWeight,
        collectionNotes: this.notes,
        collectionPhotos: [...this.collectionPhotos],
        completedAt: this.completedAt,
        qrVerified: this.qrVerified,
        qrVerifiedAt: this.qrVerifiedAt,
        qrVerifiedBy: this.qrVerifiedBy,
        immutable: true
    };
};

// Method to cancel pickup
pickupSchema.methods.cancelPickup = function(userId, reason) {
    if (this.status === 'completed') {
        return { success: false, message: 'Cannot cancel completed pickup' };
    }
    
    if (this.status === 'cancelled') {
        return { success: false, message: 'Pickup already cancelled' };
    }
    
    this.status = 'cancelled';
    this.cancelledAt = new Date();
    this.cancellationReason = reason;
    this.cancelledBy = userId;
    
    return { success: true, message: 'Pickup cancelled successfully' };
};

// Method to update collector location
pickupSchema.methods.updateLocation = function(lat, lng) {
    this.collectorLocation = {
        lat,
        lng,
        updatedAt: new Date()
    };
    
    return this.save();
};

// Static method to find pickup by QR code
pickupSchema.statics.findByQRCode = function(qrCode) {
    return this.findOne({ qrCode })
        .populate('citizenId', 'name email mobile')
        .populate('wasteLogIds', 'material weight')
        .populate('assignedCollectorId', 'name email');
};

// Static method to get pickup with history
pickupSchema.statics.getPickupWithHistory = async function(pickupId) {
    const pickup = await this.findById(pickupId)
        .populate('citizenId', 'name email mobile')
        .populate('wasteLogIds', 'material weight')
        .populate('assignedCollectorId', 'name email');
    
    if (!pickup) return null;
    
    const history = await PickupStatusHistory.getPickupHistory(pickupId);
    
    return {
        pickup,
        history
    };
};

// Virtual for pickup duration
pickupSchema.virtual('duration').get(function() {
    if (this.completedAt && this.assignedAt) {
        return this.completedAt - this.assignedAt;
    }
    return null;
});

export default mongoose.model('Pickup', pickupSchema);