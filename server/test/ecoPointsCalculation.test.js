import fc from 'fast-check';
import mongoose from 'mongoose';
import EcoPointsWallet from '../models/EcoPointsWallet.js';
import WasteTypeConfig from '../models/WasteTypeConfig.js';
import { awardPointsForWaste, spendPoints, awardBonusPoints } from '../controllers/ecoPointsController.js';

// Feature: ecocycle-platform, Property 8: EcoPoints Calculation Accuracy
describe('EcoPoints Calculation Property-Based Tests', () => {
    let testCitizen;
    let wasteTypeConfigs;

    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecocycle_test');
        }
    });

    beforeEach(async () => {
        await EcoPointsWallet.deleteMany({});
        await WasteTypeConfig.deleteMany({});
        
        // Create test citizen
        testCitizen = {
            _id: new mongoose.Types.ObjectId(),
            name: 'Test Citizen',
            email: 'citizen@test.com',
            role: 'citizen'
        };

        // Initialize test waste type configurations with known values
        wasteTypeConfigs = [
            {
                type: 'Plastic',
                pointsPerKg: 10,
                co2SavedPerKg: 2.0,
                description: 'Plastic materials',
                recyclingTips: ['Clean before recycling'],
                isActive: true
            },
            {
                type: 'Paper',
                pointsPerKg: 8,
                co2SavedPerKg: 1.5,
                description: 'Paper materials',
                recyclingTips: ['Keep dry'],
                isActive: true
            },
            {
                type: 'Metal',
                pointsPerKg: 15,
                co2SavedPerKg: 3.0,
                description: 'Metal materials',
                recyclingTips: ['Rinse containers'],
                isActive: true
            },
            {
                type: 'Glass',
                pointsPerKg: 12,
                co2SavedPerKg: 2.5,
                description: 'Glass materials',
                recyclingTips: ['Remove caps'],
                isActive: true
            }
        ];

        await WasteTypeConfig.insertMany(wasteTypeConfigs);
    });

    afterEach(async () => {
        await EcoPointsWallet.deleteMany({});
        await WasteTypeConfig.deleteMany({});
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    // Custom generators for EcoPoints testing
    const validWasteTypeGen = () => fc.constantFrom('Plastic', 'Paper', 'Metal', 'Glass');
    
    const validWeightGen = () => fc.float({ min: 0.1, max: 100 });
    
    const positiveAmountGen = () => fc.integer({ min: 1, max: 10000 });
    
    const wasteLogIdGen = () => fc.constant(new mongoose.Types.ObjectId());

    // Property 8: EcoPoints Calculation Accuracy
    describe('Property 8: EcoPoints Calculation Accuracy', () => {
        test('For any waste log entry, EcoPoints should be calculated correctly based on waste type and weight using the defined conversion rates', () => {
            return fc.assert(fc.asyncProperty(
                validWasteTypeGen(),
                validWeightGen(),
                wasteLogIdGen(),
                async (wasteType, weight, wasteLogId) => {
                    // Get the expected calculation
                    const config = wasteTypeConfigs.find(c => c.type === wasteType);
                    const expectedPoints = Math.round(config.pointsPerKg * weight);

                    // Award points using the system
                    const result = await awardPointsForWaste(testCitizen._id, wasteType, weight, wasteLogId);

                    // Verify the calculation is correct
                    expect(result.points).toBe(expectedPoints);

                    // Verify wallet balance is updated correctly
                    const wallet = await EcoPointsWallet.findOne({ citizenId: testCitizen._id });
                    expect(wallet.balance).toBe(expectedPoints);
                    expect(wallet.totalEarned).toBe(expectedPoints);
                    expect(wallet.totalSpent).toBe(0);

                    // Verify transaction is recorded correctly
                    expect(wallet.transactions).toHaveLength(1);
                    const transaction = wallet.transactions[0];
                    expect(transaction.type).toBe('earned');
                    expect(transaction.amount).toBe(expectedPoints);
                    expect(transaction.relatedId.toString()).toBe(wasteLogId.toString());
                    expect(transaction.relatedType).toBe('waste');
                }
            ), { numRuns: 12 });
        });

        test('For any sequence of waste log entries, total EcoPoints should equal the sum of individual calculations', () => {
            return fc.assert(fc.asyncProperty(
                fc.array(
                    fc.record({
                        wasteType: validWasteTypeGen(),
                        weight: validWeightGen(),
                        wasteLogId: wasteLogIdGen()
                    }),
                    { minLength: 1, maxLength: 10 }
                ),
                async (wasteLogs) => {
                    let expectedTotalPoints = 0;

                    // Award points for each waste log
                    for (const wasteLog of wasteLogs) {
                        const config = wasteTypeConfigs.find(c => c.type === wasteLog.wasteType);
                        const expectedPoints = Math.round(config.pointsPerKg * wasteLog.weight);
                        expectedTotalPoints += expectedPoints;

                        const result = await awardPointsForWaste(
                            testCitizen._id, 
                            wasteLog.wasteType, 
                            wasteLog.weight, 
                            wasteLog.wasteLogId
                        );

                        expect(result.points).toBe(expectedPoints);
                    }

                    // Verify final wallet state
                    const wallet = await EcoPointsWallet.findOne({ citizenId: testCitizen._id });
                    expect(wallet.balance).toBe(expectedTotalPoints);
                    expect(wallet.totalEarned).toBe(expectedTotalPoints);
                    expect(wallet.transactions).toHaveLength(wasteLogs.length);

                    // Verify sum of all transactions equals total
                    const transactionSum = wallet.transactions.reduce((sum, t) => sum + t.amount, 0);
                    expect(transactionSum).toBe(expectedTotalPoints);
                }
            ), { numRuns: 7 });
        });
    });

    // Property: Calculation Precision and Rounding
    describe('Property: Calculation Precision and Rounding', () => {
        test('For any weight with decimal places, points calculation should use proper rounding', () => {
            return fc.assert(fc.asyncProperty(
                validWasteTypeGen(),
                fc.float({ min: 0.1, max: 10, noDefaultInfinity: true, noNaN: true }),
                wasteLogIdGen(),
                async (wasteType, weight, wasteLogId) => {
                    const config = wasteTypeConfigs.find(c => c.type === wasteType);
                    const exactCalculation = config.pointsPerKg * weight;
                    const expectedPoints = Math.round(exactCalculation);

                    const result = await awardPointsForWaste(testCitizen._id, wasteType, weight, wasteLogId);

                    expect(result.points).toBe(expectedPoints);
                    expect(Number.isInteger(result.points)).toBe(true);

                    // Verify rounding is consistent
                    if (exactCalculation - Math.floor(exactCalculation) >= 0.5) {
                        expect(result.points).toBe(Math.ceil(exactCalculation));
                    } else {
                        expect(result.points).toBe(Math.floor(exactCalculation));
                    }
                }
            ), { numRuns: 12 });
        });

        test('For any very small weight values, minimum point calculation should be handled correctly', () => {
            return fc.assert(fc.asyncProperty(
                validWasteTypeGen(),
                fc.float({ min: 0.01, max: 0.1 }),
                wasteLogIdGen(),
                async (wasteType, weight, wasteLogId) => {
                    const config = wasteTypeConfigs.find(c => c.type === wasteType);
                    const expectedPoints = Math.round(config.pointsPerKg * weight);

                    const result = await awardPointsForWaste(testCitizen._id, wasteType, weight, wasteLogId);

                    expect(result.points).toBe(expectedPoints);
                    expect(result.points).toBeGreaterThanOrEqual(0);

                    // For very small weights, points might be 0 due to rounding
                    if (config.pointsPerKg * weight < 0.5) {
                        expect(result.points).toBe(0);
                    }
                }
            ), { numRuns: 10 });
        });
    });

    // Property: Wallet Balance Consistency
    describe('Property: Wallet Balance Consistency', () => {
        test('For any sequence of point operations, wallet balance should always equal totalEarned minus totalSpent', () => {
            return fc.assert(fc.asyncProperty(
                fc.array(
                    fc.oneof(
                        // Earning points
                        fc.record({
                            operation: fc.constant('earn'),
                            wasteType: validWasteTypeGen(),
                            weight: validWeightGen(),
                            wasteLogId: wasteLogIdGen()
                        }),
                        // Spending points
                        fc.record({
                            operation: fc.constant('spend'),
                            amount: fc.integer({ min: 1, max: 50 }) // Keep amounts small to avoid insufficient balance
                        })
                    ),
                    { minLength: 1, maxLength: 15 }
                ),
                async (operations) => {
                    let expectedBalance = 0;
                    let expectedTotalEarned = 0;
                    let expectedTotalSpent = 0;

                    for (const operation of operations) {
                        if (operation.operation === 'earn') {
                            const config = wasteTypeConfigs.find(c => c.type === operation.wasteType);
                            const points = Math.round(config.pointsPerKg * operation.weight);
                            
                            await awardPointsForWaste(
                                testCitizen._id, 
                                operation.wasteType, 
                                operation.weight, 
                                operation.wasteLogId
                            );
                            
                            expectedBalance += points;
                            expectedTotalEarned += points;
                        } else if (operation.operation === 'spend') {
                            // Only spend if we have enough balance
                            if (expectedBalance >= operation.amount) {
                                await spendPoints(
                                    testCitizen._id,
                                    operation.amount,
                                    'Test spending',
                                    null,
                                    'reward'
                                );
                                
                                expectedBalance -= operation.amount;
                                expectedTotalSpent += operation.amount;
                            }
                        }
                    }

                    // Verify final wallet state
                    const wallet = await EcoPointsWallet.findOne({ citizenId: testCitizen._id });
                    expect(wallet.balance).toBe(expectedBalance);
                    expect(wallet.totalEarned).toBe(expectedTotalEarned);
                    expect(wallet.totalSpent).toBe(expectedTotalSpent);

                    // Verify balance consistency
                    expect(wallet.balance).toBe(wallet.totalEarned - wallet.totalSpent);
                }
            ), { numRuns: 6 });
        });

        test('For any spending operation, balance should never go negative', () => {
            return fc.assert(fc.asyncProperty(
                positiveAmountGen(),
                positiveAmountGen(),
                async (earnAmount, spendAmount) => {
                    // First earn some points
                    const wallet = await EcoPointsWallet.getOrCreateWallet(testCitizen._id);
                    await wallet.addPoints(earnAmount, 'Test earning');

                    // Try to spend more than available
                    if (spendAmount > earnAmount) {
                        await expect(
                            spendPoints(testCitizen._id, spendAmount, 'Test overspending')
                        ).rejects.toThrow('Insufficient balance');

                        // Verify balance unchanged
                        const updatedWallet = await EcoPointsWallet.findOne({ citizenId: testCitizen._id });
                        expect(updatedWallet.balance).toBe(earnAmount);
                    } else {
                        // Should succeed if spending within balance
                        await spendPoints(testCitizen._id, spendAmount, 'Test spending');
                        
                        const updatedWallet = await EcoPointsWallet.findOne({ citizenId: testCitizen._id });
                        expect(updatedWallet.balance).toBe(earnAmount - spendAmount);
                        expect(updatedWallet.balance).toBeGreaterThanOrEqual(0);
                    }
                }
            ), { numRuns: 10 });
        });
    });

    // Property: Transaction History Integrity
    describe('Property: Transaction History Integrity', () => {
        test('For any wallet operations, transaction history should be complete and accurate', () => {
            return fc.assert(fc.asyncProperty(
                fc.array(
                    fc.record({
                        wasteType: validWasteTypeGen(),
                        weight: validWeightGen(),
                        wasteLogId: wasteLogIdGen()
                    }),
                    { minLength: 1, maxLength: 8 }
                ),
                async (wasteLogs) => {
                    const expectedTransactions = [];

                    // Award points for each waste log
                    for (const wasteLog of wasteLogs) {
                        const config = wasteTypeConfigs.find(c => c.type === wasteLog.wasteType);
                        const expectedPoints = Math.round(config.pointsPerKg * wasteLog.weight);

                        await awardPointsForWaste(
                            testCitizen._id, 
                            wasteLog.wasteType, 
                            wasteLog.weight, 
                            wasteLog.wasteLogId
                        );

                        expectedTransactions.push({
                            type: 'earned',
                            amount: expectedPoints,
                            relatedId: wasteLog.wasteLogId,
                            relatedType: 'waste'
                        });
                    }

                    // Verify transaction history
                    const wallet = await EcoPointsWallet.findOne({ citizenId: testCitizen._id });
                    expect(wallet.transactions).toHaveLength(expectedTransactions.length);

                    wallet.transactions.forEach((transaction, index) => {
                        const expected = expectedTransactions[index];
                        expect(transaction.type).toBe(expected.type);
                        expect(transaction.amount).toBe(expected.amount);
                        expect(transaction.relatedId.toString()).toBe(expected.relatedId.toString());
                        expect(transaction.relatedType).toBe(expected.relatedType);
                        expect(transaction.createdAt).toBeInstanceOf(Date);
                    });
                }
            ), { numRuns: 7 });
        });

        test('For any transaction, timestamps should be in chronological order', () => {
            return fc.assert(fc.asyncProperty(
                fc.array(
                    fc.record({
                        wasteType: validWasteTypeGen(),
                        weight: validWeightGen(),
                        wasteLogId: wasteLogIdGen()
                    }),
                    { minLength: 2, maxLength: 5 }
                ),
                async (wasteLogs) => {
                    // Award points with small delays to ensure different timestamps
                    for (let i = 0; i < wasteLogs.length; i++) {
                        const wasteLog = wasteLogs[i];
                        await awardPointsForWaste(
                            testCitizen._id, 
                            wasteLog.wasteType, 
                            wasteLog.weight, 
                            wasteLog.wasteLogId
                        );
                        
                        // Small delay to ensure different timestamps
                        if (i < wasteLogs.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 1));
                        }
                    }

                    // Verify chronological order
                    const wallet = await EcoPointsWallet.findOne({ citizenId: testCitizen._id });
                    
                    for (let i = 1; i < wallet.transactions.length; i++) {
                        const prevTransaction = wallet.transactions[i - 1];
                        const currentTransaction = wallet.transactions[i];
                        
                        expect(currentTransaction.createdAt.getTime()).toBeGreaterThanOrEqual(
                            prevTransaction.createdAt.getTime()
                        );
                    }
                }
            ), { numRuns: 5 });
        });
    });

    // Property: Bonus Points and Penalties
    describe('Property: Bonus Points and Penalties', () => {
        test('For any bonus points award, wallet should be updated correctly', () => {
            return fc.assert(fc.asyncProperty(
                positiveAmountGen(),
                fc.string({ minLength: 5, maxLength: 100 }),
                async (bonusAmount, description) => {
                    const wallet = await EcoPointsWallet.getOrCreateWallet(testCitizen._id);
                    const initialBalance = wallet.balance;
                    const initialTotalEarned = wallet.totalEarned;

                    await wallet.addBonus(bonusAmount, description);

                    const updatedWallet = await EcoPointsWallet.findOne({ citizenId: testCitizen._id });
                    expect(updatedWallet.balance).toBe(initialBalance + bonusAmount);
                    expect(updatedWallet.totalEarned).toBe(initialTotalEarned + bonusAmount);

                    // Verify bonus transaction
                    const bonusTransaction = updatedWallet.transactions.find(t => t.type === 'bonus');
                    expect(bonusTransaction).toBeTruthy();
                    expect(bonusTransaction.amount).toBe(bonusAmount);
                    expect(bonusTransaction.description).toBe(description);
                }
            ), { numRuns: 7 });
        });

        test('For any penalty application, balance should not go below zero', () => {
            return fc.assert(fc.asyncProperty(
                positiveAmountGen(),
                positiveAmountGen(),
                async (initialAmount, penaltyAmount) => {
                    const wallet = await EcoPointsWallet.getOrCreateWallet(testCitizen._id);
                    await wallet.addPoints(initialAmount, 'Initial points');

                    await wallet.applyPenalty(penaltyAmount, 'Test penalty');

                    const updatedWallet = await EcoPointsWallet.findOne({ citizenId: testCitizen._id });
                    expect(updatedWallet.balance).toBeGreaterThanOrEqual(0);

                    if (penaltyAmount >= initialAmount) {
                        // Should deduct all available balance
                        expect(updatedWallet.balance).toBe(0);
                    } else {
                        // Should deduct exact penalty amount
                        expect(updatedWallet.balance).toBe(initialAmount - penaltyAmount);
                    }

                    // Verify penalty transaction
                    const penaltyTransaction = updatedWallet.transactions.find(t => t.type === 'penalty');
                    expect(penaltyTransaction).toBeTruthy();
                    expect(penaltyTransaction.amount).toBeLessThanOrEqual(penaltyAmount);
                    expect(penaltyTransaction.amount).toBeLessThanOrEqual(initialAmount);
                }
            ), { numRuns: 7 });
        });
    });
});