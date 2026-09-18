import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';

const useMilestoneNotifications = () => {
    const [notifications, setNotifications] = useState([]);
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        // Initialize socket connection
        const token = localStorage.getItem('token');
        if (token) {
            const newSocket = io(process.env.REACT_APP_SERVER_URL || 'http://localhost:5000', {
                auth: {
                    token: token
                }
            });

            setSocket(newSocket);

            // Listen for milestone achievements
            newSocket.on('milestone_reached', (milestoneData) => {
                console.log('Milestone reached:', milestoneData);
                showMilestoneNotification(milestoneData);
            });

            // Listen for achievement unlocked events
            newSocket.on('achievement_unlocked', (achievementData) => {
                console.log('Achievement unlocked:', achievementData);
                showAchievementNotification(achievementData);
            });

            // Listen for dashboard updates that might include new milestones
            newSocket.on('dashboard_updated', (dashboardData) => {
                // Check if there are any new achievements in the dashboard update
                if (dashboardData.newAchievements && dashboardData.newAchievements.length > 0) {
                    dashboardData.newAchievements.forEach(achievement => {
                        showAchievementNotification(achievement);
                    });
                }
            });

            return () => {
                newSocket.disconnect();
            };
        }
    }, []);

    const showMilestoneNotification = useCallback((milestoneData) => {
        const notification = {
            id: Date.now() + Math.random(),
            type: 'milestone',
            data: {
                ...milestoneData,
                bonusPoints: getMilestoneBonusPoints(milestoneData.name)
            },
            timestamp: new Date()
        };

        setNotifications(prev => [...prev, notification]);

        // Auto-remove after 6 seconds
        setTimeout(() => {
            removeNotification(notification.id);
        }, 6000);
    }, []);

    const showAchievementNotification = useCallback((achievementData) => {
        // Check if this is a milestone achievement
        const milestoneNames = [
            'First Steps', 'Getting Started', 'Eco Enthusiast', 'Recycling Champion', 
            'Eco Warrior', 'Pickup Pro', 'Collection Master', 'Week Warrior', 
            'Consistency King', 'Carbon Saver'
        ];

        if (milestoneNames.includes(achievementData.name)) {
            const notification = {
                id: Date.now() + Math.random(),
                type: 'milestone',
                data: {
                    ...achievementData,
                    bonusPoints: getMilestoneBonusPoints(achievementData.name),
                    type: getMilestoneType(achievementData.name),
                    value: getMilestoneValue(achievementData.name)
                },
                timestamp: new Date()
            };

            setNotifications(prev => [...prev, notification]);

            // Auto-remove after 6 seconds
            setTimeout(() => {
                removeNotification(notification.id);
            }, 6000);
        } else {
            // Regular achievement notification (could be implemented differently)
            console.log('Regular achievement unlocked:', achievementData);
        }
    }, []);

    const removeNotification = useCallback((notificationId) => {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
    }, []);

    const clearAllNotifications = useCallback(() => {
        setNotifications([]);
    }, []);

    // Helper function to get bonus points for milestones
    const getMilestoneBonusPoints = (achievementName) => {
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
    const getMilestoneType = (achievementName) => {
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
    const getMilestoneValue = (achievementName) => {
        const milestoneValues = {
            'First Steps': 1,
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

    // Simulate milestone achievement (for testing)
    const simulateMilestone = useCallback((milestoneType = 'weight', value = 10) => {
        const milestones = {
            weight: [
                { name: 'Getting Started', value: 10, icon: '📦', rarity: 'common' },
                { name: 'Eco Enthusiast', value: 50, icon: '♻️', rarity: 'rare' },
                { name: 'Recycling Champion', value: 100, icon: '🏆', rarity: 'epic' },
                { name: 'Eco Warrior', value: 500, icon: '⚔️', rarity: 'legendary' }
            ],
            pickups: [
                { name: 'Pickup Pro', value: 10, icon: '🚚', rarity: 'rare' },
                { name: 'Collection Master', value: 50, icon: '🎯', rarity: 'epic' }
            ],
            streak: [
                { name: 'Week Warrior', value: 7, icon: '🔥', rarity: 'rare' },
                { name: 'Consistency King', value: 30, icon: '👑', rarity: 'legendary' }
            ],
            co2: [
                { name: 'Carbon Saver', value: 100, icon: '🌍', rarity: 'epic' }
            ]
        };

        const milestone = milestones[milestoneType]?.find(m => m.value === value);
        if (milestone) {
            showMilestoneNotification({
                ...milestone,
                description: `You've achieved the ${milestone.name} milestone!`,
                type: milestoneType
            });
        }
    }, [showMilestoneNotification]);

    return {
        notifications,
        removeNotification,
        clearAllNotifications,
        simulateMilestone,
        socket
    };
};

export default useMilestoneNotifications;