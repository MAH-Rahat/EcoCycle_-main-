import User from '../models/User.js';
import ActivityLog from '../models/ActivityLog.js';

/**
 * @desc    Get all users (filtered by role if needed, or all at once)
 * @route   GET /api/users/all
 */
export const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}).select('-password -adminCode').sort({ createdAt: -1 });
        res.status(200).json(users);
    } catch (error) {
        console.error("Fetch All Users Error:", error);
        res.status(500).json({ message: "Server Error fetching account records" });
    }
};

/**
 * @desc    Get activity logs for a specific user
 * @route   GET /api/users/activity/:id
 */
export const getUserActivity = async (req, res) => {
    try {
        const logs = await ActivityLog.find({ performedBy: req.params.id })
            .sort({ createdAt: -1 })
            .limit(10);
        res.status(200).json(logs);
    } catch (error) {
        console.error("Fetch Activity Error:", error);
        res.status(500).json({ message: "Error fetching activity logs" });
    }
};

/**
 * @desc    Delete any user by ID
 * @route   DELETE /api/users/:id
 */
export const deleteUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        await User.findByIdAndDelete(userId);
        
        res.status(200).json({ 
            success: true, 
            message: `Account for ${user.name} (${user.role}) has been removed.` 
        });
    } catch (error) {
        console.error("Delete User Error:", error);
        res.status(500).json({ message: "Internal server error during deletion" });
    }
};