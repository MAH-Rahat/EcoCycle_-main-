import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema({
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true }, // e.g., "USER_LOGIN", "DELETE_ACCOUNT", "AWARD_POINTS"
    details: { type: String },
}, { timestamps: true });

export default mongoose.model('ActivityLog', activityLogSchema);