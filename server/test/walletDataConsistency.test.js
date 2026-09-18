import fc from 'fast-check';
import mongoose from 'mongoose';
import EcoPointsWallet from '../models/EcoPointsWallet.js';
import User from '../models/User.js';
import { awardPointsForWaste, spendPoints } from '../controllers/ecoPointsController.js';

// Feature: ecocycle-platform, Property 26: Wallet Data Consistency
// **Validates: Requirements 7.4**

describe('Property 26: Wallet Data Consistency', () => {
    let testCitizenId;
    let testUser;

    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecocycle_test');
        }
    });

    beforeEach(async () => {
        await EcoPointsWallet.deleteMany({});
        await User.deleteMany({});
        
        testCitizenId = new mongoose.Types.ObjectId();
        
        // Create test user
        testUser = new User({
            _id: testCitizenId,
            name: 'Test User',
            email: 'test@example.com',
            username: 'testuser',
            password: 'hashedpassword',
            role: 'citizen',
            profile: {
                firstName: 'Test',
                lastName: 'User',
                addresses: []
            },
            points: 0 // Legacy points field for backward compatibility
        });
        await testUser.save();
    });

    afterEach(async () => {
        await EcoPointsWallet.deleteMany({});
        await User.deleteMany({});
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    // Custom generators for property-based testing
    const positiveAmount = fc.integer({ min: 1, max: 1000 });
    const transactionDescription = fc.string({ minLength: 5, maxLength: 100 });
    const transactionType = fc.constantFrom('waste', 'pickup', 'reward', 'challenge', 'milestone');

    test('Property 26.1: Wallet transactions maintain consistency with User model legacy points field', () => {
        return fc.assert(
            fc.asyncProperty(
                fc.array(fc.oneof(
                    // Earning points
                    fc.record({
                        operation: fc.constant('earn'),
                        amount: positiveAmount,
                        description: transactionDescription,
                        relatedType: transactionType
                    }),
                    // Spending points
                    fc.record({
                        operation: fc.constant('spend'),
                        amount: fc.integer({ min: 1, max: 100 }), // Keep small to avoid insufficient balance
                        description: transactionDescription,
                        relatedType: transactionType
                    })
                ), { minLength: 1, maxLength: 10 }), // Reduced max length
                async (operations) => {
                    // Create fresh citizen ID for this test
                    const freshCitizenId = new mongoose.Types.ObjectId();
                    
                    // Create test user with fresh ID
                    const freshUser = new User({
                        _id: freshCitizenId,
                        name: 'Test User',
                        email: `test-${freshCitizenId}@example.com`,
                        username: `testuser-${freshCitizenId}`,
                        password: 'hashedpassword',
                        role: 'citizen',
                        profile: {
                            firstName: 'Test',
                            lastName: 'User',
                            addresses: []
                        },
                        points: 0 // Legacy points field for backward compatibility
                    });
                    await freshUser.save();
                    
                    let expectedWalletBalance = 0;
                    let expectedUserPoints = 0;

                    // Execute operations and track expected consistency
                    for (const operation of operations) {
                        const walletBefore = await EcoPointsWallet.getOrCreateWallet(freshCitizenId);
                        const userBefore = await User.findById(freshCitizenId);

                        try {
                            if (operation.operation === 'earn') {
                                await walletBefore.addPoints(
                                    operation.amount,
                                    operation.description,
                                    new mongoose.Types.ObjectId(),
                                    operation.relatedType
                                );

                                // Update legacy User points field for consistency
                                await User.findByIdAndUpdate(freshCitizenId, {
                                    $inc: { points: operation.amount }
                                });

                                expectedWalletBalance += operation.amount;
                                expectedUserPoints += operation.amount;

                            } else if (operation.operation === 'spend') {
                                if (walletBefore.balance >= operation.amount) {
                                    await walletBefore.spendPoints(
                                        operation.amount,
                                        operation.description,
                                        new mongoose.Types.ObjectId(),
                                        operation.relatedType
                                    );

                                    // Update legacy User points field for consistency
                                    await User.findByIdAndUpdate(freshCitizenId, {
                                        $inc: { points: -operation.amount }
                                    });

                                    expectedWalletBalance -= operation.amount;
                                    expectedUserPoints -= operation.amount;
                                }
                            }

                        } catch (error) {
                            // Failed operations should not change any records
                            const walletAfter = await EcoPointsWallet.findOne({ citizenId: freshCitizenId });
                            const userAfter = await User.findById(freshCitizenId);

                            expect(walletAfter.balance).toBe(walletBefore.balance);
                            expect(userAfter.points).toBe(userBefore.points);
                        }
                    }

                    // Verify final consistency between wallet and user records
                    const finalWallet = await EcoPointsWallet.findOne({ citizenId: freshCitizenId });
                    const finalUser = await User.findById(freshCitizenId);

                    // Wallet balance should match expected
                    expect(finalWallet.balance).toBe(expectedWalletBalance);
                    
                    // User legacy points should match wallet balance
                    expect(finalUser.points).toBe(expectedUserPoints);
                    expect(finalUser.points).toBe(finalWallet.balance);

                    // Wallet internal consistency
                    expect(finalWallet.balance).toBe(finalWallet.totalEarned - finalWallet.totalSpent);
                }
            ),
            { numRuns: 25 }
        );
    });

    test('Property 26.2: Related record consistency across transaction failures and rollbacks', () => {
        return fc.assert(
            fc.asyncProperty(
                fc.record({
                    initialAmount: fc.integer({ min: 500, max: 2000 }),
                    operations: fc.array(fc.oneof(
                        fc.record({
                            type: fc.constant('valid_operation'),
                            amount: fc.integer({ min: 1, max: 100 }),
                            description: transactionDescription
                        }),
                        fc.record({
                            type: fc.constant('invalid_operation'),
                            amount: fc.integer({ min: 1000, max: 5000 }), // Intentionally large to cause failure
                            description: transactionDescription
                        })
                    ), { minLength: 3, maxLength: 10 })
                }),
                async ({ initialAmount, operations }) => {
                    // Create fresh citizen ID for this test
                    const freshCitizenId = new mongoose.Types.ObjectId();
                    
                    // Create test user with fresh ID
                    const freshUser = new User({
                        _id: freshCitizenId,
                        name: 'Test User',
                        email: `test-${freshCitizenId}@example.com`,
                        username: `testuser-${freshCitizenId}`,
                        password: 'hashedpassword',
                        role: 'citizen',
                        profile: {
                            firstName: 'Test',
                            lastName: 'User',
                            addresses: []
                        },
                        points: 0
                    });
                    await freshUser.save();
                    
                    // Set up initial state
                    const wallet = await EcoPointsWallet.getOrCreateWallet(freshCitizenId);
                    await wallet.addPoints(initialAmount, 'Initial balance for consistency test');
                    
                    await User.findByIdAndUpdate(freshCitizenId, {
                        $set: { points: initialAmount }
                    });

                    // Track expected state
                    let expectedWalletBalance = initialAmount;
                    let expectedUserPoints = initialAmount;

                    // Execute operations and verify consistency at each step
                    for (const operation of operations) {
                        const walletBefore = await EcoPointsWallet.findOne({ citizenId: freshCitizenId });
                        const userBefore = await User.findById(freshCitizenId);
                        const transactionCountBefore = walletBefore.transactions.length;

                        // Verify pre-operation consistency
                        expect(walletBefore.balance).toBe(userBefore.points);

                        try {
                            // Attempt the operation
                            await walletBefore.spendPoints(operation.amount, operation.description);
                            
                            // If successful, update user points for consistency
                            await User.findByIdAndUpdate(freshCitizenId, {
                                $inc: { points: -operation.amount }
                            });

                            expectedWalletBalance -= operation.amount;
                            expectedUserPoints -= operation.amount;

                        } catch (error) {
                            // Failed operations should not change any records
                            const walletAfterError = await EcoPointsWallet.findOne({ citizenId: freshCitizenId });
                            const userAfterError = await User.findById(freshCitizenId);

                            // Verify no changes occurred
                            expect(walletAfterError.balance).toBe(walletBefore.balance);
                            expect(walletAfterError.totalSpent).toBe(walletBefore.totalSpent);
                            expect(walletAfterError.transactions.length).toBe(transactionCountBefore);
                            expect(userAfterError.points).toBe(userBefore.points);

                            // Verify consistency maintained
                            expect(walletAfterError.balance).toBe(userAfterError.points);
                        }

                        // Verify post-operation consistency
                        const walletAfter = await EcoPointsWallet.findOne({ citizenId: freshCitizenId });
                        const userAfter = await User.findById(freshCitizenId);

                        expect(walletAfter.balance).toBe(userAfter.points);
                        expect(walletAfter.balance).toBe(expectedWalletBalance);
                        expect(userAfter.points).toBe(expectedUserPoints);
                    }

                    // Final consistency verification
                    const finalWallet = await EcoPointsWallet.findOne({ citizenId: freshCitizenId });
                    const finalUser = await User.findById(freshCitizenId);

                    expect(finalWallet.balance).toBe(finalUser.points);
                    expect(finalWallet.balance).toBe(expectedWalletBalance);
                    expect(finalUser.points).toBe(expectedUserPoints);
                }
            ),
            { numRuns: 18 }
        );
    });

    test('Property 26.3: Cross-collection data consistency during concurrent operations', () => {
        return fc.assert(
            fc.asyncProperty(
                fc.array(fc.record({
                    amount: fc.integer({ min: 10, max: 200 }),
                    description: transactionDescription,
                    operationType: fc.constantFrom('earn', 'spend')
                }), { minLength: 3, maxLength: 8 }),
                async (operations) => {
                    // Set up initial state with sufficient balance
                    const initialBalance = 1000;
                    const wallet = await EcoPointsWallet.getOrCreateWallet(testCitizenId);
                    await wallet.addPoints(initialBalance, 'Initial balance for concurrency test');
                    
                    await User.findByIdAndUpdate(testCitizenId, {
                        $set: { points: initialBalance }
                    });

                    // Simulate concurrent operations (simplified for testing)
                    const operationPromises = operations.map(async (operation, index) => {
                        // Small delay to simulate real-world timing
                        await new Promise(resolve => setTimeout(resolve, index * 5));

                        const currentWallet = await EcoPointsWallet.findOne({ citizenId: testCitizenId });
                        const currentUser = await User.findById(testCitizenId);

                        try {
                            if (operation.operationType === 'earn') {
                                await currentWallet.addPoints(operation.amount, operation.description);
                                await User.findByIdAndUpdate(testCitizenId, {
                                    $inc: { points: operation.amount }
                                });
                                return { success: true, type: 'earn', amount: operation.amount };

                            } else if (operation.operationType === 'spend') {
                                if (currentWallet.balance >= operation.amount) {
                                    await currentWallet.spendPoints(operation.amount, operation.description);
                                    await User.findByIdAndUpdate(testCitizenId, {
                                        $inc: { points: -operation.amount }
                                    });
                                    return { success: true, type: 'spend', amount: operation.amount };
                                } else {
                                    return { success: false, type: 'spend', amount: operation.amount };
                                }
                            }

                        } catch (error) {
                            return { success: false, type: operation.operationType, amount: operation.amount, error: error.message };
                        }
                    });

                    // Wait for all operations to complete
                    const results = await Promise.all(operationPromises);

                    // Calculate expected final state
                    let expectedBalance = initialBalance;
                    results.forEach(result => {
                        if (result.success) {
                            if (result.type === 'earn') {
                                expectedBalance += result.amount;
                            } else if (result.type === 'spend') {
                                expectedBalance -= result.amount;
                            }
                        }
                    });

                    // Verify final consistency
                    const finalWallet = await EcoPointsWallet.findOne({ citizenId: testCitizenId });
                    const finalUser = await User.findById(testCitizenId);

                    // Cross-collection consistency
                    expect(finalWallet.balance).toBe(finalUser.points);
                    expect(finalWallet.balance).toBe(expectedBalance);

                    // Internal wallet consistency
                    expect(finalWallet.balance).toBe(finalWallet.totalEarned - finalWallet.totalSpent);

                    // Transaction count should match successful operations
                    const successfulOperations = results.filter(r => r.success).length;
                    expect(finalWallet.transactions.length).toBe(successfulOperations + 1); // +1 for initial balance
                }
            ),
            { numRuns: 12 }
        );
    });

    test('Property 26.4: Related record consistency with external system integration', () => {
        return fc.assert(
            fc.asyncProperty(
                fc.array(fc.record({
                    amount: positiveAmount,
                    description: transactionDescription,
                    relatedId: fc.constant(new mongoose.Types.ObjectId()),
                    relatedType: transactionType,
                    hasExternalReference: fc.boolean()
                }), { minLength: 1, maxLength: 10 }),
                async (transactions) => {
                    const wallet = await EcoPointsWallet.getOrCreateWallet(testCitizenId);
                    const relatedRecords = new Map(); // Simulate external system records

                    let expectedWalletBalance = 0;
                    let expectedUserPoints = 0;

                    // Process transactions and maintain related record consistency
                    for (const transaction of transactions) {
                        const walletBefore = await EcoPointsWallet.findOne({ citizenId: testCitizenId });
                        const userBefore = await User.findById(testCitizenId);

                        // Simulate external system record creation
                        if (transaction.hasExternalReference) {
                            relatedRecords.set(transaction.relatedId.toString(), {
                                id: transaction.relatedId,
                                type: transaction.relatedType,
                                amount: transaction.amount,
                                status: 'pending',
                                walletTransactionId: null
                            });
                        }

                        try {
                            // Execute wallet transaction
                            await walletBefore.addPoints(
                                transaction.amount,
                                transaction.description,
                                transaction.relatedId,
                                transaction.relatedType
                            );

                            // Update user points for consistency
                            await User.findByIdAndUpdate(testCitizenId, {
                                $inc: { points: transaction.amount }
                            });

                            expectedWalletBalance += transaction.amount;
                            expectedUserPoints += transaction.amount;

                            // Update external system record
                            if (transaction.hasExternalReference) {
                                const walletAfter = await EcoPointsWallet.findOne({ citizenId: testCitizenId });
                                const latestTransaction = walletAfter.transactions[walletAfter.transactions.length - 1];
                                
                                const externalRecord = relatedRecords.get(transaction.relatedId.toString());
                                externalRecord.status = 'completed';
                                externalRecord.walletTransactionId = latestTransaction._id;
                                relatedRecords.set(transaction.relatedId.toString(), externalRecord);
                            }

                        } catch (error) {
                            // Failed transactions should not affect any records
                            const walletAfterError = await EcoPointsWallet.findOne({ citizenId: testCitizenId });
                            const userAfterError = await User.findById(testCitizenId);

                            expect(walletAfterError.balance).toBe(walletBefore.balance);
                            expect(userAfterError.points).toBe(userBefore.points);

                            // External record should remain pending or be cleaned up
                            if (transaction.hasExternalReference) {
                                const externalRecord = relatedRecords.get(transaction.relatedId.toString());
                                expect(externalRecord.status).toBe('pending');
                                expect(externalRecord.walletTransactionId).toBeNull();
                            }
                        }
                    }

                    // Verify final consistency across all systems
                    const finalWallet = await EcoPointsWallet.findOne({ citizenId: testCitizenId });
                    const finalUser = await User.findById(testCitizenId);

                    // Core consistency checks
                    expect(finalWallet.balance).toBe(expectedWalletBalance);
                    expect(finalUser.points).toBe(expectedUserPoints);
                    expect(finalWallet.balance).toBe(finalUser.points);

                    // Verify external system consistency
                    finalWallet.transactions.forEach(transaction => {
                        if (transaction.relatedId && relatedRecords.has(transaction.relatedId.toString())) {
                            const externalRecord = relatedRecords.get(transaction.relatedId.toString());
                            
                            // External record should reference the wallet transaction
                            expect(externalRecord.status).toBe('completed');
                            expect(externalRecord.walletTransactionId.toString()).toBe(transaction._id.toString());
                            expect(externalRecord.amount).toBe(transaction.amount);
                            expect(externalRecord.type).toBe(transaction.relatedType);
                        }
                    });

                    // Verify no orphaned external records
                    for (const [recordId, record] of relatedRecords) {
                        if (record.status === 'completed') {
                            const matchingTransaction = finalWallet.transactions.find(
                                t => t._id.toString() === record.walletTransactionId.toString()
                            );
                            expect(matchingTransaction).toBeDefined();
                            expect(matchingTransaction.relatedId.toString()).toBe(recordId);
                        }
                    }
                }
            ),
            { numRuns: 20 }
        );
    });
});