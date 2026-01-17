import express from 'express';
// We import the functions we just created in the controller
import { 
    getAllUsers, 
    getUserActivity, 
    deleteUser 
} from '../controllers/AdminUserManagementController.js';

const router = express.Router();

// Define the paths
router.get('/all', getAllUsers);
router.get('/activity/:id', getUserActivity);
router.delete('/:id', deleteUser);

// Correctly exporting the defined router
export default router;