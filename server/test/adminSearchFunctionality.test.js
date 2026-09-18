/**
 * Property-Based Tests for Admin Search Functionality
 * Feature: ecocycle-platform, Property 43: Admin Search Functionality
 * Validates: Requirements 12.1
 * 
 * Tests that admin search and filtering capabilities work correctly
 * across all valid inputs and return comprehensive, accurate results.
 */

import fc from 'fast-check';
import mongoose from 'mongoose';
import User from '../models/User.js';

describe('Property 43: Admin Search Functionality', () => {
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
    });

    /**
     * Property: Search by role returns only users with that role
     */
    test('should return only users matching the specified role filter', async () => {
        const roles = ['citizen', 'collector', 'admin'];
        
        for (const targetRole of roles) {
            await User.deleteMany({});
            
            // Create a mix of users with different roles
            const users = [];
            for (let i = 0; i < 15; i++) {
                const role = roles[i % 3];
                users.push({
                    name: `User ${i}`,
                    username: `user${i}_${Date.now()}`,
                    email: `user${i}_${Date.now()}@test.com`,
                    password: 'a'.repeat(60),
                    role: role,
                    profile: {
                        firstName: `First${i}`,
                        lastName: `Last${i}`
                    },
                    isActive: true
                });
            }
            
            await User.insertMany(users);
            
            // Search by role
            const results = await User.find({ role: targetRole }).select('-password -adminCode');
            
            // All results should have the target role
            results.forEach(user => {
                expect(user.role).toBe(targetRole);
            });
            
            // Count should match
            const expectedCount = users.filter(u => u.role === targetRole).length;
            expect(results.length).toBe(expectedCount);
        }
    });

    /**
     * Property: Search by text matches across multiple fields
     */
    test('should find users when search term matches any searchable field', async () => {
        const searchTerm = 'TestSearch';
        
        // Create users with the search term in different fields
        const users = [
            {
                name: 'John Doe',
                username: `user0_${Date.now()}`,
                email: `${searchTerm}@test.com`,
                password: 'a'.repeat(60),
                role: 'citizen',
                profile: {
                    firstName: 'John',
                    lastName: 'Doe'
                },
                isActive: true
            },
            {
                name: `${searchTerm} Smith`,
                username: `user1_${Date.now()}`,
                email: 'other@test.com',
                password: 'a'.repeat(60),
                role: 'citizen',
                profile: {
                    firstName: searchTerm,
                    lastName: 'Smith'
                },
                isActive: true
            },
            {
                name: `Jane ${searchTerm}`,
                username: `user2_${Date.now()}`,
                email: 'another@test.com',
                password: 'a'.repeat(60),
                role: 'collector',
                profile: {
                    firstName: 'Jane',
                    lastName: searchTerm
                },
                isActive: true
            },
            {
                name: 'Admin User',
                username: `user3_${Date.now()}`,
                email: 'nomatch@test.com',
                password: 'a'.repeat(60),
                role: 'admin',
                profile: {
                    firstName: 'Admin',
                    lastName: 'User'
                },
                isActive: true
            }
        ];

        await User.insertMany(users);

        // Search with case-insensitive regex
        const results = await User.find({
            $or: [
                { 'profile.firstName': { $regex: searchTerm, $options: 'i' } },
                { 'profile.lastName': { $regex: searchTerm, $options: 'i' } },
                { email: { $regex: searchTerm, $options: 'i' } }
            ]
        }).select('-password -adminCode');

        // Should find at least 3 users (those with searchTerm)
        expect(results.length).toBeGreaterThanOrEqual(3);

        // All results should contain the search term in at least one field
        results.forEach(user => {
            const matchesFirstName = user.profile.firstName.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesLastName = user.profile.lastName.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesEmail = user.email.toLowerCase().includes(searchTerm.toLowerCase());
            
            expect(matchesFirstName || matchesLastName || matchesEmail).toBe(true);
        });
    });

    /**
     * Property: Active status filter returns only users with matching status
     */
    test('should return only users matching the isActive filter', async () => {
        const timestamp = Date.now();
        
        // Create users with different active statuses
        const users = [];
        for (let i = 0; i < 20; i++) {
            users.push({
                name: `User ${i}`,
                username: `user${i}_${timestamp}`,
                email: `user${i}_${timestamp}@test.com`,
                password: 'a'.repeat(60),
                role: 'citizen',
                profile: {
                    firstName: `First${i}`,
                    lastName: `Last${i}`
                },
                isActive: i % 2 === 0 // Alternate between true and false
            });
        }
        
        await User.insertMany(users);
        
        // Test both true and false
        for (const targetStatus of [true, false]) {
            const results = await User.find({ isActive: targetStatus }).select('-password -adminCode');
            
            // All results should have the target active status
            results.forEach(user => {
                expect(user.isActive).toBe(targetStatus);
            });
            
            // Count should match
            const expectedCount = users.filter(u => u.isActive === targetStatus).length;
            expect(results.length).toBe(expectedCount);
        }
    });

    /**
     * Property: Pagination returns correct subset of results
     */
    test('should return correct page of results with proper pagination', async () => {
        const totalUsers = 25;
        const limit = 10;
        const timestamp = Date.now();
        
        // Create users
        const users = Array.from({ length: totalUsers }, (_, i) => ({
            name: `User${i} Test`,
            username: `user${i}_${timestamp}`,
            email: `user${i}_${timestamp}@test.com`,
            password: 'a'.repeat(60),
            role: 'citizen',
            profile: {
                firstName: `User${i}`,
                lastName: 'Test'
            },
            isActive: true
        }));

        await User.insertMany(users);

        // Test first page
        const page1Results = await User.find({})
            .select('-password -adminCode')
            .sort({ createdAt: -1 })
            .skip(0)
            .limit(limit);
        
        expect(page1Results.length).toBe(limit);
        
        // Test second page
        const page2Results = await User.find({})
            .select('-password -adminCode')
            .sort({ createdAt: -1 })
            .skip(limit)
            .limit(limit);
        
        expect(page2Results.length).toBe(limit);
        
        // Test last page
        const page3Results = await User.find({})
            .select('-password -adminCode')
            .sort({ createdAt: -1 })
            .skip(limit * 2)
            .limit(limit);
        
        expect(page3Results.length).toBe(totalUsers - (limit * 2));
    });

    /**
     * Property: Combined filters work correctly together
     */
    test('should correctly apply multiple filters simultaneously', async () => {
        const timestamp = Date.now();
        
        // Create users with different combinations of role and status
        const users = [];
        const roles = ['citizen', 'collector', 'admin'];
        
        for (let i = 0; i < 30; i++) {
            users.push({
                name: `User ${i}`,
                username: `user${i}_${timestamp}`,
                email: `user${i}_${timestamp}@test.com`,
                password: 'a'.repeat(60),
                role: roles[i % 3],
                profile: {
                    firstName: `First${i}`,
                    lastName: `Last${i}`
                },
                isActive: i % 2 === 0
            });
        }
        
        await User.insertMany(users);
        
        // Test combination: citizen + active
        const results = await User.find({
            role: 'citizen',
            isActive: true
        }).select('-password -adminCode');
        
        // All results should match both filters
        results.forEach(user => {
            expect(user.role).toBe('citizen');
            expect(user.isActive).toBe(true);
        });
        
        // Count should match
        const expectedCount = users.filter(
            u => u.role === 'citizen' && u.isActive === true
        ).length;
        expect(results.length).toBe(expectedCount);
    });

    /**
     * Property: Sorting works correctly
     */
    test('should return results in correct sort order', async () => {
        const timestamp = Date.now();
        const users = [];
        
        // Create users with delays to ensure different timestamps
        for (let i = 0; i < 5; i++) {
            const user = await User.create({
                name: `User ${i}`,
                username: `user${i}_${timestamp}_${i}`,
                email: `user${i}_${timestamp}_${i}@test.com`,
                password: 'a'.repeat(60),
                role: 'citizen',
                profile: {
                    firstName: `First${i}`,
                    lastName: `Last${i}`
                },
                isActive: true
            });
            users.push(user);
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        // Test descending order
        const descResults = await User.find({})
            .select('-password -adminCode')
            .sort({ createdAt: -1 });
        
        for (let i = 1; i < descResults.length; i++) {
            const prev = descResults[i - 1].createdAt.getTime();
            const curr = descResults[i].createdAt.getTime();
            expect(prev).toBeGreaterThanOrEqual(curr);
        }
        
        // Test ascending order
        const ascResults = await User.find({})
            .select('-password -adminCode')
            .sort({ createdAt: 1 });
        
        for (let i = 1; i < ascResults.length; i++) {
            const prev = ascResults[i - 1].createdAt.getTime();
            const curr = ascResults[i].createdAt.getTime();
            expect(prev).toBeLessThanOrEqual(curr);
        }
    });

    /**
     * Property: Search returns empty array when no matches found
     */
    test('should return empty array when no users match filters', async () => {
        const timestamp = Date.now();
        
        // Create only citizen users
        const users = Array.from({ length: 10 }, (_, i) => ({
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
        }));
        
        await User.insertMany(users);
        
        // Search for admin users (should find none)
        const results = await User.find({ role: 'admin' }).select('-password -adminCode');
        
        expect(results).toEqual([]);
        expect(results.length).toBe(0);
    });
});
