import fc from 'fast-check';
import mongoose from 'mongoose';
import Leaderboard from '../models/Leaderboard.js';
import User from '../models/User.js';

// Feature: ecocycle-platform, Property 37: Leaderboard Filtering
// **Validates: Requirements 10.1**

describe('Property 37: Leaderboard Filtering', () => {
    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecocycle_test');
        }
    });

    beforeEach(async () => {
        await Leaderboard.deleteMany({});
        await User.deleteMany({});
    });

    afterEach(async () => {
        await Leaderboard.deleteMany({});
        await User.deleteMany({});
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    // Custom generators for property-based testing
    const zipCodeGen = fc.oneof(
        fc.integer({ min: 10000, max: 99999 }).map(n => n.toString()),
        fc.tuple(fc.char().filter(c => /[A-Z]/.test(c)), fc.integer({ min: 0, max: 9 }), fc.char().filter(c => /[A-Z]/.test(c)), fc.integer({ min: 0, max: 9 }), fc.char().filter(c => /[A-Z]/.test(c)), fc.integer({ min: 0, max: 9 }))
            .map(([c1, n1, c2, n2, c3, n3]) => `${c1}${n1}${c2} ${n2}${c3}${n3}`)
    );
    
    const cityGen = fc.oneof(
        fc.constantFrom('New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose'),
        fc.string({ minLength: 3, maxLength: 15 }).filter(s => /^[A-Za-z\s]+$/.test(s) && s.trim().length >= 3)
    );
    
    const scoreGen = fc.integer({ min: 0, max: 10000 });
    const periodGen = fc.constantFrom('weekly', 'monthly', 'all_time');
    const displayNameGen = fc.oneof(
        fc.constantFrom('John Doe', 'Jane Smith', 'Bob Johnson', 'Alice Brown', 'Charlie Wilson'),
        fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[A-Za-z\s]+$/.test(s) && s.trim().length >= 3)
    );

    const userGen = fc.record({
        firstName: fc.oneof(
            fc.constantFrom('John', 'Jane', 'Bob', 'Alice', 'Charlie', 'Diana', 'Eve', 'Frank'),
            fc.string({ minLength: 2, maxLength: 10 }).filter(s => /^[A-Za-z]+$/.test(s))
        ),
        lastName: fc.oneof(
            fc.constantFrom('Doe', 'Smith', 'Johnson', 'Brown', 'Wilson', 'Davis', 'Miller', 'Garcia'),
            fc.string({ minLength: 2, maxLength: 10 }).filter(s => /^[A-Za-z]+$/.test(s))
        ),
        email: fc.emailAddress(),
        username: fc.string({ minLength: 3, maxLength: 15 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
        zipCode: zipCodeGen,
        city: cityGen,
        showInLeaderboard: fc.boolean()
    });

    const leaderboardEntryGen = fc.record({
        score: scoreGen,
        displayName: displayNameGen,
        metrics: fc.record({
            totalWeight: fc.integer({ min: 0, max: 1000 }),
            totalPickups: fc.integer({ min: 0, max: 100 }),
            totalPoints: scoreGen,
            co2Saved: fc.integer({ min: 0, max: 500 })
        })
    });

    it('Property 37.1: Area filtering returns only users from specified geographic area', () => {
        return fc.assert(
            fc.asyncProperty(
                fc.record({
                    targetArea: fc.record({
                        zipCode: zipCodeGen,
                        city: cityGen
                    }),
                    users: fc.array(userGen, { minLength: 3, maxLength: 8 }),
                    period: periodGen
                }),
                async ({ targetArea, users, period }) => {
                    // Create users with various locations
                    const createdUsers = [];
                    for (let i = 0; i < users.length; i++) {
                        const userData = users[i];
                        const uniqueId = `${i}_${Math.random().toString(36).substr(2, 3)}`;
                        
                        const user = await User.create({
                            name: `${userData.firstName} ${userData.lastName}`,
                            username: `${userData.username.substr(0, 10)}_${uniqueId}`,
                            email: `test_${uniqueId}@test.com`,
                            password: 'hashedpassword123',
                            role: 'citizen',
                            profile: {
                                firstName: userData.firstName,
                                lastName: userData.lastName,
                                addresses: [{
                                    street: '123 Test St',
                                    city: userData.city,
                                    zipCode: userData.zipCode,
                                    coordinates: {
                                        type: 'Point',
                                        coordinates: [-74.0060 + Math.random() * 0.1, 40.7128 + Math.random() * 0.1]
                                    },
                                    isDefault: true
                                }],
                                preferences: {
                                    privacy: {
                                        showInLeaderboard: userData.showInLeaderboard
                                    }
                                }
                            }
                        });
                        createdUsers.push(user);
                    }

                    // Get area leaderboard for target area
                    const areaLeaderboard = await Leaderboard.getAreaLeaderboard(targetArea, period, 50);

                    // Verify all returned users are from the target area
                    for (const entry of areaLeaderboard.rankings) {
                        if (entry.citizenId) {
                            const user = await User.findById(entry.citizenId._id);
                            const userAddresses = user.profile?.addresses || [];
                            
                            // At least one address should match the target area
                            const hasMatchingAddress = userAddresses.some(addr => 
                                addr.zipCode === targetArea.zipCode
                            );
                            
                            expect(hasMatchingAddress).toBe(true);
                            
                            // User should have opted into leaderboard display
                            expect(user.profile?.preferences?.privacy?.showInLeaderboard).not.toBe(false);
                        }
                    }

                    // Verify leaderboard metadata
                    expect(areaLeaderboard.type).toBe('area');
                    expect(areaLeaderboard.period).toBe(period);
                    expect(areaLeaderboard.area.zipCode).toBe(targetArea.zipCode);
                }
            ),
            { numRuns: 5, timeout: 10000 }
        );
    }, 15000);

    it('Property 37.2: Global leaderboard includes users from all areas without geographic restrictions', () => {
        return fc.assert(
            fc.asyncProperty(
                fc.record({
                    users: fc.array(userGen, { minLength: 3, maxLength: 6 }),
                    period: periodGen,
                    entries: fc.array(fc.record({
                        score: scoreGen,
                        displayName: displayNameGen,
                        metrics: fc.record({
                            totalWeight: fc.integer({ min: 0, max: 1000 }),
                            totalPickups: fc.integer({ min: 0, max: 100 }),
                            totalPoints: scoreGen,
                            co2Saved: fc.integer({ min: 0, max: 500 })
                        })
                    }), { minLength: 3, maxLength: 6 })
                }),
                async ({ users, period, entries }) => {
                    // Create users from different areas
                    const createdUsers = [];
                    for (let i = 0; i < users.length; i++) {
                        const userData = users[i];
                        const uniqueId = `${i}_${Math.random().toString(36).substr(2, 3)}`;
                        
                        const user = await User.create({
                            name: `${userData.firstName} ${userData.lastName}`,
                            username: `${userData.username.substr(0, 10)}_${uniqueId}`,
                            email: `test_${uniqueId}@test.com`,
                            password: 'hashedpassword123',
                            role: 'citizen',
                            profile: {
                                firstName: userData.firstName,
                                lastName: userData.lastName,
                                addresses: [{
                                    street: '123 Test St',
                                    city: userData.city,
                                    zipCode: userData.zipCode,
                                    coordinates: {
                                        type: 'Point',
                                        coordinates: [-74.0060 + Math.random() * 10, 40.7128 + Math.random() * 10]
                                    },
                                    isDefault: true
                                }],
                                preferences: {
                                    privacy: {
                                        showInLeaderboard: userData.showInLeaderboard
                                    }
                                }
                            }
                        });
                        createdUsers.push(user);
                    }

                    // Create global leaderboard with entries
                    const globalLeaderboard = await Leaderboard.findOrCreate({
                        type: 'global',
                        period: period
                    });

                    // Add entries for users
                    for (let i = 0; i < Math.min(entries.length, createdUsers.length); i++) {
                        const user = createdUsers[i];
                        const entry = entries[i];
                        
                        if (user.profile?.preferences?.privacy?.showInLeaderboard !== false) {
                            await globalLeaderboard.updateUserRanking(
                                user._id,
                                entry.score,
                                entry.metrics
                            );
                            
                            // Set display name
                            const userEntry = globalLeaderboard.rankings.find(
                                e => e.citizenId.toString() === user._id.toString()
                            );
                            if (userEntry) {
                                userEntry.displayName = entry.displayName;
                            }
                        }
                    }

                    await globalLeaderboard.save();

                    // Get global leaderboard
                    const retrievedLeaderboard = await Leaderboard.getGlobalLeaderboard(period, 50);

                    // Verify leaderboard properties
                    expect(retrievedLeaderboard.type).toBe('global');
                    expect(retrievedLeaderboard.period).toBe(period);
                    expect(retrievedLeaderboard.area).toBeUndefined();

                    // Verify no geographic restrictions - users from different areas should be included
                    const uniqueZipCodes = new Set();
                    for (const entry of retrievedLeaderboard.rankings) {
                        if (entry.citizenId) {
                            const user = await User.findById(entry.citizenId._id);
                            const userZipCodes = user.profile?.addresses?.map(addr => addr.zipCode) || [];
                            userZipCodes.forEach(zip => uniqueZipCodes.add(zip));
                        }
                    }

                    // If we have multiple users from different areas, we should see multiple zip codes
                    const distinctUserAreas = new Set(users.map(u => u.zipCode));
                    if (distinctUserAreas.size > 1 && retrievedLeaderboard.rankings.length > 1) {
                        expect(uniqueZipCodes.size).toBeGreaterThan(1);
                    }
                }
            ),
            { numRuns: 5, timeout: 10000 }
        );
    }, 15000);

    it('Property 37.3: Leaderboard rankings are correctly ordered by score in descending order', () => {
        return fc.assert(
            fc.asyncProperty(
                fc.record({
                    area: fc.record({
                        zipCode: zipCodeGen,
                        city: cityGen
                    }),
                    period: periodGen,
                    userScores: fc.array(fc.record({
                        user: userGen,
                        score: scoreGen
                    }), { minLength: 3, maxLength: 6 })
                }),
                async ({ area, period, userScores }) => {
                    // Create users and leaderboard entries
                    const createdUsers = [];
                    for (let i = 0; i < userScores.length; i++) {
                        const { user: userData, score } = userScores[i];
                        const uniqueId = `${i}_${Math.random().toString(36).substr(2, 3)}`;
                        
                        const user = await User.create({
                            name: `${userData.firstName} ${userData.lastName}`,
                            username: `${userData.username.substr(0, 10)}_${uniqueId}`,
                            email: `test_${uniqueId}@test.com`,
                            password: 'hashedpassword123',
                            role: 'citizen',
                            profile: {
                                firstName: userData.firstName,
                                lastName: userData.lastName,
                                addresses: [{
                                    street: '123 Test St',
                                    city: area.city,
                                    zipCode: area.zipCode,
                                    coordinates: {
                                        type: 'Point',
                                        coordinates: [-74.0060, 40.7128]
                                    },
                                    isDefault: true
                                }],
                                preferences: {
                                    privacy: {
                                        showInLeaderboard: userData.showInLeaderboard
                                    }
                                }
                            }
                        });
                        createdUsers.push({ user, score });
                    }

                    // Create area leaderboard and add entries
                    const leaderboard = await Leaderboard.findOrCreate({
                        type: 'area',
                        period: period,
                        'area.zipCode': area.zipCode
                    });

                    for (const { user, score } of createdUsers) {
                        if (user.profile?.preferences?.privacy?.showInLeaderboard !== false) {
                            await leaderboard.updateUserRanking(user._id, score);
                        }
                    }

                    await leaderboard.save();

                    // Get the leaderboard
                    const retrievedLeaderboard = await Leaderboard.getAreaLeaderboard(area, period, 50);

                    // Verify rankings are in descending order by score
                    for (let i = 0; i < retrievedLeaderboard.rankings.length - 1; i++) {
                        const currentEntry = retrievedLeaderboard.rankings[i];
                        const nextEntry = retrievedLeaderboard.rankings[i + 1];
                        
                        expect(currentEntry.score).toBeGreaterThanOrEqual(nextEntry.score);
                        
                        // Verify rank assignment
                        expect(currentEntry.rank).toBeLessThanOrEqual(nextEntry.rank);
                        
                        // If scores are equal, ranks should be equal
                        if (currentEntry.score === nextEntry.score) {
                            expect(currentEntry.rank).toBe(nextEntry.rank);
                        } else {
                            expect(currentEntry.rank).toBeLessThan(nextEntry.rank);
                        }
                    }

                    // Verify rank continuity (ranks should start from 1 and be continuous)
                    if (retrievedLeaderboard.rankings.length > 0) {
                        expect(retrievedLeaderboard.rankings[0].rank).toBe(1);
                        
                        for (let i = 1; i < retrievedLeaderboard.rankings.length; i++) {
                            const currentRank = retrievedLeaderboard.rankings[i].rank;
                            const previousRank = retrievedLeaderboard.rankings[i - 1].rank;
                            const currentScore = retrievedLeaderboard.rankings[i].score;
                            const previousScore = retrievedLeaderboard.rankings[i - 1].score;
                            
                            if (currentScore === previousScore) {
                                // Same score should have same rank
                                expect(currentRank).toBe(previousRank);
                            } else {
                                // Different score should have appropriate rank progression
                                expect(currentRank).toBeGreaterThan(previousRank);
                            }
                        }
                    }
                }
            ),
            { numRuns: 5, timeout: 10000 }
        );
    }, 15000);

    it('Property 37.4: Privacy settings are respected in leaderboard filtering', () => {
        return fc.assert(
            fc.asyncProperty(
                fc.record({
                    area: fc.record({
                        zipCode: zipCodeGen,
                        city: cityGen
                    }),
                    period: periodGen,
                    users: fc.array(fc.record({
                        userData: userGen,
                        score: scoreGen,
                        showInLeaderboard: fc.boolean()
                    }), { minLength: 4, maxLength: 8 })
                }),
                async ({ area, period, users }) => {
                    // Create users with explicit privacy settings
                    const createdUsers = [];
                    for (let i = 0; i < users.length; i++) {
                        const { userData, score, showInLeaderboard } = users[i];
                        const uniqueId = `${i}_${Math.random().toString(36).substr(2, 3)}`;
                        
                        const user = await User.create({
                            name: `${userData.firstName} ${userData.lastName}`,
                            username: `${userData.username.substr(0, 10)}_${uniqueId}`,
                            email: `test_${uniqueId}@test.com`,
                            password: 'hashedpassword123',
                            role: 'citizen',
                            profile: {
                                firstName: userData.firstName,
                                lastName: userData.lastName,
                                addresses: [{
                                    street: '123 Test St',
                                    city: area.city,
                                    zipCode: area.zipCode,
                                    coordinates: {
                                        type: 'Point',
                                        coordinates: [-74.0060, 40.7128]
                                    },
                                    isDefault: true
                                }],
                                preferences: {
                                    privacy: {
                                        showInLeaderboard: showInLeaderboard
                                    }
                                }
                            }
                        });
                        createdUsers.push({ user, score, showInLeaderboard });
                    }

                    // Create leaderboard and add all users
                    const leaderboard = await Leaderboard.findOrCreate({
                        type: 'area',
                        period: period,
                        'area.zipCode': area.zipCode
                    });

                    for (const { user, score } of createdUsers) {
                        await leaderboard.updateUserRanking(user._id, score);
                    }

                    await leaderboard.save();

                    // Get filtered leaderboard (should respect privacy)
                    const retrievedLeaderboard = await Leaderboard.getAreaLeaderboard(area, period, 50);

                    // Verify only users who opted in are shown
                    for (const entry of retrievedLeaderboard.rankings) {
                        if (entry.citizenId) {
                            const user = await User.findById(entry.citizenId._id);
                            const showInLeaderboard = user.profile?.preferences?.privacy?.showInLeaderboard;
                            
                            // User should have explicitly opted in or not set preference (default true)
                            expect(showInLeaderboard).not.toBe(false);
                        }
                    }

                    // Verify users who opted out are not included
                    const usersWhoOptedOut = createdUsers.filter(({ showInLeaderboard }) => showInLeaderboard === false);
                    const leaderboardUserIds = retrievedLeaderboard.rankings.map(entry => 
                        entry.citizenId ? entry.citizenId._id.toString() : null
                    ).filter(Boolean);

                    for (const { user } of usersWhoOptedOut) {
                        expect(leaderboardUserIds).not.toContain(user._id.toString());
                    }

                    // Verify users who opted in are included (if they have scores)
                    const usersWhoOptedIn = createdUsers.filter(({ showInLeaderboard }) => showInLeaderboard === true);
                    for (const { user } of usersWhoOptedIn) {
                        if (leaderboardUserIds.length > 0) {
                            // At least some users who opted in should be present
                            const someOptedInUsersPresent = usersWhoOptedIn.some(({ user: u }) => 
                                leaderboardUserIds.includes(u._id.toString())
                            );
                            expect(someOptedInUsersPresent).toBe(true);
                            break;
                        }
                    }
                }
            ),
            { numRuns: 5, timeout: 10000 }
        );
    }, 15000);
});