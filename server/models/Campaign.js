import mongoose from 'mongoose';

const campaignSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    category: { 
        type: String, 
        enum: ['News', 'Recycling Fact', 'Event'], 
        default: 'News' 
    },
    imageUrl: { type: String }, // For posting a photo with the news
    author: { type: String, default: 'Admin' }
}, { timestamps: true });

export default mongoose.model('Campaign', campaignSchema);