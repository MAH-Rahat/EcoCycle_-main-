import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

class SocketService {
    constructor() {
        this.io = null;
        this.connectedUsers = new Map(); // userId -> socketId mapping
    }

    initialize(server) {
        this.io = new Server(server, {
            cors: {
                origin: ["https://ecocycle-frontend.vercel.app", "http://localhost:5173"],
                credentials: true
            }
        });

        // Authentication middleware for socket connections
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token;
                
                if (!token) {
                    return next(new Error('Authentication error: No token provided'));
                }

                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await User.findById(decoded.id).select('-password');
                
                if (!user) {
                    return next(new Error('Authentication error: User not found'));
                }

                socket.userId = user._id.toString();
                socket.userRole = user.role;
                next();
            } catch (error) {
                console.error('Socket authentication error:', error);
                next(new Error('Authentication error: Invalid token'));
            }
        });

        this.io.on('connection', (socket) => {
            console.log(`User ${socket.userId} connected with socket ${socket.id}`);
            
            // Store the connection
            this.connectedUsers.set(socket.userId, socket.id);
            
            // Join user to their personal room
            socket.join(`user_${socket.userId}`);
            
            // Join role-based rooms
            socket.join(`role_${socket.userRole}`);

            // Handle wallet subscription
            socket.on('subscribe_wallet', () => {
                socket.join(`wallet_${socket.userId}`);
                console.log(`User ${socket.userId} subscribed to wallet updates`);
            });

            // Handle wallet unsubscription
            socket.on('unsubscribe_wallet', () => {
                socket.leave(`wallet_${socket.userId}`);
                console.log(`User ${socket.userId} unsubscribed from wallet updates`);
            });

            // Handle pickup tracking subscription
            socket.on('subscribe_pickup', (pickupId) => {
                socket.join(`pickup_${pickupId}`);
                console.log(`User ${socket.userId} subscribed to pickup ${pickupId} updates`);
            });

            // Handle pickup tracking unsubscription
            socket.on('unsubscribe_pickup', (pickupId) => {
                socket.leave(`pickup_${pickupId}`);
                console.log(`User ${socket.userId} unsubscribed from pickup ${pickupId} updates`);
            });

            // Handle dashboard subscription
            socket.on('subscribe_dashboard', () => {
                this.subscribeToDashboard(socket);
            });

            // Handle dashboard unsubscription
            socket.on('unsubscribe_dashboard', () => {
                this.unsubscribeFromDashboard(socket);
            });

            // Handle notification acknowledgment
            socket.on('notification_ack', async (data) => {
                try {
                    const { notificationId, deliveryId } = data;
                    
                    // Import notification service here to avoid circular dependency
                    const { default: notificationService } = await import('./notificationService.js');
                    
                    await notificationService.handleNotificationAcknowledgment(notificationId, socket.userId);
                    
                    console.log(`Notification ${notificationId} acknowledged by user ${socket.userId}`);
                } catch (error) {
                    console.error('Error handling notification acknowledgment:', error);
                }
            });

            // Handle notification status request
            socket.on('get_notification_status', async () => {
                try {
                    const { default: notificationService } = await import('./notificationService.js');
                    
                    const status = await notificationService.getNotificationStatus(socket.userId);
                    socket.emit('notification_status', status);
                } catch (error) {
                    console.error('Error getting notification status:', error);
                    socket.emit('notification_status_error', { error: error.message });
                }
            });

            // Handle real-time notification preferences update
            socket.on('update_notification_preferences', (preferences) => {
                // Store preferences in socket for real-time filtering
                socket.notificationPreferences = preferences;
                console.log(`Notification preferences updated for user ${socket.userId}`);
            });

            // Handle disconnect
            socket.on('disconnect', () => {
                console.log(`User ${socket.userId} disconnected`);
                this.connectedUsers.delete(socket.userId);
            });
        });

        console.log('✅ Socket.io server initialized');
    }

    // Emit wallet update to a specific user
    emitWalletUpdate(userId, walletData) {
        if (this.io) {
            this.io.to(`wallet_${userId}`).emit('wallet_updated', {
                balance: walletData.balance,
                totalEarned: walletData.totalEarned,
                totalSpent: walletData.totalSpent,
                lastTransaction: walletData.transactions[walletData.transactions.length - 1],
                updatedAt: walletData.updatedAt
            });
            console.log(`Wallet update sent to user ${userId}`);
        }
    }

    // Emit new transaction to a specific user
    emitNewTransaction(userId, transaction) {
        if (this.io) {
            this.io.to(`wallet_${userId}`).emit('new_transaction', transaction);
            console.log(`New transaction notification sent to user ${userId}`);
        }
    }

    // Emit pickup status update
    emitPickupStatusUpdate(pickupId, statusData) {
        if (this.io) {
            this.io.to(`pickup_${pickupId}`).emit('pickup_status_updated', statusData);
            console.log(`Pickup status update sent for pickup ${pickupId}`);
        }
    }

    // Broadcast collector location to pickup subscribers
    broadcastCollectorLocation(pickupId, locationData) {
        if (this.io) {
            this.io.to(`pickup_${pickupId}`).emit('collector_location_updated', locationData);
            console.log(`Collector location update sent for pickup ${pickupId}`);
        }
    }

    // Send notification to a specific user with delivery confirmation
    sendNotification(userId, notification) {
        if (this.io) {
            const userRoom = `user_${userId}`;
            const socketId = this.connectedUsers.get(userId);
            
            if (socketId) {
                // User is connected - send with delivery confirmation
                this.io.to(userRoom).emit('notification', {
                    ...notification,
                    deliveryId: `${notification.id}_${Date.now()}`,
                    requiresAck: true
                });
                
                console.log(`Real-time notification sent to user ${userId}: ${notification.title}`);
                return { delivered: true, realTime: true };
            } else {
                // User not connected - store for when they reconnect
                this.io.to(userRoom).emit('notification', {
                    ...notification,
                    offline: true
                });
                
                console.log(`Offline notification queued for user ${userId}: ${notification.title}`);
                return { delivered: true, realTime: false };
            }
        }
        return { delivered: false, realTime: false };
    }

    // Emit in-app notification update
    emitInAppNotificationUpdate(userId, updateData) {
        if (this.io) {
            this.io.to(`user_${userId}`).emit('in_app_notification_update', updateData);
            console.log(`In-app notification update sent to user ${userId}`);
        }
    }

    // Emit notification status update
    emitNotificationStatusUpdate(userId, statusData) {
        if (this.io) {
            this.io.to(`user_${userId}`).emit('notification_status_update', statusData);
            console.log(`Notification status update sent to user ${userId}`);
        }
    }

    // Emit notification acknowledgment
    emitNotificationAcknowledged(userId, ackData) {
        if (this.io) {
            this.io.to(`user_${userId}`).emit('notification_acknowledged', ackData);
            console.log(`Notification acknowledgment sent to user ${userId}`);
        }
    }

    // Send notification to all users with a specific role
    sendRoleNotification(role, notification) {
        if (this.io) {
            this.io.to(`role_${role}`).emit('notification', notification);
            console.log(`Notification sent to all ${role}s: ${notification.title}`);
        }
    }

    // Send system-wide notification
    sendSystemNotification(notification) {
        if (this.io) {
            this.io.emit('system_notification', notification);
            console.log(`System notification sent: ${notification.title}`);
        }
    }

    // Emit dashboard update to a specific user
    emitDashboardUpdate(userId, dashboardData) {
        if (this.io) {
            this.io.to(`user_${userId}`).emit('dashboard_updated', {
                totalWasteRecycled: dashboardData.totalWasteRecycled,
                co2Saved: dashboardData.co2Saved,
                ecoPointsEarned: dashboardData.ecoPointsEarned,
                pickupsCompleted: dashboardData.pickupsCompleted,
                currentStreak: dashboardData.currentStreak,
                longestStreak: dashboardData.longestStreak,
                wasteBreakdown: dashboardData.wasteBreakdown,
                monthlyTrends: dashboardData.monthlyTrends.slice(-12), // Last 12 months
                updatedAt: dashboardData.updatedAt
            });
            console.log(`Dashboard update sent to user ${userId}`);
        }
    }

    // Emit achievement unlock notification
    emitAchievementUnlocked(userId, achievement) {
        if (this.io) {
            this.io.to(`user_${userId}`).emit('achievement_unlocked', {
                achievement,
                timestamp: new Date()
            });
            console.log(`Achievement unlocked notification sent to user ${userId}: ${achievement.name}`);
        }
    }

    // Emit milestone reached notification
    emitMilestoneReached(userId, milestone) {
        if (this.io) {
            this.io.to(`user_${userId}`).emit('milestone_reached', {
                milestone,
                timestamp: new Date()
            });
            console.log(`Milestone reached notification sent to user ${userId}: ${milestone.name}`);
        }
    }

    // Emit leaderboard update to all users
    emitLeaderboardUpdate(leaderboardData) {
        if (this.io) {
            this.io.to('role_citizen').emit('leaderboard_updated', leaderboardData);
            console.log('Leaderboard update sent to all citizens');
        }
    }

    // Handle dashboard subscription
    subscribeToDashboard(socket) {
        socket.join(`dashboard_${socket.userId}`);
        console.log(`User ${socket.userId} subscribed to dashboard updates`);
    }

    // Handle dashboard unsubscription
    unsubscribeFromDashboard(socket) {
        socket.leave(`dashboard_${socket.userId}`);
        console.log(`User ${socket.userId} unsubscribed from dashboard updates`);
    }

    // Get connected users count
    getConnectedUsersCount() {
        return this.connectedUsers.size;
    }

    // Check if user is connected
    isUserConnected(userId) {
        return this.connectedUsers.has(userId);
    }
}

// Create singleton instance
const socketService = new SocketService();
export default socketService;