import mongoose from 'mongoose';

const campaignSchema = new mongoose.Schema({
    title: { 
        type: String, 
        required: true 
    },
    content: { 
        type: String, 
        required: true 
    },
    category: { 
        type: String, 
        enum: ['News', 'Recycling Fact', 'Event'], 
        default: 'News' 
    },
    imageUrl: { 
        type: String 
    }, 
    // We use postedBy for the Admin's Name
    postedBy: { 
        type: String, 
        default: 'Administrator' 
    },
    // We add adminId to track the specific database ID of the poster
    adminId: { 
        type: String,
        required: true 
    },
    status: { 
        type: String, 
        enum: ['Active', 'Archived'], 
        default: 'Active' 
    }
}, { timestamps: true });

export default mongoose.model('Campaign', campaignSchema);