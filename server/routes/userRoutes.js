import express from 'express';
import { getAllUsers } from '../controllers/userController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /api/users - Get all users (Admin only)
router.get('/', protect, authorize('admin'), getAllUsers);

export default router;