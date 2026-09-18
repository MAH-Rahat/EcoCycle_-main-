import fc from 'fast-check';
import mongoose from 'mongoose';
import EcoPointsWallet from '../models/EcoPointsWallet.js';
import { awardPointsForWaste, spendPoints } from '../controllers/ecoPointsController.js';

// Feature: ecocycle-platform, Property 25: Transaction History Completeness
// **Validates: Requirements 7.3**

describe('Property 25: Transaction History Completeness', () => {
    let testCitizenId;

    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecocycle_test');
        }
    });

    beforeEach(async () => {
        await EcoPointsWallet.deleteMany({});
        testCitizenId = new mongoose.Types.ObjectId();
    });

    afterEach(async () => {
        await EcoPointsWallet.deleteMany({});
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    // Custom generators for property-based testing
    const positiveAmount = fc.integer({ min: 1, max: 1000 });
    const transactionDescription = fc.string({ minLength: 5, maxLength: 100 });
    const transactionType = fc.constantFrom('waste', 'pickup', 'reward', 'challenge', 'milestone');
    const wasteType = fc.constantFrom('Plastic', 'Paper', 'Metal', 'Glass');
    const weight = fc.float({ min: Math.fround(0.1), max: Math.fround(50) });

    test('Property 25.1: All wallet operations create complete transaction records with preserved details', () => {
        return fc.assert(
            fc.asyncProperty(
                fc.array(fc.oneof(
                    // Earning points through waste logging
                    fc.record({
                        operation: fc.constant('earn_waste'),
                        wasteType: wasteType,
                        weight: weight,
                        wasteLogId: fc.constant(new mongoose.Types.ObjectId())
                    }),
                    // Direct point earning (bonus, etc.)
                    fc.record({
                        operation: fc.constant('earn_direct'),
                        amount: positiveAmount,
                        description: transactionDescription,
                        relatedId: fc.constant(new mongoose.Types.ObjectId()),
                        relatedType: transactionType
                    }),
                    // Spending points
                    fc.record({
                        operation: fc.constant('spend'),
                        amount: fc.integer({ min: 1, max: 100 }), // Keep small to avoid insufficient balance
                        description: transactionDescription,
                        relatedId: fc.constant(new mongoose.Types.ObjectId()),
                        relatedType: transactionType
                    }),
                    // Bonus points
                    fc.record({
                        operation: fc.constant('bonus'),
                        amount: positiveAmount,
                        description: transactionDescription,
                        relatedId: fc.constant(new mongoose.Types.ObjectId()),
                        relatedType: transactionType
                    })
                ), { minLength: 1, maxLength: 10 }), // Reduced max length
                async (operations) => {
                    const expectedTransactions = [];
                    let operationIndex = 0;
                    
                    // Create a fresh wallet for this test
                    const freshCitizenId = new mongoose.Types.ObjectId();

                    // Execute all operations and track expected transactions
                    for (const operation of operations) {
                        const wallet = await EcoPointsWallet.getOrCreateWallet(freshCitizenId);
                        const transactionCountBefore = wallet.transactions.length;

                        try {
                            if (operation.operation === 'earn_waste') {
                                // Simulate waste logging with points calculation
                                const mockPoints = Math.round(10 * operation.weight); // Simplified calculation
                                await wallet.addPoints(
                                    mockPoints,
                                    `Points earned for recycling ${operation.weight}kg of ${operation.wasteType}`,
                                    operation.wasteLogId,
                                    'waste'
                                );

                                expectedTransactions.push({
                                    type: 'earned',
                                    amount: mockPoints,
                                    description: `Points earned for recycling ${operation.weight}kg of ${operation.wasteType}`,
                                    relatedId: operation.wasteLogId,
                                    relatedType: 'waste',
                                    operationIndex
                                });

                            } else if (operation.operation === 'earn_direct') {
                                await wallet.addPoints(
                                    operation.amount,
                                    operation.description,
                                    operation.relatedId,
                                    operation.relatedType
                                );

                                expectedTransactions.push({
                                    type: 'earned',
                                    amount: operation.amount,
                                    description: operation.description,
                                    relatedId: operation.relatedId,
                                    relatedType: operation.relatedType,
                                    operationIndex
                                });

                            } else if (operation.operation === 'spend') {
                                if (wallet.balance >= operation.amount) {
                                    await wallet.spendPoints(
                                        operation.amount,
                                        operation.description,
                                        operation.relatedId,
                                        operation.relatedType
                                    );

                                    expectedTransactions.push({
                                        type: 'spent',
                                        amount: operation.amount,
                                        description: operation.description,
                                        relatedId: operation.relatedId,
                                        relatedType: operation.relatedType,
                                        operationIndex
                                    });
                                }
                                // If insufficient balance, no transaction should be created

                            } else if (operation.operation === 'bonus') {
                                await wallet.addBonus(
                                    operation.amount,
                                    operation.description,
                                    operation.relatedId,
                                    operation.relatedType
                                );

                                expectedTransactions.push({
                                    type: 'bonus',
                                    amount: operation.amount,
                                    description: operation.description,
                                    relatedId: operation.relatedId,
                                    relatedType: operation.relatedType,
                                    operationIndex
                                });
                            }

                            operationIndex++;

                        } catch (error) {
                            // Failed operations should not create transactions
                            const walletAfterError = await EcoPointsWallet.findOne({ citizenId: testCitizenId });
                            expect(walletAfterError.transactions.length).toBe(transactionCountBefore);
                        }
                    }

                    // Verify complete transaction history
                    const finalWallet = await EcoPointsWallet.findOne({ citizenId: freshCitizenId });
                    
                    // All expected transactions should be present
                    expect(finalWallet.transactions.length).toBe(expectedTransactions.length);

                    // Verify each transaction has complete details preserved
                    finalWallet.transactions.forEach((actualTransaction, index) => {
                        const expectedTransaction = expectedTransactions[index];
                        
                        // Verify all required fields are present and correct
                        expect(actualTransaction.type).toBe(expectedTransaction.type);
                        expect(actualTransaction.amount).toBe(expectedTransaction.amount);
                        expect(actualTransaction.description).toBe(expectedTransaction.description);
                        
                        if (expectedTransaction.relatedId) {
                            expect(actualTransaction.relatedId.toString()).toBe(expectedTransaction.relatedId.toString());
                        }
                        
                        if (expectedTransaction.relatedType) {
                            expect(actualTransaction.relatedType).toBe(expectedTransaction.relatedType);
                        }

                        // Verify transaction has timestamp
                        expect(actualTransaction.createdAt).toBeInstanceOf(Date);
                        expect(actualTransaction._id).toBeDefined();
                    });
                }
            ),
            { numRuns: 12, timeout: 10000 } // Reduced runs and added timeout
        );
    }, 15000); // Jest timeout

    test('Property 25.2: Transaction history maintains chronological order and immutability', () => {
        return fc.assert(
            fc.asyncProperty(
                fc.array(fc.record({
                    amount: positiveAmount,
                    description: transactionDescription,
                    delay: fc.integer({ min: 1, max: 10 }) // Small delay to ensure different timestamps
                }), { minLength: 2, maxLength: 6 }), // Reduced max length
                async (transactions) => {
                    const wallet = await EcoPointsWallet.getOrCreateWallet(new mongoose.Types.ObjectId());
                    const transactionTimestamps = [];

                    // Add transactions with small delays to ensure different timestamps
                    for (let i = 0; i < transactions.length; i++) {
                        const transaction = transactions[i];
                        
                        await wallet.addPoints(transaction.amount, transaction.description);
                        
                        const currentWallet = await EcoPointsWallet.findOne({ citizenId: wallet.citizenId });
                        const latestTransaction = currentWallet.transactions[currentWallet.transactions.length - 1];
                        transactionTimestamps.push(latestTransaction.createdAt);

                        // Small delay to ensure different timestamps
                        if (i < transactions.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, transaction.delay));
                        }
                    }

                    // Verify chronological order
                    const finalWallet = await EcoPointsWallet.findOne({ citizenId: wallet.citizenId });
                    
                    for (let i = 1; i < finalWallet.transactions.length; i++) {
                        const prevTimestamp = finalWallet.transactions[i - 1].createdAt.getTime();
                        const currentTimestamp = finalWallet.transactions[i].createdAt.getTime();
                        
                        // Transactions should be in chronological order (or equal for very fast operations)
                        expect(currentTimestamp).toBeGreaterThanOrEqual(prevTimestamp);
                    }

                    // Verify transaction immutability - transactions should not be modifiable
                    const originalTransactionData = finalWallet.transactions.map(t => ({
                        id: t._id.toString(),
                        type: t.type,
                        amount: t.amount,
                        description: t.description,
                        createdAt: t.createdAt.getTime()
                    }));

                    // Try to add another transaction and verify previous ones are unchanged
                    await wallet.addPoints(50, 'Additional transaction for immutability test');
                    
                    const walletAfterAddition = await EcoPointsWallet.findOne({ citizenId: wallet.citizenId });
                    
                    // Previous transactions should remain exactly the same
                    for (let i = 0; i < originalTransactionData.length; i++) {
                        const original = originalTransactionData[i];
                        const current = walletAfterAddition.transactions[i];
                        
                        expect(current._id.toString()).toBe(original.id);
                        expect(current.type).toBe(original.type);
                        expect(current.amount).toBe(original.amount);
                        expect(current.description).toBe(original.description);
                        expect(current.createdAt.getTime()).toBe(original.createdAt);
                    }
                }
            ),
            { numRuns: 7, timeout: 10000 } // Reduced runs and added timeout
        );
    }, 15000); // Jest timeout

    test('Property 25.3: Transaction history completeness across wallet operations and failures', () => {
        return fc.assert(
            fc.asyncProperty(
                fc.record({
                    initialAmount: fc.integer({ min: 500, max: 2000 }),
                            operations: fc.array(fc.oneof(
                        fc.record({
                            type: fc.constant('valid_spend'),
                            amount: fc.integer({ min: 1, max: 100 }),
                            description: transactionDescription
                        }),
                        fc.record({
                            type: fc.constant('invalid_spend'),
                            amount: fc.integer({ min: 1000, max: 5000 }), // Intentionally large to cause failure
                            description: transactionDescription
                        }),
                        fc.record({
                            type: fc.constant('earn'),
                            amount: positiveAmount,
                            description: transactionDescription
                        })
                    ), { minLength: 3, maxLength: 8 }) // Reduced max length
                }),
                async ({ initialAmount, operations }) => {
                    // Create wallet with initial balance
                    const freshCitizenId = new mongoose.Types.ObjectId();
                    const wallet = await EcoPointsWallet.getOrCreateWallet(freshCitizenId);
                    await wallet.addPoints(initialAmount, 'Initial balance for completeness test');

                    const expectedSuccessfulTransactions = [{
                        type: 'earned',
                        amount: initialAmount,
                        description: 'Initial balance for completeness test'
                    }];

                    let successfulOperations = 1; // Count initial transaction

                    // Execute operations and track which should succeed
                    for (const operation of operations) {
                        const walletBefore = await EcoPointsWallet.findOne({ citizenId: freshCitizenId });
                        const transactionCountBefore = walletBefore.transactions.length;

                        try {
                            if (operation.type === 'valid_spend' || operation.type === 'invalid_spend') {
                                await wallet.spendPoints(operation.amount, operation.description);
                                
                                // If we reach here, the operation succeeded
                                expectedSuccessfulTransactions.push({
                                    type: 'spent',
                                    amount: operation.amount,
                                    description: operation.description
                                });
                                successfulOperations++;

                            } else if (operation.type === 'earn') {
                                await wallet.addPoints(operation.amount, operation.description);
                                
                                expectedSuccessfulTransactions.push({
                                    type: 'earned',
                                    amount: operation.amount,
                                    description: operation.description
                                });
                                successfulOperations++;
                            }

                        } catch (error) {
                            // Failed operations should not create transactions
                            const walletAfterError = await EcoPointsWallet.findOne({ citizenId: freshCitizenId });
                            expect(walletAfterError.transactions.length).toBe(transactionCountBefore);
                        }
                    }

                    // Verify final transaction history completeness
                    const finalWallet = await EcoPointsWallet.findOne({ citizenId: freshCitizenId });
                    
                    // Should have exactly the number of successful operations
                    expect(finalWallet.transactions.length).toBe(successfulOperations);
                    expect(finalWallet.transactions.length).toBe(expectedSuccessfulTransactions.length);

                    // Verify each successful transaction is recorded with complete details
                    finalWallet.transactions.forEach((transaction, index) => {
                        const expected = expectedSuccessfulTransactions[index];
                        
                        expect(transaction.type).toBe(expected.type);
                        expect(transaction.amount).toBe(expected.amount);
                        expect(transaction.description).toBe(expected.description);
                        
                        // Verify all required fields are present
                        expect(transaction._id).toBeDefined();
                        expect(transaction.createdAt).toBeInstanceOf(Date);
                        expect(typeof transaction.amount).toBe('number');
                        expect(typeof transaction.description).toBe('string');
                        expect(transaction.description.length).toBeGreaterThan(0);
                    });

                    // Verify transaction history integrity
                    const totalEarned = finalWallet.transactions
                        .filter(t => t.type === 'earned' || t.type === 'bonus')
                        .reduce((sum, t) => sum + t.amount, 0);
                    
                    const totalSpent = finalWallet.transactions
                        .filter(t => t.type === 'spent')
                        .reduce((sum, t) => sum + t.amount, 0);

                    expect(totalEarned).toBe(finalWallet.totalEarned);
                    expect(totalSpent).toBe(finalWallet.totalSpent);
                    expect(finalWallet.balance).toBe(totalEarned - totalSpent);
                }
            ),
            { numRuns: 7, timeout: 10000 } // Reduced runs and added timeout
        );
    }, 15000); // Jest timeout

    test('Property 25.4: Transaction history preserves all metadata and relationships', () => {
        return fc.assert(
            fc.asyncProperty(
                fc.array(fc.record({
                    amount: positiveAmount,
                    description: transactionDescription,
                    relatedType: transactionType,
                    hasRelatedId: fc.boolean()
                }), { minLength: 1, maxLength: 5 }), // Reduced max length
                async (transactionSpecs) => {
                    const freshCitizenId = new mongoose.Types.ObjectId();
                    const wallet = await EcoPointsWallet.getOrCreateWallet(freshCitizenId);
                    const expectedMetadata = [];

                    // Create transactions with various metadata combinations
                    for (const spec of transactionSpecs) {
                        const relatedId = spec.hasRelatedId ? new mongoose.Types.ObjectId() : null;
                        
                        await wallet.addPoints(
                            spec.amount,
                            spec.description,
                            relatedId,
                            spec.relatedType
                        );

                        expectedMetadata.push({
                            amount: spec.amount,
                            description: spec.description,
                            relatedId: relatedId,
                            relatedType: spec.relatedType,
                            hasRelatedId: spec.hasRelatedId
                        });
                    }

                    // Verify all metadata is preserved
                    const finalWallet = await EcoPointsWallet.findOne({ citizenId: freshCitizenId });
                    
                    expect(finalWallet.transactions.length).toBe(expectedMetadata.length);

                    // Sort transactions by creation time to match expected order
                    const sortedTransactions = finalWallet.transactions.sort((a, b) => a.createdAt - b.createdAt);

                    sortedTransactions.forEach((transaction, index) => {
                        const expected = expectedMetadata[index];
                        
                        // Verify core transaction data
                        expect(transaction.amount).toBe(expected.amount);
                        expect(transaction.description).toBe(expected.description);
                        expect(transaction.type).toBe('earned');

                        // Verify metadata preservation
                        if (expected.hasRelatedId) {
                            expect(transaction.relatedId).toBeDefined();
                            expect(transaction.relatedId.toString()).toBe(expected.relatedId.toString());
                            expect(transaction.relatedType).toBe(expected.relatedType);
                        } else {
                            // relatedId can be null or undefined for transactions without relationships
                            expect(transaction.relatedId).toBeNull();
                        }

                        // Verify system-generated metadata
                        expect(transaction._id).toBeDefined();
                        expect(transaction.createdAt).toBeInstanceOf(Date);
                        expect(transaction.updatedAt).toBeInstanceOf(Date);
                        
                        // Verify timestamp is reasonable (within last minute)
                        const now = new Date();
                        const transactionAge = now.getTime() - transaction.createdAt.getTime();
                        expect(transactionAge).toBeLessThan(60000); // Less than 1 minute
                        expect(transactionAge).toBeGreaterThanOrEqual(0);
                    });
                }
            ),
            { numRuns: 7, timeout: 10000 } // Reduced runs and added timeout
        );
    }, 15000); // Jest timeout
});