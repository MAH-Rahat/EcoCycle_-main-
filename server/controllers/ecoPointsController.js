import EcoPointsWallet from '../models/EcoPointsWallet.js';
import WasteTypeConfig from '../models/WasteTypeConfig.js';
import User from '../models/User.js';
import socketService from '../services/socketService.js';

// Get wallet balance and recent transactions
export const getWallet = async (req, res) => {
    try {
        const citizenId = req.user.id;
        
        const wallet = await EcoPointsWallet.getOrCreateWallet(citizenId);
        
        // Get recent transactions (last 20)
        const recentTransactions = wallet.transactions
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 20);
        
        res.json({
            success: true,
            data: {
                balance: wallet.balance,
                totalEarned: wallet.totalEarned,
                totalSpent: wallet.totalSpent,
                recentTransactions,
                updatedAt: wallet.updatedAt
            }
        });
    } catch (error) {
        console.error('Get wallet error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve wallet information',
            error: error.message
        });
    }
};

// Get full transaction history with pagination
export const getTransactionHistory = async (req, res) => {
    try {
        const citizenId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const type = req.query.type; // Filter by transaction type
        
        const wallet = await EcoPointsWallet.findOne({ citizenId });
        
        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: 'Wallet not found'
            });
        }
        
        let transactions = wallet.transactions;
        
        // Filter by type if specified
        if (type && ['earned', 'spent', 'bonus', 'penalty'].includes(type)) {
            transactions = transactions.filter(t => t.type === type);
        }
        
        // Sort by date (newest first)
        transactions.sort((a, b) => b.createdAt - a.createdAt);
        
        // Paginate
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedTransactions = transactions.slice(startIndex, endIndex);
        
        res.json({
            success: true,
            data: {
                transactions: paginatedTransactions,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(transactions.length / limit),
                    totalTransactions: transactions.length,
                    hasNext: endIndex < transactions.length,
                    hasPrev: page > 1
                }
            }
        });
    } catch (error) {
        console.error('Get transaction history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve transaction history',
            error: error.message
        });
    }
};

// Award points for waste logging (called internally)
export const awardPointsForWaste = async (citizenId, wasteType, weight, wasteLogId) => {
    try {
        const points = await WasteTypeConfig.calculatePoints(wasteType, weight);
        const wallet = await EcoPointsWallet.getOrCreateWallet(citizenId);
        
        await wallet.addPoints(
            points,
            `Points earned for recycling ${weight}kg of ${wasteType}`,
            wasteLogId,
            'waste'
        );
        
        // Also update the legacy points field in User model for backward compatibility
        await User.findByIdAndUpdate(citizenId, {
            $inc: { points: points }
        });
        
        // Emit real-time wallet update
        socketService.emitWalletUpdate(citizenId.toString(), wallet);
        
        // Send notification about points earned
        socketService.sendNotification(citizenId.toString(), {
            type: 'points_earned',
            title: 'EcoPoints Earned!',
            message: `You earned ${points} EcoPoints for recycling ${weight}kg of ${wasteType}`,
            data: {
                points,
                wasteType,
                weight,
                newBalance: wallet.balance
            }
        });
        
        return { points, newBalance: wallet.balance };
    } catch (error) {
        console.error('Award points error:', error);
        throw error;
    }
};

// Award bonus points (for milestones, challenges, etc.)
export const awardBonusPoints = async (req, res) => {
    try {
        const { citizenId, amount, description, relatedId, relatedType } = req.body;
        
        // Only admins can award bonus points
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only administrators can award bonus points'
            });
        }
        
        if (!citizenId || !amount || !description) {
            return res.status(400).json({
                success: false,
                message: 'Citizen ID, amount, and description are required'
            });
        }
        
        const wallet = await EcoPointsWallet.getOrCreateWallet(citizenId);
        await wallet.addBonus(amount, description, relatedId, relatedType);
        
        // Update legacy points field
        await User.findByIdAndUpdate(citizenId, {
            $inc: { points: amount }
        });
        
        // Emit real-time wallet update
        socketService.emitWalletUpdate(citizenId, wallet);
        
        // Send notification about bonus points
        socketService.sendNotification(citizenId, {
            type: 'bonus_points',
            title: 'Bonus EcoPoints!',
            message: description,
            data: {
                points: amount,
                newBalance: wallet.balance
            }
        });
        
        res.json({
            success: true,
            message: 'Bonus points awarded successfully',
            data: {
                pointsAwarded: amount,
                newBalance: wallet.balance
            }
        });
    } catch (error) {
        console.error('Award bonus points error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to award bonus points',
            error: error.message
        });
    }
};

// Spend points (for reward redemption)
export const spendPoints = async (citizenId, amount, description, relatedId, relatedType) => {
    try {
        const wallet = await EcoPointsWallet.getOrCreateWallet(citizenId);
        
        if (wallet.balance < amount) {
            throw new Error('Insufficient balance');
        }
        
        await wallet.spendPoints(amount, description, relatedId, relatedType);
        
        // Update legacy points field
        await User.findByIdAndUpdate(citizenId, {
            $inc: { points: -amount }
        });
        
        // Emit real-time wallet update
        socketService.emitWalletUpdate(citizenId.toString(), wallet);
        
        // Send notification about points spent
        socketService.sendNotification(citizenId.toString(), {
            type: 'points_spent',
            title: 'EcoPoints Spent',
            message: description,
            data: {
                points: amount,
                newBalance: wallet.balance
            }
        });
        
        return { newBalance: wallet.balance };
    } catch (error) {
        console.error('Spend points error:', error);
        throw error;
    }
};

// Get wallet statistics
export const getWalletStats = async (req, res) => {
    try {
        const citizenId = req.user.id;
        const wallet = await EcoPointsWallet.findOne({ citizenId });
        
        if (!wallet) {
            return res.json({
                success: true,
                data: {
                    balance: 0,
                    totalEarned: 0,
                    totalSpent: 0,
                    transactionCount: 0,
                    averageEarning: 0,
                    monthlyStats: []
                }
            });
        }
        
        // Calculate monthly statistics
        const monthlyStats = {};
        wallet.transactions.forEach(transaction => {
            const month = transaction.createdAt.toISOString().substring(0, 7); // YYYY-MM
            
            if (!monthlyStats[month]) {
                monthlyStats[month] = { earned: 0, spent: 0, count: 0 };
            }
            
            if (transaction.type === 'earned' || transaction.type === 'bonus') {
                monthlyStats[month].earned += transaction.amount;
            } else if (transaction.type === 'spent') {
                monthlyStats[month].spent += transaction.amount;
            }
            monthlyStats[month].count++;
        });
        
        // Convert to array and sort by month
        const monthlyStatsArray = Object.entries(monthlyStats)
            .map(([month, stats]) => ({ month, ...stats }))
            .sort((a, b) => b.month.localeCompare(a.month))
            .slice(0, 12); // Last 12 months
        
        const averageEarning = wallet.transactions.length > 0 
            ? wallet.totalEarned / wallet.transactions.filter(t => t.type === 'earned' || t.type === 'bonus').length 
            : 0;
        
        res.json({
            success: true,
            data: {
                balance: wallet.balance,
                totalEarned: wallet.totalEarned,
                totalSpent: wallet.totalSpent,
                transactionCount: wallet.transactions.length,
                averageEarning: Math.round(averageEarning * 100) / 100,
                monthlyStats: monthlyStatsArray
            }
        });
    } catch (error) {
        console.error('Get wallet stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve wallet statistics',
            error: error.message
        });
    }
};

// Get waste type configurations
export const getWasteTypeConfigs = async (req, res) => {
    try {
        const configs = await WasteTypeConfig.getActiveTypes();
        
        res.json({
            success: true,
            data: configs
        });
    } catch (error) {
        console.error('Get waste type configs error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve waste type configurations',
            error: error.message
        });
    }
};