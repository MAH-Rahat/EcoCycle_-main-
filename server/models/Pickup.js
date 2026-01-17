import mongoose from 'mongoose';

const pickupSchema = new mongoose.Schema({
    citizen: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    wasteItem: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Waste', 
        required: true 
    },
    address: { 
        type: String, 
        required: true 
    },
    scheduledDate: { 
        type: String, 
        required: true 
    }, // Format: YYYY-MM-DD
    timeSlot: { 
        type: String, 
        enum: ['Morning', 'Afternoon', 'Evening'], 
        required: true 
    },
    status: { 
        type: String, 
        default: 'Pending', 
        enum: ['Pending', 'Assigned', 'Completed'] 
    }
}, { timestamps: true });

export default mongoose.model('Pickup', pickupSchema);