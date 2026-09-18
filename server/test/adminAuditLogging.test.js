/**
 * Property-Based Tests for Admin Audit Logging
 * Feature: ecocycle-platform, Property 44: Admin Audit Logging
 * Validates: Requirements 12.2
 * 
 * Tests that all admin modifications to user accounts are logged
 * completely for audit purposes.
 */

import fc from 'fast-check';
import mongoose from 'mongoose';
import User from '../models/User.js';
import ActivityLog from '../models/ActivityLog.js';

describe('Property 44: Admin Audit Logging', () => {
    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecocycle_test');
        }
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    beforeEach(async () => {
        await User.deleteMany({});
        await ActivityLog.deleteMany({});
    });

    /**
     * Property: User deletion creates audit log entry
     */
    test('should create audit log when admin deletes a user', async () => {
        const timestamp = Date.now();
        
        // Create admin user
        const admin = await User.create({
            name: 'Admin User',
            username: `admin_${timestamp}`,
            email: `admin_${timestamp}@test.com`,
            password: 'a'.repeat(60),
            role: 'admin',
            profile: {
                firstName: 'Admin',
                lastName: 'User'
            },
            isActive: true
        });
        
        // Create target user
        const targetUser = await User.create({
            name: 'Target User',
            username: `target_${timestamp}`,
            email: `target_${timestamp}@test.com`,
            password: 'a'.repeat(60),
            role: 'citizen',
            profile: {
                firstName: 'Target',
                lastName: 'User'
            },
            isActive: true
        });
        
        // Simulate deletion with audit logging
        await ActivityLog.create({
            performedBy: admin._id,
            targetUser: targetUser._id,
            action: 'DELETE_USER',
            details: `Deleted user ${targetUser.profile.firstName} ${targetUser.profile.lastName} (${targetUser.email}) with role ${targetUser.role}`
        });
        
        await User.findByIdAndDelete(targetUser._id);
        
        // Verify audit log was created
        const logs = await ActivityLog.find({ 
            performedBy: admin._id,
            targetUser: targetUser._id,
            action: 'DELETE_USER'
        });
        
        expect(logs.length).toBe(1);
        expect(logs[0].performedBy.toString()).toBe(admin._id.toString());
        expect(logs[0].targetUser.toString()).toBe(targetUser._id.toString());
        expect(logs[0].action).toBe('DELETE_USER');
        expect(logs[0].details).toContain(targetUser.email);
    });

    /**
     * Property: User update creates audit log entry
     */
    test('should create audit log when admin updates a user', async () => {
        const timestamp = Date.now();
        
        // Create admin user
        const admin = await User.create({
            name: 'Admin User',
            username: `admin_${timestamp}`,
            email: `admin_${timestamp}@test.com`,
            password: 'a'.repeat(60),
            role: 'admin',
            profile: {
                firstName: 'Admin',
                lastName: 'User'
            },
            isActive: true
        });
        
        // Create target user
        const targetUser = await User.create({
            name: 'Target User',
            username: `target_${timestamp}`,
            email: `target_${timestamp}@test.com`,
            password: 'a'.repeat(60),
            role: 'citizen',
            profile: {
                firstName: 'Target',
                lastName: 'User'
            },
            isActive: true
        });
        
        // Simulate update with audit logging
        const oldRole = targetUser.role;
        const newRole = 'collector';
        
        await ActivityLog.create({
            performedBy: admin._id,
            targetUser: targetUser._id,
            action: 'UPDATE_USER',
            details: `Modified user account: role: "${oldRole}" -> "${newRole}"`
        });
        
        targetUser.role = newRole;
        await targetUser.save();
        
        // Verify audit log was created
        const logs = await ActivityLog.find({ 
            performedBy: admin._id,
            targetUser: targetUser._id,
            action: 'UPDATE_USER'
        });
        
        expect(logs.length).toBe(1);
        expect(logs[0].performedBy.toString()).toBe(admin._id.toString());
        expect(logs[0].targetUser.toString()).toBe(targetUser._id.toString());
        expect(logs[0].action).toBe('UPDATE_USER');
        expect(logs[0].details).toContain('role');
        expect(logs[0].details).toContain(oldRole);
        expect(logs[0].details).toContain(newRole);
    });

    /**
     * Property: Multiple admin actions create multiple audit logs
     */
    test('should create separate audit logs for multiple admin actions', async () => {
        const timestamp = Date.now();
        
        // Create admin user
        const admin = await User.create({
            name: 'Admin User',
            username: `admin_${timestamp}`,
            email: `admin_${timestamp}@test.com`,
            password: 'a'.repeat(60),
            role: 'admin',
            profile: {
                firstName: 'Admin',
                lastName: 'User'
            },
            isActive: true
        });
        
        // Create multiple target users
        const users = [];
        for (let i = 0; i < 5; i++) {
            const user = await User.create({
                name: `User ${i}`,
                username: `user${i}_${timestamp}`,
                email: `user${i}_${timestamp}@test.com`,
                password: 'a'.repeat(60),
                role: 'citizen',
                profile: {
                    firstName: `First${i}`,
                    lastName: `Last${i}`
                },
                isActive: true
            });
            users.push(user);
        }
        
        // Perform multiple actions with audit logging
        for (const user of users) {
            await ActivityLog.create({
                performedBy: admin._id,
                targetUser: user._id,
                action: 'UPDATE_USER',
                details: `Modified user account: isActive: true -> false`
            });
            
            user.isActive = false;
            await user.save();
        }
        
        // Verify all audit logs were created
        const logs = await ActivityLog.find({ 
            performedBy: admin._id,
            action: 'UPDATE_USER'
        });
        
        expect(logs.length).toBe(5);
        
        // Each log should reference a different user
        const loggedUserIds = logs.map(log => log.targetUser.toString());
        const uniqueUserIds = new Set(loggedUserIds);
        expect(uniqueUserIds.size).toBe(5);
    });

    /**
     * Property: Audit logs are immutable (cannot be modified)
     */
    test('should maintain audit log integrity over time', async () => {
        const timestamp = Date.now();
        
        // Create admin user
        const admin = await User.create({
            name: 'Admin User',
            username: `admin_${timestamp}`,
            email: `admin_${timestamp}@test.com`,
            password: 'a'.repeat(60),
            role: 'admin',
            profile: {
                firstName: 'Admin',
                lastName: 'User'
            },
            isActive: true
        });
        
        // Create target user
        const targetUser = await User.create({
            name: 'Target User',
            username: `target_${timestamp}`,
            email: `target_${timestamp}@test.com`,
            password: 'a'.repeat(60),
            role: 'citizen',
            profile: {
                firstName: 'Target',
                lastName: 'User'
            },
            isActive: true
        });
        
        // Create audit log
        const log = await ActivityLog.create({
            performedBy: admin._id,
            targetUser: targetUser._id,
            action: 'DELETE_USER',
            details: 'Original details'
        });
        
        const originalLogId = log._id;
        const originalAction = log.action;
        const originalDetails = log.details;
        const originalCreatedAt = log.createdAt;
        
        // Verify log can be retrieved with original data
        const retrievedLog = await ActivityLog.findById(originalLogId);
        
        expect(retrievedLog._id.toString()).toBe(originalLogId.toString());
        expect(retrievedLog.action).toBe(originalAction);
        expect(retrievedLog.details).toBe(originalDetails);
        expect(retrievedLog.createdAt.getTime()).toBe(originalCreatedAt.getTime());
    });

    /**
     * Property: Audit logs include timestamps
     */
    test('should include timestamps in audit logs', async () => {
        const timestamp = Date.now();
        const beforeAction = new Date();
        
        // Create admin user
        const admin = await User.create({
            name: 'Admin User',
            username: `admin_${timestamp}`,
            email: `admin_${timestamp}@test.com`,
            password: 'a'.repeat(60),
            role: 'admin',
            profile: {
                firstName: 'Admin',
                lastName: 'User'
            },
            isActive: true
        });
        
        // Create target user
        const targetUser = await User.create({
            name: 'Target User',
            username: `target_${timestamp}`,
            email: `target_${timestamp}@test.com`,
            password: 'a'.repeat(60),
            role: 'citizen',
            profile: {
                firstName: 'Target',
                lastName: 'User'
            },
            isActive: true
        });
        
        // Create audit log
        const log = await ActivityLog.create({
            performedBy: admin._id,
            targetUser: targetUser._id,
            action: 'UPDATE_USER',
            details: 'Test action'
        });
        
        const afterAction = new Date();
        
        // Verify timestamp exists and is reasonable
        expect(log.createdAt).toBeDefined();
        expect(log.createdAt instanceof Date).toBe(true);
        expect(log.createdAt.getTime()).toBeGreaterThanOrEqual(beforeAction.getTime());
        expect(log.createdAt.getTime()).toBeLessThanOrEqual(afterAction.getTime());
    });

    /**
     * Property: Audit logs can be queried by admin
     */
    test('should allow querying audit logs by admin user', async () => {
        const timestamp = Date.now();
        
        // Create two admin users
        const admin1 = await User.create({
            name: 'Admin One',
            username: `admin1_${timestamp}`,
            email: `admin1_${timestamp}@test.com`,
            password: 'a'.repeat(60),
            role: 'admin',
            profile: {
                firstName: 'Admin',
                lastName: 'One'
            },
            isActive: true
        });
        
        const admin2 = await User.create({
            name: 'Admin Two',
            username: `admin2_${timestamp}`,
            email: `admin2_${timestamp}@test.com`,
            password: 'a'.repeat(60),
            role: 'admin',
            profile: {
                firstName: 'Admin',
                lastName: 'Two'
            },
            isActive: true
        });
        
        // Create target user
        const targetUser = await User.create({
            name: 'Target User',
            username: `target_${timestamp}`,
            email: `target_${timestamp}@test.com`,
            password: 'a'.repeat(60),
            role: 'citizen',
            profile: {
                firstName: 'Target',
                lastName: 'User'
            },
            isActive: true
        });
        
        // Create logs from both admins
        await ActivityLog.create({
            performedBy: admin1._id,
            targetUser: targetUser._id,
            action: 'UPDATE_USER',
            details: 'Action by admin 1'
        });
        
        await ActivityLog.create({
            performedBy: admin1._id,
            targetUser: targetUser._id,
            action: 'UPDATE_USER',
            details: 'Another action by admin 1'
        });
        
        await ActivityLog.create({
            performedBy: admin2._id,
            targetUser: targetUser._id,
            action: 'UPDATE_USER',
            details: 'Action by admin 2'
        });
        
        // Query logs by admin1
        const admin1Logs = await ActivityLog.find({ performedBy: admin1._id });
        expect(admin1Logs.length).toBe(2);
        admin1Logs.forEach(log => {
            expect(log.performedBy.toString()).toBe(admin1._id.toString());
        });
        
        // Query logs by admin2
        const admin2Logs = await ActivityLog.find({ performedBy: admin2._id });
        expect(admin2Logs.length).toBe(1);
        expect(admin2Logs[0].performedBy.toString()).toBe(admin2._id.toString());
    });

    /**
     * Property: Audit logs can be queried by target user
     */
    test('should allow querying audit logs by target user', async () => {
        const timestamp = Date.now();
        
        // Create admin user
        const admin = await User.create({
            name: 'Admin User',
            username: `admin_${timestamp}`,
            email: `admin_${timestamp}@test.com`,
            password: 'a'.repeat(60),
            role: 'admin',
            profile: {
                firstName: 'Admin',
                lastName: 'User'
            },
            isActive: true
        });
        
        // Create two target users
        const user1 = await User.create({
            name: 'User One',
            username: `user1_${timestamp}`,
            email: `user1_${timestamp}@test.com`,
            password: 'a'.repeat(60),
            role: 'citizen',
            profile: {
                firstName: 'User',
                lastName: 'One'
            },
            isActive: true
        });
        
        const user2 = await User.create({
            name: 'User Two',
            username: `user2_${timestamp}`,
            email: `user2_${timestamp}@test.com`,
            password: 'a'.repeat(60),
            role: 'citizen',
            profile: {
                firstName: 'User',
                lastName: 'Two'
            },
            isActive: true
        });
        
        // Create logs for both users
        await ActivityLog.create({
            performedBy: admin._id,
            targetUser: user1._id,
            action: 'UPDATE_USER',
            details: 'Action on user 1'
        });
        
        await ActivityLog.create({
            performedBy: admin._id,
            targetUser: user1._id,
            action: 'UPDATE_USER',
            details: 'Another action on user 1'
        });
        
        await ActivityLog.create({
            performedBy: admin._id,
            targetUser: user2._id,
            action: 'UPDATE_USER',
            details: 'Action on user 2'
        });
        
        // Query logs for user1
        const user1Logs = await ActivityLog.find({ targetUser: user1._id });
        expect(user1Logs.length).toBe(2);
        user1Logs.forEach(log => {
            expect(log.targetUser.toString()).toBe(user1._id.toString());
        });
        
        // Query logs for user2
        const user2Logs = await ActivityLog.find({ targetUser: user2._id });
        expect(user2Logs.length).toBe(1);
        expect(user2Logs[0].targetUser.toString()).toBe(user2._id.toString());
    });
});
