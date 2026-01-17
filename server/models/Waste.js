import mongoose from 'mongoose';

const wasteSchema = new mongoose.Schema({
    citizen: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    material: {
        type: String,
        required: true,
        enum: ['Plastic', 'Paper', 'Metal', 'Glass', 'E-Waste', 'Organic', 'Other'],
    },
    weight: {
        type: Number,
        required: true,
        min: 0.1,
    },
    photo: {
        type: String,
        required: false,
    },
    status: {
        type: String,
        required: true,
        enum: ['Pending', 'Accepted', 'Collected', 'Rejected', 'On Hold'], // Updated to include On Hold
        default: 'Pending',
    },
    collector: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
    },
    // Keep your exact pickupDetails logic
    pickupDetails: {
        isRequested: {
            type: Boolean,
            default: false,
        },
        address: {
            type: String,
            required: function() { return this.pickupDetails.isRequested; },
        },
        requestedTime: {
            type: Date,
            required: function() { return this.pickupDetails.isRequested; },
        },
    },
    adminNote: { type: String, required: false }, // New: to save hold reason
}, {
    timestamps: true
});

const Waste = mongoose.model('Waste', wasteSchema);
export default Waste;