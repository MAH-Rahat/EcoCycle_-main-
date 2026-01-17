import express from 'express';
import { createPickup, getPickupsByCitizen } from '../controllers/pickupController.js';

const router = express.Router();

// @route   POST /api/pickup/schedule
router.post('/schedule', createPickup);

// @route   GET /api/pickup/user/:userId
router.get('/user/:userId', getPickupsByCitizen);

export default router;