import fc from 'fast-check';
import request from 'supertest';
import mongoose from 'mongoose';
import express from 'express';
import dotenv from 'dotenv';
import User from '../models/User.js';
import EcoPointsWallet from '../models/EcoPointsWallet.js';
import WasteTypeConfig from '../models/WasteTypeConfig.js';
import generateToken from '../utils/generateToken.js';
import ecoPointsRoutes from '../routes/ecoPointsRoutes.js';
import { protect } from '../middleware/authMiddleware.js';
import { jest } from '@jest/globals';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Create a minimal test app to avoid port conflicts
const createTestApp = () => {
    const app = express();
    app.use(express.json());
    app.use('/api/ecopoints', ecoPointsRoutes);
    return app;
};

/**
 * Property 27: Real-time Wallet APIs
 * **Validates: Requirements 7.5**
 * 
 * For any wallet API request, current balance and transaction data should be returned accurately
 */

describe('Property 27: Real-time Wallet APIs', () => {
    let testUser;
    let authToken;
    let testWallet;
    let testApp;

    beforeAll(async () => {
        // Create test app
        testApp = createTestApp();

        // Connect to test database
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecocycle_test');
        }

        // Create test user
        testUser = new User({
            name: 'Test User',
            email: 'walletapi@test.com',
            username: 'walletapiuser',
            password: 'hashedpassword123',
            role: 'citizen'
        });
        await testUser.save();

        // Generate auth token
        authToken = generateToken(testUser._id);

        // Initialize waste type configs for testing
        await WasteTypeConfig.deleteMany({});
        await WasteTypeConfig.create([
            { 
                type: 'plastic', 
                pointsPerKg: 10, 
                co2SavedPerKg: 2.5,
                description: 'Plastic bottles and containers'
            },
            { 
                type: 'paper', 
                pointsPerKg: 5, 
                co2SavedPerKg: 1.2,
                description: 'Paper and cardboard materials'
            },
            { 
                type: 'glass', 
                pointsPerKg: 8, 
                co2SavedPerKg: 0.8,
                description: 'Glass bottles and jars'
            }
        ]);
    });

    beforeEach(async () => {
        // Clean up wallet data before each test
        await EcoPointsWallet.deleteMany({ citizenId: testUser._id });
        
        // Create fresh test wallet
        testWallet = await EcoPointsWallet.getOrCreateWallet(testUser._id);
    });

    afterAll(async () => {
        // Clean up test data
        await User.deleteMany({ email: /test\.com$/ });
        await EcoPointsWallet.deleteMany({});
        await WasteTypeConfig.deleteMany({});
        
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
    });

    /**
     * Property: Wallet balance API returns accurate current balance
     */
    test('should return accurate wallet balance for any wallet state', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(fc.record({
                type: fc.constantFrom('earned', 'spent', 'bonus'),
                amount: fc.integer({ min: 1, max: 100 }),
                description: fc.string({ minLength: 5, maxLength: 50 })
            }), { minLength: 0, maxLength: 10 }),
            async (transactions) => {
                // Reset wallet
                await EcoPointsWallet.deleteMany({ citizenId: testUser._id });
                const wallet = await EcoPointsWallet.getOrCreateWallet(testUser._id);
                
                let expectedBalance = 0;
                let expectedTotalEarned = 0;
                let expectedTotalSpent = 0;

                // Apply transactions to calculate expected values
                for (const transaction of transactions) {
                    if (transaction.type === 'earned' || transaction.type === 'bonus') {
                        expectedBalance += transaction.amount;
                        expectedTotalEarned += transaction.amount;
                        await wallet.addPoints(transaction.amount, transaction.description);
                    } else if (transaction.type === 'spent' && expectedBalance >= transaction.amount) {
                        expectedBalance -= transaction.amount;
                        expectedTotalSpent += transaction.amount;
                        await wallet.spendPoints(transaction.amount, transaction.description);
                    }
                }

                // Test wallet API endpoint
                const response = await request(testApp)
                    .get('/api/ecopoints/wallet')
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);

                // Verify response structure and accuracy
                expect(response.body.success).toBe(true);
                expect(response.body.data).toHaveProperty('balance');
                expect(response.body.data).toHaveProperty('totalEarned');
                expect(response.body.data).toHaveProperty('totalSpent');
                expect(response.body.data).toHaveProperty('recentTransactions');
                expect(response.body.data).toHaveProperty('updatedAt');

                // Verify balance accuracy
                expect(response.body.data.balance).toBe(expectedBalance);
                expect(response.body.data.totalEarned).toBe(expectedTotalEarned);
                expect(response.body.data.totalSpent).toBe(expectedTotalSpent);

                // Verify recent transactions are returned
                expect(Array.isArray(response.body.data.recentTransactions)).toBe(true);
                expect(response.body.data.recentTransactions.length).toBeLessThanOrEqual(20);
            }
        ), { numRuns: 5 });
    });

    /**
     * Property: Transaction history API returns complete and accurate transaction data
     */
    test('should return complete transaction history with accurate pagination', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(fc.record({
                type: fc.constantFrom('earned', 'bonus'),
                amount: fc.integer({ min: 1, max: 50 }),
                description: fc.string({ minLength: 5, maxLength: 30 })
            }), { minLength: 5, maxLength: 25 }),
            fc.integer({ min: 1, max: 10 }), // page size
            async (transactions, pageSize) => {
                // Reset wallet and add transactions
                await EcoPointsWallet.deleteMany({ citizenId: testUser._id });
                const wallet = await EcoPointsWallet.getOrCreateWallet(testUser._id);
                
                for (const transaction of transactions) {
                    await wallet.addPoints(transaction.amount, transaction.description);
                }

                // Test transaction history API
                const response = await request(testApp)
                    .get(`/api/ecopoints/transactions?limit=${pageSize}&page=1`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);

                // Verify response structure
                expect(response.body.success).toBe(true);
                expect(response.body.data).toHaveProperty('transactions');
                expect(response.body.data).toHaveProperty('pagination');

                const { transactions: returnedTransactions, pagination } = response.body.data;

                // Verify pagination accuracy
                expect(pagination.currentPage).toBe(1);
                expect(pagination.totalTransactions).toBe(transactions.length);
                expect(pagination.totalPages).toBe(Math.ceil(transactions.length / pageSize));
                expect(returnedTransactions.length).toBeLessThanOrEqual(pageSize);

                // Verify transactions are sorted by date (newest first)
                for (let i = 1; i < returnedTransactions.length; i++) {
                    const prevDate = new Date(returnedTransactions[i - 1].createdAt);
                    const currDate = new Date(returnedTransactions[i].createdAt);
                    expect(prevDate.getTime()).toBeGreaterThanOrEqual(currDate.getTime());
                }

                // Verify transaction data completeness
                returnedTransactions.forEach(transaction => {
                    expect(transaction).toHaveProperty('type');
                    expect(transaction).toHaveProperty('amount');
                    expect(transaction).toHaveProperty('description');
                    expect(transaction).toHaveProperty('createdAt');
                    expect(['earned', 'spent', 'bonus', 'penalty']).toContain(transaction.type);
                    expect(transaction.amount).toBeGreaterThan(0);
                });
            }
        ), { numRuns: 5 });
    });

    /**
     * Property: Wallet statistics API returns accurate aggregated data
     */
    test('should return accurate wallet statistics for any transaction history', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(fc.record({
                type: fc.constantFrom('earned', 'spent', 'bonus'),
                amount: fc.integer({ min: 1, max: 100 }),
                description: fc.string({ minLength: 5, maxLength: 40 })
            }), { minLength: 1, maxLength: 20 }),
            async (transactions) => {
                // Reset wallet
                await EcoPointsWallet.deleteMany({ citizenId: testUser._id });
                const wallet = await EcoPointsWallet.getOrCreateWallet(testUser._id);
                
                let expectedBalance = 0;
                let expectedTotalEarned = 0;
                let expectedTotalSpent = 0;
                let earnedTransactionCount = 0;

                // Apply transactions and calculate expected statistics
                for (const transaction of transactions) {
                    if (transaction.type === 'earned' || transaction.type === 'bonus') {
                        expectedBalance += transaction.amount;
                        expectedTotalEarned += transaction.amount;
                        earnedTransactionCount++;
                        await wallet.addPoints(transaction.amount, transaction.description);
                    } else if (transaction.type === 'spent' && expectedBalance >= transaction.amount) {
                        expectedBalance -= transaction.amount;
                        expectedTotalSpent += transaction.amount;
                        await wallet.spendPoints(transaction.amount, transaction.description);
                    }
                }

                const expectedAverageEarning = earnedTransactionCount > 0 
                    ? expectedTotalEarned / earnedTransactionCount 
                    : 0;

                // Test wallet statistics API
                const response = await request(testApp)
                    .get('/api/ecopoints/stats')
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);

                // Verify response structure and accuracy
                expect(response.body.success).toBe(true);
                expect(response.body.data).toHaveProperty('balance');
                expect(response.body.data).toHaveProperty('totalEarned');
                expect(response.body.data).toHaveProperty('totalSpent');
                expect(response.body.data).toHaveProperty('transactionCount');
                expect(response.body.data).toHaveProperty('averageEarning');
                expect(response.body.data).toHaveProperty('monthlyStats');

                // Verify statistical accuracy
                expect(response.body.data.balance).toBe(expectedBalance);
                expect(response.body.data.totalEarned).toBe(expectedTotalEarned);
                expect(response.body.data.totalSpent).toBe(expectedTotalSpent);
                expect(Math.abs(response.body.data.averageEarning - expectedAverageEarning)).toBeLessThan(0.01);

                // Verify monthly stats structure
                expect(Array.isArray(response.body.data.monthlyStats)).toBe(true);
                response.body.data.monthlyStats.forEach(monthStat => {
                    expect(monthStat).toHaveProperty('month');
                    expect(monthStat).toHaveProperty('earned');
                    expect(monthStat).toHaveProperty('spent');
                    expect(monthStat).toHaveProperty('count');
                    expect(typeof monthStat.earned).toBe('number');
                    expect(typeof monthStat.spent).toBe('number');
                    expect(typeof monthStat.count).toBe('number');
                });
            }
        ), { numRuns: 5 });
    });

    /**
     * Property: API responses maintain data consistency across concurrent requests
     */
    test('should maintain data consistency across concurrent wallet API requests', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(fc.record({
                amount: fc.integer({ min: 10, max: 50 }),
                description: fc.string({ minLength: 5, maxLength: 30 })
            }), { minLength: 3, maxLength: 8 }),
            async (transactions) => {
                // Reset wallet
                await EcoPointsWallet.deleteMany({ citizenId: testUser._id });
                const wallet = await EcoPointsWallet.getOrCreateWallet(testUser._id);
                
                // Add initial transactions
                for (const transaction of transactions) {
                    await wallet.addPoints(transaction.amount, transaction.description);
                }

                // Make concurrent API requests
                const promises = [
                    request(testApp).get('/api/ecopoints/wallet').set('Authorization', `Bearer ${authToken}`),
                    request(testApp).get('/api/ecopoints/transactions').set('Authorization', `Bearer ${authToken}`),
                    request(testApp).get('/api/ecopoints/stats').set('Authorization', `Bearer ${authToken}`)
                ];

                const responses = await Promise.all(promises);

                // Verify all requests succeeded
                responses.forEach(response => {
                    expect(response.status).toBe(200);
                    expect(response.body.success).toBe(true);
                });

                const [walletResponse, transactionsResponse, statsResponse] = responses;

                // Verify data consistency across responses
                expect(walletResponse.body.data.balance).toBe(statsResponse.body.data.balance);
                expect(walletResponse.body.data.totalEarned).toBe(statsResponse.body.data.totalEarned);
                expect(walletResponse.body.data.totalSpent).toBe(statsResponse.body.data.totalSpent);

                // Verify transaction count consistency
                const totalTransactions = transactionsResponse.body.data.pagination.totalTransactions;
                expect(totalTransactions).toBe(statsResponse.body.data.transactionCount);
                expect(totalTransactions).toBe(transactions.length);
            }
        ), { numRuns: 5 });
    });

    /**
     * Property: API handles edge cases gracefully (empty wallet, large numbers)
     */
    test('should handle edge cases gracefully', async () => {
        // Test empty wallet
        await EcoPointsWallet.deleteMany({ citizenId: testUser._id });
        
        const emptyWalletResponse = await request(testApp)
            .get('/api/ecopoints/wallet')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

        expect(emptyWalletResponse.body.data.balance).toBe(0);
        expect(emptyWalletResponse.body.data.totalEarned).toBe(0);
        expect(emptyWalletResponse.body.data.totalSpent).toBe(0);
        expect(emptyWalletResponse.body.data.recentTransactions).toHaveLength(0);

        // Test stats for empty wallet
        const emptyStatsResponse = await request(testApp)
            .get('/api/ecopoints/stats')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

        expect(emptyStatsResponse.body.data.balance).toBe(0);
        expect(emptyStatsResponse.body.data.averageEarning).toBe(0);
        expect(emptyStatsResponse.body.data.monthlyStats).toHaveLength(0);

        // Test large transaction amounts
        const wallet = await EcoPointsWallet.getOrCreateWallet(testUser._id);
        const largeAmount = 999999;
        await wallet.addPoints(largeAmount, 'Large amount test');

        const largeAmountResponse = await request(testApp)
            .get('/api/ecopoints/wallet')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

        expect(largeAmountResponse.body.data.balance).toBe(largeAmount);
        expect(largeAmountResponse.body.data.totalEarned).toBe(largeAmount);
    });

    /**
     * Property: API returns data in real-time (reflects immediate changes)
     */
    test('should reflect immediate changes in wallet data', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(fc.record({
                amount: fc.integer({ min: 5, max: 100 }),
                description: fc.string({ minLength: 5, maxLength: 30 })
            }), { minLength: 1, maxLength: 5 }),
            async (transactions) => {
                // Reset wallet
                await EcoPointsWallet.deleteMany({ citizenId: testUser._id });
                const wallet = await EcoPointsWallet.getOrCreateWallet(testUser._id);

                let expectedBalance = 0;

                for (const transaction of transactions) {
                    // Add points to wallet
                    await wallet.addPoints(transaction.amount, transaction.description);
                    expectedBalance += transaction.amount;

                    // Immediately check API response
                    const response = await request(testApp)
                        .get('/api/ecopoints/wallet')
                        .set('Authorization', `Bearer ${authToken}`)
                        .expect(200);

                    // Verify immediate reflection of changes
                    expect(response.body.data.balance).toBe(expectedBalance);
                    expect(response.body.data.recentTransactions.length).toBeGreaterThan(0);
                    
                    // Verify the most recent transaction matches what we just added
                    const mostRecentTransaction = response.body.data.recentTransactions[0];
                    expect(mostRecentTransaction.amount).toBe(transaction.amount);
                    expect(mostRecentTransaction.description).toBe(transaction.description);
                    expect(mostRecentTransaction.type).toBe('earned');
                }
            }
        ), { numRuns: 5 });
    });
});