import mongoose from 'mongoose';

const voucherSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    shopName: { type: String, required: true },
    discountAmount: { type: Number, required: true }, // e.g., 50 for $50 or 10 for 10%
    pointsRequired: { type: Number, required: true },
    isRedeemed: { type: Boolean, default: false },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.model('Voucher', voucherSchema);