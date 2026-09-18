import notificationService from '../services/notificationService.js';

describe('Real-time Notification Delivery Unit Tests', () => {
    beforeEach(() => {
        // Clear notification service queues
        notificationService.deliveryQueue = [];
        notificationService.priorityQueue = [];
        notificationService.batchQueue = [];
        notificationService.activeDeliveries.clear();
        notificationService.deliveryHistory = [];
        notificationService.deliveryStats = {
            totalSent: 0,
            totalFailed: 0,
            averageDeliveryTime: 0,
            lastDeliveryTime: null
        };
    });

    describe('Priority Queue Management', () => {
        test('should add urgent notifications to priority queue', () => {
            const mockNotification = {
                _id: 'test123',
                recipientId: 'user123',
                type: 'system_announcement',
                title: 'Urgent Test',
                message: 'This is urgent',
                priority: 'urgent',
                channels: ['push', 'in_app']
            };

            notificationService.addToQueue(mockNotification);

            expect(notificationService.priorityQueue.length).toBe(1);
            expect(notificationService.batchQueue.length).toBe(0);
            expect(notificationService.priorityQueue[0].notification).toBe(mockNotification);
            expect(notificationService.priorityQueue[0].priority).toBe(4); // urgent priority score
        });

        test('should add non-urgent notifications to batch queue', () => {
            const mockNotification = {
                _id: 'test123',
                recipientId: 'user123',
                type: 'system_announcement',
                title: 'Medium Test',
                message: 'This is medium priority',
                priority: 'medium',
                channels: ['push', 'in_app']
            };

            notificationService.addToQueue(mockNotification);

            expect(notificationService.priorityQueue.length).toBe(0);
            expect(notificationService.batchQueue.length).toBe(1);
            expect(notificationService.batchQueue[0].notification).toBe(mockNotification);
            expect(notificationService.batchQueue[0].priority).toBe(2); // medium priority score
        });
    });

    describe('Priority Score Calculation', () => {
        test('should return correct priority scores', () => {
            expect(notificationService.getPriorityScore('urgent')).toBe(4);
            expect(notificationService.getPriorityScore('high')).toBe(3);
            expect(notificationService.getPriorityScore('medium')).toBe(2);
            expect(notificationService.getPriorityScore('low')).toBe(1);
            expect(notificationService.getPriorityScore('unknown')).toBe(2); // default
        });
    });

    describe('Delivery Statistics', () => {
        test('should track delivery success correctly', () => {
            const deliveryItem = {
                notification: {
                    _id: 'test123',
                    recipientId: 'user123',
                    type: 'system_announcement',
                    title: 'Test',
                    message: 'Test message',
                    channels: ['push'],
                    priority: 'medium'
                },
                addedAt: new Date(),
                attempts: 0,
                priority: 2
            };

            const deliveryId = 'test_delivery_123';
            
            // Simulate active delivery
            notificationService.activeDeliveries.set(deliveryId, {
                ...deliveryItem,
                startTime: new Date(Date.now() - 100), // 100ms ago
                deliveryId
            });

            notificationService.recordDeliverySuccess(deliveryId, deliveryItem);

            const stats = notificationService.getDeliveryStats();
            expect(stats.totalSent).toBe(1);
            expect(stats.totalFailed).toBe(0);
            expect(stats.successRate).toBe(100);
            expect(stats.averageDeliveryTime).toBeGreaterThan(0);
        });

        test('should track delivery failure correctly', () => {
            const deliveryItem = {
                notification: {
                    _id: 'test123',
                    recipientId: 'user123',
                    type: 'system_announcement',
                    title: 'Test',
                    message: 'Test message',
                    channels: ['push'],
                    priority: 'medium'
                },
                addedAt: new Date(),
                attempts: 0,
                priority: 2
            };

            const deliveryId = 'test_delivery_123';
            const error = new Error('Test failure');
            
            // Simulate active delivery
            notificationService.activeDeliveries.set(deliveryId, {
                ...deliveryItem,
                startTime: new Date(Date.now() - 100), // 100ms ago
                deliveryId
            });

            notificationService.recordDeliveryFailure(deliveryId, deliveryItem, error);

            const stats = notificationService.getDeliveryStats();
            expect(stats.totalSent).toBe(0);
            expect(stats.totalFailed).toBe(1);
            expect(stats.successRate).toBe(0);
        });

        test('should calculate success rate correctly', () => {
            const deliveryItem = {
                notification: {
                    _id: 'test123',
                    recipientId: 'user123',
                    type: 'system_announcement',
                    title: 'Test',
                    message: 'Test message',
                    channels: ['push'],
                    priority: 'medium'
                },
                addedAt: new Date(),
                attempts: 0,
                priority: 2
            };

            // Simulate multiple deliveries
            for (let i = 0; i < 3; i++) {
                const deliveryId = `success_${i}`;
                notificationService.activeDeliveries.set(deliveryId, {
                    ...deliveryItem,
                    startTime: new Date(Date.now() - 100),
                    deliveryId
                });
                notificationService.recordDeliverySuccess(deliveryId, deliveryItem);
            }

            for (let i = 0; i < 1; i++) {
                const deliveryId = `failure_${i}`;
                notificationService.activeDeliveries.set(deliveryId, {
                    ...deliveryItem,
                    startTime: new Date(Date.now() - 100),
                    deliveryId
                });
                notificationService.recordDeliveryFailure(deliveryId, deliveryItem, new Error('Test'));
            }

            const stats = notificationService.getDeliveryStats();
            expect(stats.totalSent).toBe(3);
            expect(stats.totalFailed).toBe(1);
            expect(stats.successRate).toBe(75); // 3/4 = 75%
        });
    });

    describe('Delivery History', () => {
        test('should maintain delivery history', () => {
            const historyEntry = {
                notificationId: 'test123',
                recipientId: 'user123',
                type: 'system_announcement',
                status: 'success',
                deliveryTime: 100,
                timestamp: new Date(),
                channels: ['push'],
                priority: 'medium'
            };

            notificationService.addToDeliveryHistory(historyEntry);

            const history = notificationService.getDeliveryHistory();
            expect(history.length).toBe(1);
            expect(history[0]).toEqual(historyEntry);
        });

        test('should limit history size', () => {
            const originalMaxSize = notificationService.maxHistorySize;
            notificationService.maxHistorySize = 3; // Set small limit for testing

            // Add more entries than the limit
            for (let i = 0; i < 5; i++) {
                notificationService.addToDeliveryHistory({
                    notificationId: `test${i}`,
                    recipientId: 'user123',
                    type: 'system_announcement',
                    status: 'success',
                    deliveryTime: 100,
                    timestamp: new Date(),
                    channels: ['push'],
                    priority: 'medium'
                });
            }

            const history = notificationService.getDeliveryHistory();
            expect(history.length).toBe(3); // Should be limited to maxHistorySize
            expect(history[0].notificationId).toBe('test4'); // Most recent first
            expect(history[2].notificationId).toBe('test2'); // Oldest kept

            // Restore original max size
            notificationService.maxHistorySize = originalMaxSize;
        });
    });

    describe('Delivery Timing Optimization', () => {
        test('should deliver high priority notifications immediately', async () => {
            const notification = {
                recipientId: 'user123',
                priority: 'urgent'
            };

            const optimization = await notificationService.optimizeDeliveryTiming(notification);

            expect(optimization.deliverNow).toBe(true);
            expect(optimization.reason).toBe('high_priority');
        });

        test('should deliver during business hours', async () => {
            const notification = {
                recipientId: 'user123',
                priority: 'medium'
            };

            // Mock current time to be during business hours
            const originalDate = Date;
            const mockDate = new Date('2024-01-15T10:00:00Z'); // 10 AM
            global.Date = jest.fn(() => mockDate);
            global.Date.now = jest.fn(() => mockDate.getTime());

            const optimization = await notificationService.optimizeDeliveryTiming(notification);

            expect(optimization.deliverNow).toBe(true);
            expect(optimization.reason).toBe('business_hours');

            // Restore original Date
            global.Date = originalDate;
        });

        test('should schedule for later outside business hours', async () => {
            const notification = {
                recipientId: 'user123',
                priority: 'low'
            };

            // Mock current time to be outside business hours
            const originalDate = Date;
            const mockDate = new Date('2024-01-15T22:00:00Z'); // 10 PM
            global.Date = jest.fn(() => mockDate);
            global.Date.now = jest.fn(() => mockDate.getTime());

            const optimization = await notificationService.optimizeDeliveryTiming(notification);

            expect(optimization.deliverNow).toBe(false);
            expect(optimization.scheduleFor).toBeDefined();
            expect(optimization.reason).toBe('optimized_timing');

            // Restore original Date
            global.Date = originalDate;
        });
    });

    describe('Queue Statistics', () => {
        test('should provide accurate queue statistics', () => {
            // Add notifications to different queues
            notificationService.priorityQueue.push({ priority: 4 });
            notificationService.priorityQueue.push({ priority: 3 });
            notificationService.deliveryQueue.push({ priority: 2 });
            notificationService.batchQueue.push({ priority: 1 });
            notificationService.batchQueue.push({ priority: 1 });

            const stats = notificationService.getDeliveryStats();

            expect(stats.queueSizes.priority).toBe(2);
            expect(stats.queueSizes.regular).toBe(1);
            expect(stats.queueSizes.batch).toBe(2);
            expect(stats.activeDeliveries).toBe(0);
        });
    });
});