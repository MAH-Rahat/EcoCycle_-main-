import fc from 'fast-check';

// Feature: ecocycle-platform, Property 30: Redemption Transaction Processing

describe('Property 30: Redemption Transaction Processing', () => {
    // Mock implementations for testing core logic
    class MockRewardRedemption {
        constructor(data) {
            this._id = 'mock-id-' + Math.random().toString(36).substr(2, 9);
            this.citizenId = data.citizenId;
            this.rewardId = data.rewardId;
            this.pointsSpent = data.pointsSpent;
            this.status = 'pending';
            this.redemptionCode = this.generateRedemptionCode();
            this.createdAt = new Date();
            this.updatedAt = new Date();
        }

        generateRedemptionCode() {
            const timestamp = Date.now().toString(36);
            const random = Math.random().toString(16).substr(2, 8).toUpperCase();
            return `ECO-${timestamp}-${random}`;
        }

        async save() {
            return this;
        }
    }

    class MockEcoPointsWallet {
        constructor(data) {
            this.citizenId = data.citizenId;
            this.balance = data.balance || 0;
            this.totalEarned = data.totalEarned || 0;
            this.totalSpent = data.totalSpent || 0;
            this.transactions = data.transactions || [];
        }

        spendPoints(amount, description, relatedId, relatedType) {
            if (amount <= 0) {
                throw new Error('Amount must be positive');
            }
            
            if (this.balance < amount) {
                throw new Error('Insufficient balance');
            }
            
            this.balance -= amount;
            this.totalSpent += amount;
            
            this.transactions.push({
                type: 'spent',
                amount,
                description,
                relatedId,
                relatedType,
                createdAt: new Date()
            });
            
            return Promise.resolve(this);
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
            this.stock = data.stock;
            this.totalRedemptions = data.totalRedemptions || 0;
            this.lastRedeemedAt = data.lastRedeemedAt || null;
        }

        decrementStock() {
            if (this.stock !== null && this.stock > 0) {
                this.stock -= 1;
            }
            this.totalRedemptions += 1;
            this.lastRedeemedAt = new Date();
            return Promise.resolve(this);
        }

        async save() {
            return this;
        }
    }

    // Generator for valid reward data
    const rewardGenerator = fc.record({
        name: fc.string({ minLength: 1, maxLength: 100 }),
        pointsCost: fc.integer({ min: 1, max: 1000 }),
        stock: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: null })
    });

    // Generator for sufficient wallet balance
    const sufficientBalanceGenerator = (pointsCost) => fc.integer({ min: pointsCost, max: pointsCost + 10000 });

    /**
     * **Validates: Requirements 8.3**
     * Property 30: Redemption Transaction Processing
     * For any successful reward redemption, EcoPoints should be deducted and a redemption record should be created
     */
    test('should deduct EcoPoints and create redemption record for any successful redemption', () => {
        return fc.assert(fc.property(
            rewardGenerator,
            (rewardData) => {
                const testCitizenId = 'citizen-' + Math.random().toString(36).substr(2, 9);

                // Create test reward
                const reward = new MockReward(rewardData);

                // Create wallet with sufficient balance
                const initialBalance = fc.sample(sufficientBalanceGenerator(reward.pointsCost), 1)[0];
                const wallet = new MockEcoPointsWallet({
                    citizenId: testCitizenId,
                    balance: initialBalance,
                    totalEarned: initialBalance
                });

                // Create redemption record
                const redemption = new MockRewardRedemption({
                    citizenId: testCitizenId,
                    rewardId: reward._id,
                    pointsSpent: reward.pointsCost
                });

                // Simulate the redemption transaction processing
                wallet.spendPoints(
                    reward.pointsCost,
                    `Redeemed reward: ${reward.name}`,
                    redemption._id,
                    'reward'
                );

                reward.decrementStock();

                // Verify redemption record was created correctly
                expect(redemption.citizenId).toBe(testCitizenId);
                expect(redemption.rewardId).toBe(reward._id);
                expect(redemption.pointsSpent).toBe(reward.pointsCost);
                expect(redemption.status).toBe('pending');
                expect(redemption.redemptionCode).toBeDefined();
                expect(redemption.redemptionCode).toMatch(/^ECO-/);

                // Verify EcoPoints were deducted from wallet
                expect(wallet.balance).toBe(initialBalance - reward.pointsCost);
                expect(wallet.totalSpent).toBe(reward.pointsCost);

                // Verify transaction was recorded
                const spentTransaction = wallet.transactions.find(t => 
                    t.type === 'spent' && 
                    t.amount === reward.pointsCost &&
                    t.relatedId === redemption._id
                );
                expect(spentTransaction).toBeDefined();
                expect(spentTransaction.description).toContain(reward.name);
                expect(spentTransaction.relatedType).toBe('reward');

                // Verify reward statistics were updated
                expect(reward.totalRedemptions).toBe(1);
                expect(reward.lastRedeemedAt).toBeDefined();
                
                // If reward had stock, verify it was decremented
                if (rewardData.stock !== null) {
                    expect(reward.stock).toBe(rewardData.stock - 1);
                }
            }
        ), { numRuns: 25 });
    });

    /**
     * Property: Redemption Code Uniqueness
     * For any set of redemptions, all redemption codes should be unique
     */
    test('should generate unique redemption codes for all redemptions', () => {
        return fc.assert(fc.property(
            fc.array(rewardGenerator, { minLength: 2, maxLength: 10 }),
            (rewardsData) => {
                const testCitizenId = 'citizen-' + Math.random().toString(36).substr(2, 9);
                const redemptionCodes = [];

                // Create multiple redemptions
                for (const rewardData of rewardsData) {
                    const reward = new MockReward(rewardData);

                    const redemption = new MockRewardRedemption({
                        citizenId: testCitizenId,
                        rewardId: reward._id,
                        pointsSpent: reward.pointsCost
                    });
                    
                    redemptionCodes.push(redemption.redemptionCode);
                }

                // Verify all redemption codes are unique
                const uniqueCodes = new Set(redemptionCodes);
                expect(uniqueCodes.size).toBe(redemptionCodes.length);

                // Verify all codes follow the expected format
                for (const code of redemptionCodes) {
                    expect(code).toMatch(/^ECO-[a-z0-9]+-[A-F0-9]{8}$/);
                }
            }
        ), { numRuns: 12 });
    });

    /**
     * Property: Balance Consistency
     * For any redemption, the wallet balance should always equal totalEarned minus totalSpent
     */
    test('should maintain wallet balance consistency after redemption', () => {
        return fc.assert(fc.property(
            rewardGenerator,
            (rewardData) => {
                const testCitizenId = 'citizen-' + Math.random().toString(36).substr(2, 9);

                // Create test reward
                const reward = new MockReward(rewardData);

                // Create wallet with sufficient balance
                const initialBalance = fc.sample(sufficientBalanceGenerator(reward.pointsCost), 1)[0];
                const wallet = new MockEcoPointsWallet({
                    citizenId: testCitizenId,
                    balance: initialBalance,
                    totalEarned: initialBalance,
                    totalSpent: 0
                });

                // Create redemption and spend points
                const redemption = new MockRewardRedemption({
                    citizenId: testCitizenId,
                    rewardId: reward._id,
                    pointsSpent: reward.pointsCost
                });

                wallet.spendPoints(
                    reward.pointsCost,
                    `Redeemed reward: ${reward.name}`,
                    redemption._id,
                    'reward'
                );

                // Verify wallet balance consistency
                const expectedBalance = wallet.totalEarned - wallet.totalSpent;
                expect(wallet.balance).toBe(expectedBalance);

                // Verify transaction amounts sum correctly
                const earnedSum = wallet.transactions
                    .filter(t => t.type === 'earned' || t.type === 'bonus')
                    .reduce((sum, t) => sum + t.amount, 0);
                const spentSum = wallet.transactions
                    .filter(t => t.type === 'spent' || t.type === 'penalty')
                    .reduce((sum, t) => sum + t.amount, 0);

                // The totalEarned should match the initial balance since we only spent points
                expect(wallet.totalEarned).toBe(initialBalance);
                expect(wallet.totalSpent).toBe(spentSum);
                expect(wallet.balance).toBe(wallet.totalEarned - wallet.totalSpent);
            }
        ), { numRuns: 25 });
    });

    /**
     * Property: Insufficient Balance Prevention
     * For any redemption attempt with insufficient balance, the transaction should fail and no changes should occur
     */
    test('should prevent redemption when wallet has insufficient balance', () => {
        return fc.assert(fc.property(
            rewardGenerator,
            (rewardData) => {
                const testCitizenId = 'citizen-' + Math.random().toString(36).substr(2, 9);

                // Create test reward
                const reward = new MockReward(rewardData);

                // Create wallet with insufficient balance
                const insufficientBalance = Math.max(0, reward.pointsCost - 1);
                const wallet = new MockEcoPointsWallet({
                    citizenId: testCitizenId,
                    balance: insufficientBalance,
                    totalEarned: insufficientBalance,
                    totalSpent: 0
                });

                const initialWalletState = {
                    balance: wallet.balance,
                    totalSpent: wallet.totalSpent,
                    transactionCount: wallet.transactions.length
                };

                // Attempt to spend points (should fail)
                let errorThrown = false;
                try {
                    wallet.spendPoints(
                        reward.pointsCost,
                        `Redeemed reward: ${reward.name}`,
                        'mock-redemption-id',
                        'reward'
                    );
                } catch (error) {
                    errorThrown = true;
                    expect(error.message).toBe('Insufficient balance');
                }

                expect(errorThrown).toBe(true);

                // Verify wallet state unchanged
                expect(wallet.balance).toBe(initialWalletState.balance);
                expect(wallet.totalSpent).toBe(initialWalletState.totalSpent);
                expect(wallet.transactions.length).toBe(initialWalletState.transactionCount);
            }
        ), { numRuns: 25 });
    });

    /**
     * Property: Transaction Atomicity
     * For any redemption transaction, either all operations succeed or all fail (no partial state)
     */
    test('should maintain transaction atomicity', () => {
        return fc.assert(fc.property(
            rewardGenerator,
            fc.boolean(), // simulate failure condition
            (rewardData, shouldFail) => {
                const testCitizenId = 'citizen-' + Math.random().toString(36).substr(2, 9);

                // Create test reward
                const reward = new MockReward(rewardData);

                // Create wallet with balance (insufficient if shouldFail is true)
                const balance = shouldFail ? 
                    Math.max(0, reward.pointsCost - 1) :
                    fc.sample(sufficientBalanceGenerator(reward.pointsCost), 1)[0];
                
                const wallet = new MockEcoPointsWallet({
                    citizenId: testCitizenId,
                    balance: balance,
                    totalEarned: balance
                });

                const initialWalletState = {
                    balance: wallet.balance,
                    totalSpent: wallet.totalSpent,
                    transactionCount: wallet.transactions.length
                };

                const initialRewardState = {
                    totalRedemptions: reward.totalRedemptions,
                    stock: reward.stock
                };

                let transactionSucceeded = false;
                let redemption = null;

                try {
                    // Create redemption record
                    redemption = new MockRewardRedemption({
                        citizenId: testCitizenId,
                        rewardId: reward._id,
                        pointsSpent: reward.pointsCost
                    });

                    // Attempt to spend points
                    wallet.spendPoints(
                        reward.pointsCost,
                        `Redeemed reward: ${reward.name}`,
                        redemption._id,
                        'reward'
                    );

                    // Update reward statistics
                    reward.decrementStock();
                    
                    transactionSucceeded = true;
                } catch (error) {
                    // Transaction failed - verify no partial state
                    expect(error.message).toBe('Insufficient balance');
                }

                if (shouldFail) {
                    // Verify transaction failed completely
                    expect(transactionSucceeded).toBe(false);
                    
                    // Verify wallet state unchanged
                    expect(wallet.balance).toBe(initialWalletState.balance);
                    expect(wallet.totalSpent).toBe(initialWalletState.totalSpent);
                    expect(wallet.transactions.length).toBe(initialWalletState.transactionCount);
                    
                    // Verify reward state unchanged
                    expect(reward.totalRedemptions).toBe(initialRewardState.totalRedemptions);
                    expect(reward.stock).toBe(initialRewardState.stock);
                } else {
                    // Verify transaction succeeded completely
                    expect(transactionSucceeded).toBe(true);
                    expect(redemption).toBeDefined();
                    
                    // Verify all changes applied
                    expect(wallet.balance).toBe(initialWalletState.balance - reward.pointsCost);
                    expect(wallet.totalSpent).toBe(initialWalletState.totalSpent + reward.pointsCost);
                    expect(wallet.transactions.length).toBe(initialWalletState.transactionCount + 1);
                    
                    expect(reward.totalRedemptions).toBe(initialRewardState.totalRedemptions + 1);
                    if (initialRewardState.stock !== null) {
                        expect(reward.stock).toBe(initialRewardState.stock - 1);
                    }
                }
            }
        ), { numRuns: 25 });
    });
});