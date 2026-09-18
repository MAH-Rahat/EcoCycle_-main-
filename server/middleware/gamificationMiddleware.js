import GamificationService from '../services/gamificationService.js';

/**
 * Middleware to process gamification after waste logging
 */
export const processWasteLogGamification = async (req, res, next) => {
    try {
        // Store original res.json to intercept response
        const originalJson = res.json;
        
        res.json = function(data) {
            // Call original json method first
            originalJson.call(this, data);
            
            // Process gamification asynchronously if waste log was successful
            if (data.success && data.data && req.user) {
                const wasteLog = data.data;
                
                // Process gamification in background
                setImmediate(async () => {
                    try {
                        await GamificationService.processUserActivity(req.user.id, {
                            type: 'waste_logged',
                            wasteType: wasteLog.wasteType,
                            weight: wasteLog.weight,
                            points: wasteLog.ecoPointsEarned || 0,
                            wasteLogId: wasteLog._id
                        });
                    } catch (error) {
                        console.error('Error processing waste log gamification:', error);
                    }
                });
            }
        };
        
        next();
    } catch (error) {
        console.error('Error in waste log gamification middleware:', error);
        next();
    }
};

/**
 * Middleware to process gamification after pickup completion
 */
export const processPickupGamification = async (req, res, next) => {
    try {
        // Store original res.json to intercept response
        const originalJson = res.json;
        
        res.json = function(data) {
            // Call original json method first
            originalJson.call(this, data);
            
            // Process gamification asynchronously if pickup was successful
            if (data.success && data.data && req.user) {
                const pickup = data.data;
                
                // Process gamification in background
                setImmediate(async () => {
                    try {
                        // Determine the citizen ID (could be from pickup or current user)
                        const citizenId = pickup.citizenId || req.user.id;
                        
                        await GamificationService.processUserActivity(citizenId, {
                            type: 'pickup_completed',
                            pickupId: pickup._id,
                            weight: pickup.actualWeight || pickup.estimatedWeight || 0,
                            points: pickup.ecoPointsAwarded || 0
                        });
                    } catch (error) {
                        console.error('Error processing pickup gamification:', error);
                    }
                });
            }
        };
        
        next();
    } catch (error) {
        console.error('Error in pickup gamification middleware:', error);
        next();
    }
};

/**
 * Middleware to process gamification after challenge completion
 */
export const processChallengeGamification = async (req, res, next) => {
    try {
        // Store original res.json to intercept response
        const originalJson = res.json;
        
        res.json = function(data) {
            // Call original json method first
            originalJson.call(this, data);
            
            // Process gamification asynchronously if challenge was completed
            if (data.success && data.data && req.user) {
                const challengeData = data.data;
                
                // Process gamification in background
                setImmediate(async () => {
                    try {
                        await GamificationService.processUserActivity(req.user.id, {
                            type: 'challenge_completed',
                            challengeId: challengeData.challengeId || req.params.id,
                            points: challengeData.pointsAwarded || 0,
                            badge: challengeData.badge
                        });
                    } catch (error) {
                        console.error('Error processing challenge gamification:', error);
                    }
                });
            }
        };
        
        next();
    } catch (error) {
        console.error('Error in challenge gamification middleware:', error);
        next();
    }
};

/**
 * Middleware to process gamification after streak updates
 */
export const processStreakGamification = async (userId, streakData) => {
    try {
        await GamificationService.processUserActivity(userId, {
            type: 'streak_updated',
            streak: streakData.currentStreak,
            longestStreak: streakData.longestStreak,
            streakType: streakData.type || 'daily'
        });
    } catch (error) {
        console.error('Error processing streak gamification:', error);
    }
};

/**
 * Middleware to process gamification after milestone achievements
 */
export const processMilestoneGamification = async (userId, milestoneData) => {
    try {
        await GamificationService.processUserActivity(userId, {
            type: 'milestone_achieved',
            milestone: milestoneData.milestone,
            value: milestoneData.value,
            category: milestoneData.category
        });
    } catch (error) {
        console.error('Error processing milestone gamification:', error);
    }
};

/**
 * Generic gamification processor for any activity
 */
export const processActivityGamification = async (userId, activityType, activityData) => {
    try {
        await GamificationService.processUserActivity(userId, {
            type: activityType,
            ...activityData
        });
    } catch (error) {
        console.error(`Error processing ${activityType} gamification:`, error);
    }
};

export default {
    processWasteLogGamification,
    processPickupGamification,
    processChallengeGamification,
    processStreakGamification,
    processMilestoneGamification,
    processActivityGamification
};