// Enhanced milestone notification functions for impact dashboard
import socketService from '../services/socketService.js';

// Helper function to get milestone bonus points
export const getMilestoneBonusPoints = (achievementName) => {
    const bonusPoints = {
        'First Steps': 25,
        'Getting Started': 50,
        'Eco Enthusiast': 100,
        'Recycling Champion': 200,
        'Eco Warrior': 500,
        'Pickup Pro': 100,
        'Collection Master': 250,
        'Week Warrior': 75,
        'Consistency King': 300,
        'Carbon Saver': 200
    };
    return bonusPoints[achievementName] || 0;
};

// Helper function to get milestone type
export const getMilestoneType = (achievementName) => {
    const milestoneTypes = {
        'First Steps': 'first_waste',
        'Getting Started': 'weight',
        'Eco Enthusiast': 'weight',
        'Recycling Champion': 'weight',
        'Eco Warrior': 'weight',
        'Pickup Pro': 'pickups',
        'Collection Master': 'pickups',
        'Week Warrior': 'streak',
        'Consistency King': 'streak',
        'Carbon Saver': 'co2'
    };
    return milestoneTypes[achievementName] || 'general';
};

// Helper function to get milestone value
export const getMilestoneValue = (achievementName, dashboard) => {
    const milestoneValues = {
        'First Steps': dashboard.totalWasteRecycled,
        'Getting Started': 10,
        'Eco Enthusiast': 50,
        'Recycling Champion': 100,
        'Eco Warrior': 500,
        'Pickup Pro': 10,
        'Collection Master': 50,
        'Week Warrior': 7,
        'Consistency King': 30,
        'Carbon Saver': 100
    };
    return milestoneValues[achievementName] || 0;
};

// Enhanced milestone notification function
export const sendEnhancedMilestoneNotification = (citizenId, achievement, dashboard) => {
    const milestoneNames = [
        'First Steps', 'Getting Started', 'Eco Enthusiast', 'Recycling Champion', 
        'Eco Warrior', 'Pickup Pro', 'Collection Master', 'Week Warrior', 
        'Consistency King', 'Carbon Saver'
    ];
    
    if (milestoneNames.includes(achievement.name)) {
        const bonusPoints = getMilestoneBonusPoints(achievement.name);
        const milestoneType = getMilestoneType(achievement.name);
        const milestoneValue = getMilestoneValue(achievement.name, dashboard);
        
        // Send enhanced milestone notification
        socketService.emitMilestoneReached(citizenId.toString(), {
            name: achievement.name,
            description: achievement.description,
            icon: achievement.icon,
            rarity: achievement.rarity,
            type: milestoneType,
            value: milestoneValue,
            bonusPoints: bonusPoints,
            timestamp: new Date()
        });
        
        // Send congratulatory notification
        socketService.sendNotification(citizenId.toString(), {
            type: 'milestone_celebration',
            title: '🎉 Milestone Achieved!',
            message: `Congratulations! You've reached the "${achievement.name}" milestone and earned ${bonusPoints} bonus EcoPoints!`,
            data: {
                achievement,
                bonusPoints,
                milestoneType,
                milestoneValue,
                totalAchievements: dashboard.achievements.length
            },
            priority: 'high',
            autoClose: false // Don't auto-close milestone notifications
        });
        
        return true;
    }
    
    return false;
};

// Function to calculate trend insights for visualization
export const calculateTrendInsights = (monthlyTrends) => {
    if (!monthlyTrends || monthlyTrends.length < 2) {
        return null;
    }
    
    const sortedTrends = monthlyTrends.sort((a, b) => b.month.localeCompare(a.month));
    const currentMonth = sortedTrends[0];
    const previousMonth = sortedTrends[1];
    
    const insights = {
        weightChange: {
            value: currentMonth.weight - previousMonth.weight,
            percentage: previousMonth.weight > 0 ? 
                ((currentMonth.weight - previousMonth.weight) / previousMonth.weight) * 100 : 0,
            trend: currentMonth.weight >= previousMonth.weight ? 'up' : 'down'
        },
        pointsChange: {
            value: currentMonth.points - previousMonth.points,
            percentage: previousMonth.points > 0 ? 
                ((currentMonth.points - previousMonth.points) / previousMonth.points) * 100 : 0,
            trend: currentMonth.points >= previousMonth.points ? 'up' : 'down'
        },
        co2Change: {
            value: currentMonth.co2Saved - previousMonth.co2Saved,
            percentage: previousMonth.co2Saved > 0 ? 
                ((currentMonth.co2Saved - previousMonth.co2Saved) / previousMonth.co2Saved) * 100 : 0,
            trend: currentMonth.co2Saved >= previousMonth.co2Saved ? 'up' : 'down'
        }
    };
    
    // Calculate performance metrics for 3+ months
    if (sortedTrends.length >= 3) {
        const last3Months = sortedTrends.slice(0, 3);
        
        insights.performance = {
            averageWeight: last3Months.reduce((sum, t) => sum + t.weight, 0) / 3,
            averagePoints: last3Months.reduce((sum, t) => sum + t.points, 0) / 3,
            averageCO2: last3Months.reduce((sum, t) => sum + t.co2Saved, 0) / 3,
            bestMonth: last3Months.reduce((best, current) => 
                current.weight > best.weight ? current : best
            ),
            totalGrowth: last3Months[0].weight - last3Months[last3Months.length - 1].weight,
            consistency: calculateConsistencyScore(last3Months)
        };
    }
    
    return insights;
};

// Helper function to calculate consistency score
const calculateConsistencyScore = (trends) => {
    if (trends.length < 2) return 0;
    
    const weights = trends.map(t => t.weight);
    const mean = weights.reduce((sum, w) => sum + w, 0) / weights.length;
    const variance = weights.reduce((sum, w) => sum + Math.pow(w - mean, 2), 0) / weights.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Lower standard deviation = higher consistency
    // Normalize to 0-100 scale
    const consistencyScore = Math.max(0, 100 - (standardDeviation / mean) * 100);
    return Math.round(consistencyScore);
};

// Function to generate milestone progress data
export const generateMilestoneProgress = (dashboard) => {
    const milestones = {
        weight: [
            { 
                target: 10, 
                name: 'Getting Started', 
                achieved: dashboard.milestones?.first10kg?.achieved || false,
                bonusPoints: 50,
                description: 'Recycle your first 10kg of waste'
            },
            { 
                target: 50, 
                name: 'Eco Enthusiast', 
                achieved: dashboard.milestones?.first50kg?.achieved || false,
                bonusPoints: 100,
                description: 'Reach 50kg of recycled waste'
            },
            { 
                target: 100, 
                name: 'Recycling Champion', 
                achieved: dashboard.milestones?.first100kg?.achieved || false,
                bonusPoints: 200,
                description: 'Achieve 100kg recycling milestone'
            },
            { 
                target: 500, 
                name: 'Eco Warrior', 
                achieved: dashboard.milestones?.ecoWarrior?.achieved || false,
                bonusPoints: 500,
                description: 'Become an Eco Warrior with 500kg recycled'
            }
        ],
        pickups: [
            { 
                target: 10, 
                name: 'Pickup Pro', 
                achieved: dashboard.milestones?.first10Pickups?.achieved || false,
                bonusPoints: 100,
                description: 'Complete your first 10 pickups'
            },
            { 
                target: 50, 
                name: 'Collection Master', 
                achieved: dashboard.milestones?.first50Pickups?.achieved || false,
                bonusPoints: 250,
                description: 'Master waste collection with 50 pickups'
            }
        ],
        streak: [
            { 
                target: 7, 
                name: 'Week Warrior', 
                achieved: dashboard.milestones?.weekStreak?.achieved || false,
                bonusPoints: 75,
                description: 'Maintain a 7-day recycling streak'
            },
            { 
                target: 30, 
                name: 'Consistency King', 
                achieved: dashboard.milestones?.monthStreak?.achieved || false,
                bonusPoints: 300,
                description: 'Achieve a legendary 30-day streak'
            }
        ],
        co2: [
            { 
                target: 100, 
                name: 'Carbon Saver', 
                achieved: dashboard.milestones?.carbonSaver?.achieved || false,
                bonusPoints: 200,
                description: 'Save 100kg of CO₂ through recycling'
            }
        ]
    };
    
    // Add progress calculations
    Object.keys(milestones).forEach(category => {
        milestones[category].forEach(milestone => {
            let currentValue = 0;
            
            switch (category) {
                case 'weight':
                    currentValue = dashboard.totalWasteRecycled || 0;
                    break;
                case 'pickups':
                    currentValue = dashboard.pickupsCompleted || 0;
                    break;
                case 'streak':
                    currentValue = dashboard.longestStreak || 0;
                    break;
                case 'co2':
                    currentValue = dashboard.co2Saved || 0;
                    break;
            }
            
            milestone.progress = Math.min((currentValue / milestone.target) * 100, 100);
            milestone.currentValue = currentValue;
            milestone.remaining = Math.max(milestone.target - currentValue, 0);
            milestone.isNextGoal = !milestone.achieved && milestone.remaining <= milestone.target * 0.2; // Within 20% of target
        });
    });
    
    return milestones;
};

export default {
    getMilestoneBonusPoints,
    getMilestoneType,
    getMilestoneValue,
    sendEnhancedMilestoneNotification,
    calculateTrendInsights,
    generateMilestoneProgress
};