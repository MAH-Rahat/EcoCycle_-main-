import express from 'express';
import {
    generatePickupQR,
    verifyQRCode,
    completePickup,
    getPickupByQR,
    getQRVerificationHistory
} from '../controllers/qrVerificationController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Generate QR code for pickup (admin/system use)
router.get('/pickup/:pickupId/qr', generatePickupQR);

// Get pickup details by QR code
router.get('/pickup/qr/:qrCode', getPickupByQR);

// Verify QR code (collector use)
router.post('/verify', authorize('collector', 'admin'), verifyQRCode);

// Complete pickup after QR verification (collector use)
router.post('/pickup/:pickupId/complete', authorize('collector', 'admin'), completePickup);

// Get QR verification history (admin use)
router.get('/history', authorize('admin'), getQRVerificationHistory);

export default router;