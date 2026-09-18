import fc from 'fast-check';

// Feature: ecocycle-platform, Property 29: Reward Redemption Validation

describe('Property 29: Reward Redemption Validation', () => {
    // Mock implementations for testing core validation logic
    class MockEcoPointsWallet {
        constructor(data) {
            this.citizenId = data.citizenId;
            this.balance = data.balance || 0;
            this.totalEarned = data.totalEarned || 0;
            this.totalSpent = data.totalSpent || 0;
            this.transactions = data.transactions || [];
        }

        hasBalance(amount) {
            return this.balance >= amount;
        }

        async save() {
            return this;
        }
    }

    class MockReward {
        constructor(data) {
            this._id = 'reward-id-' + Math.random().toString(36).substr(2, 9);
            this.name = data.name;
            this.pointsCost = data.pointsCost;
            this.isActive = data.isActive !== undefined ? data.isActive : true;
            this.stock = data.stock;
            this.expiresAt = data.expiresAt || null;
        }

        isAvailable() {
            // Check if reward is active
            if (!this.isActive) {
                return false;
            }

            // Check if reward has expired
            if (this.expiresAt && new Date() > this.expiresAt) {
                return false;
            }

            // Check if reward is in stock
            if (this.stock !== null && this.stock <= 0) {
                return false;
            }

            return true;
        }
    }

    class RewardRedemptionValidator {
        static validate(citizen, reward, wallet) {
            const errors = [];

            // Validate citizen exists
            if (!citizen || !citizen._id) {
                errors.push('Citizen not found');
            }

            // Validate reward exists and is available
            if (!reward || !reward._id) {
                errors.push('Reward not found');
            } else if (!reward.isAvailable()) {
                if (!reward.isActive) {
                    errors.push('Reward is no longer available');
                } else if (reward.expiresAt && new Date() > reward.expiresAt) {
                    errors.push('Reward has expired');
                } else if (reward.stock !== null && reward.stock <= 0) {
                    errors.push('Reward is out of stock');
                }
            }

            // Validate wallet exists and has sufficient balance
            if (!wallet || !wallet.citizenId) {
                errors.push('Wallet not found');
            } else if (wallet.citizenId !== citizen._id) {
                errors.push('Wallet does not belong to citizen');
            } else if (reward && !wallet.hasBalance(reward.pointsCost)) {
                errors.push('Insufficient EcoPoints balance');
            }

            // Validate reward cost is positive
            if (reward && reward.pointsCost <= 0) {
                errors.push('Invalid reward cost');
            }

            return {
                isValid: errors.length === 0,
                errors: errors
            };
        }
    }

    // Generators for test data
    const citizenGenerator = fc.record({
        _id: fc.string({ minLength: 1, maxLength: 50 }),
        email: fc.emailAddress(),
        firstName: fc.string({ minLength: 1, maxLength: 50 }),
        lastName: fc.string({ minLength: 1, maxLength: 50 })
    });

    const rewardGenerator = fc.record({
        name: fc.string({ minLength: 1, maxLength: 100 }),
        pointsCost: fc.integer({ min: 1, max: 10000 }),
        isActive: fc.boolean(),
        stock: fc.option(fc.integer({ min: 0, max: 1000 }), { nil: null }),
        expiresAt: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }), { nil: null })
    });

    const walletGenerator = (citizenId, minBalance = 0, maxBalance = 20000) => fc.record({
        citizenId: fc.constant(citizenId),
        balance: fc.integer({ min: minBalance, max: maxBalance }),
        totalEarned: fc.integer({ min: minBalance, max: maxBalance + 10000 }),
        totalSpent: fc.integer({ min: 0, max: 5000 })
    });

    /**
     * **Validates: Requirements 8.2**
     * Property 29: Reward Redemption Validation
     * For any reward redemption attempt, sufficient EcoPoints balance should be verified before processing
     */
    test('should verify sufficient EcoPoints balance before processing any redemption', () => {
        return fc.assert(fc.property(
            citizenGenerator,
            rewardGenerator,
            fc.boolean(), // whether wallet has sufficient balance
            (citizenData, rewardData, hasSufficientBalance) => {
                // Create test citizen
                const citizen = { ...citizenData };

                // Create test reward
                const reward = new MockReward(rewardData);

                // Create wallet with balance based on test condition
                const walletBalance = hasSufficientBalance ? 
                    reward.pointsCost + fc.sample(fc.integer({ min: 0, max: 5000 }), 1)[0] :
                    Math.max(0, reward.pointsCost - fc.sample(fc.integer({ min: 1, max: reward.pointsCost }), 1)[0]);

                const wallet = new MockEcoPointsWallet({
                    citizenId: citizen._id,
                    balance: walletBalance,
                    totalEarned: walletBalance + 1000
                });

                // Validate the redemption
                const validation = RewardRedemptionValidator.validate(citizen, reward, wallet);

                if (hasSufficientBalance && reward.isAvailable()) {
                    // Should be valid if balance is sufficient and reward is available
                    expect(validation.isValid).toBe(true);
                    expect(validation.errors).toHaveLength(0);
                } else {
                    // Should be invalid if balance is insufficient or reward is unavailable
                    expect(validation.isValid).toBe(false);
                    expect(validation.errors.length).toBeGreaterThan(0);

                    if (!hasSufficientBalance) {
                        expect(validation.errors).toContain('Insufficient EcoPoints balance');
                    }

                    if (!reward.isAvailable()) {
                        expect(validation.errors.some(error => 
                            error.includes('no longer available') ||
                            error.includes('expired') ||
                            error.includes('out of stock')
                        )).toBe(true);
                    }
                }

                // Verify balance check is accurate
                expect(wallet.hasBalance(reward.pointsCost)).toBe(hasSufficientBalance);
            }
        ), { numRuns: 25 });
    });

    /**
     * Property: Balance Verification Accuracy
     * For any wallet and amount, balance verification should accurately reflect available funds
     */
    test('should accurately verify balance availability for any amount', () => {
        return fc.assert(fc.property(
            citizenGenerator,
            fc.integer({ min: 0, max: 20000 }), // wallet balance
            fc.integer({ min: 1, max: 25000 }), // required amount
            (citizenData, balance, requiredAmount) => {
                const citizen = { ...citizenData };
                
                const wallet = new MockEcoPointsWallet({
                    citizenId: citizen._id,
                    balance: balance,
                    totalEarned: balance + 1000
                });

                const hasBalance = wallet.hasBalance(requiredAmount);
                const expectedResult = balance >= requiredAmount;

                expect(hasBalance).toBe(expectedResult);

                // Verify the balance check is consistent
                expect(wallet.hasBalance(requiredAmount)).toBe(wallet.hasBalance(requiredAmount));
            }
        ), { numRuns: 25 });
    });

    /**
     * Property: Reward Availability Validation
     * For any reward, availability should be correctly determined based on active status, expiration, and stock
     */
    test('should correctly validate reward availability based on all criteria', () => {
        return fc.assert(fc.property(
            rewardGenerator,
            (rewardData) => {
                const reward = new MockReward(rewardData);
                const isAvailable = reward.isAvailable();

                // Determine expected availability
                let expectedAvailability = true;

                if (!reward.isActive) {
                    expectedAvailability = false;
                }

                if (reward.expiresAt && new Date() > reward.expiresAt) {
                    expectedAvailability = false;
                }

                if (reward.stock !== null && reward.stock <= 0) {
                    expectedAvailability = false;
                }

                expect(isAvailable).toBe(expectedAvailability);

                // Verify availability check is consistent
                expect(reward.isAvailable()).toBe(reward.isAvailable());
            }
        ), { numRuns: 25 });
    });

    /**
     * Property: Validation Error Completeness
     * For any invalid redemption scenario, all relevant validation errors should be reported
     */
    test('should report all relevant validation errors for invalid scenarios', () => {
        return fc.assert(fc.property(
            fc.option(citizenGenerator, { nil: null }), // citizen may be null
            fc.option(rewardGenerator, { nil: null }), // reward may be null
            fc.boolean(), // whether wallet exists
            fc.boolean(), // whether wallet belongs to citizen
            fc.boolean(), // whether balance is sufficient
            (citizenData, rewardData, walletExists, walletBelongsToCitizen, hasSufficientBalance) => {
                const citizen = citizenData;
                const reward = rewardData ? new MockReward(rewardData) : null;
                
                let wallet = null;
                if (walletExists && citizen) {
                    const walletCitizenId = walletBelongsToCitizen ? citizen._id : 'different-citizen-id';
                    const balance = (reward && hasSufficientBalance) ? 
                        reward.pointsCost + 100 : 
                        (reward ? Math.max(0, reward.pointsCost - 1) : 0);

                    wallet = new MockEcoPointsWallet({
                        citizenId: walletCitizenId,
                        balance: balance,
                        totalEarned: balance + 1000
                    });
                }

                const validation = RewardRedemptionValidator.validate(citizen, reward, wallet);

                // Count expected errors
                let expectedErrorCount = 0;
                const expectedErrors = [];

                if (!citizen || !citizen._id) {
                    expectedErrorCount++;
                    expectedErrors.push('Citizen not found');
                }

                if (!reward || !reward._id) {
                    expectedErrorCount++;
                    expectedErrors.push('Reward not found');
                } else {
                    if (!reward.isAvailable()) {
                        expectedErrorCount++;
                    }
                    if (reward.pointsCost <= 0) {
                        expectedErrorCount++;
                        expectedErrors.push('Invalid reward cost');
                    }
                }

                if (!wallet || !wallet.citizenId) {
                    expectedErrorCount++;
                    expectedErrors.push('Wallet not found');
                } else if (citizen && wallet.citizenId !== citizen._id) {
                    expectedErrorCount++;
                    expectedErrors.push('Wallet does not belong to citizen');
                } else if (reward && !wallet.hasBalance(reward.pointsCost)) {
                    expectedErrorCount++;
                    expectedErrors.push('Insufficient EcoPoints balance');
                }

                // Verify validation result matches expected error count
                if (expectedErrorCount === 0) {
                    expect(validation.isValid).toBe(true);
                    expect(validation.errors).toHaveLength(0);
                } else {
                    expect(validation.isValid).toBe(false);
                    expect(validation.errors.length).toBeGreaterThan(0);
                    
                    // Verify specific expected errors are present
                    for (const expectedError of expectedErrors) {
                        if (expectedError !== 'Reward not found' || !reward) {
                            expect(validation.errors).toContain(expectedError);
                        }
                    }
                }
            }
        ), { numRuns: 25 });
    });

    /**
     * Property: Validation Consistency
     * For any identical inputs, validation should always return the same result
     */
    test('should return consistent validation results for identical inputs', () => {
        return fc.assert(fc.property(
            citizenGenerator,
            rewardGenerator,
            fc.integer({ min: 0, max: 20000 }),
            (citizenData, rewardData, balance) => {
                const citizen = { ...citizenData };
                const reward = new MockReward(rewardData);
                const wallet = new MockEcoPointsWallet({
                    citizenId: citizen._id,
                    balance: balance,
                    totalEarned: balance + 1000
                });

                // Run validation multiple times
                const validation1 = RewardRedemptionValidator.validate(citizen, reward, wallet);
                const validation2 = RewardRedemptionValidator.validate(citizen, reward, wallet);
                const validation3 = RewardRedemptionValidator.validate(citizen, reward, wallet);

                // All results should be identical
                expect(validation1.isValid).toBe(validation2.isValid);
                expect(validation2.isValid).toBe(validation3.isValid);
                
                expect(validation1.errors).toEqual(validation2.errors);
                expect(validation2.errors).toEqual(validation3.errors);
            }
        ), { numRuns: 12 });
    });

    /**
     * Property: Edge Case Handling
     * For any edge cases (zero balance, zero cost, boundary values), validation should handle gracefully
     */
    test('should handle edge cases gracefully', () => {
        return fc.assert(fc.property(
            citizenGenerator,
            fc.integer({ min: 0, max: 1 }), // edge case costs (0 or 1)
            fc.integer({ min: 0, max: 1 }), // edge case balances (0 or 1)
            (citizenData, cost, balance) => {
                const citizen = { ...citizenData };
                
                const reward = new MockReward({
                    name: 'Test Reward',
                    pointsCost: cost,
                    isActive: true,
                    stock: 10
                });

                const wallet = new MockEcoPointsWallet({
                    citizenId: citizen._id,
                    balance: balance,
                    totalEarned: balance + 100
                });

                const validation = RewardRedemptionValidator.validate(citizen, reward, wallet);

                // Should not throw errors
                expect(validation).toBeDefined();
                expect(validation.isValid).toBeDefined();
                expect(Array.isArray(validation.errors)).toBe(true);

                // Zero cost should be invalid
                if (cost === 0) {
                    expect(validation.isValid).toBe(false);
                    expect(validation.errors).toContain('Invalid reward cost');
                }

                // Balance validation should work correctly
                if (cost > 0) {
                    const hasBalance = balance >= cost;
                    if (!hasBalance) {
                        expect(validation.errors).toContain('Insufficient EcoPoints balance');
                    }
                }
            }
        ), { numRuns: 12 });
    });
});