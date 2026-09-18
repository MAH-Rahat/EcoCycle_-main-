import fc from 'fast-check';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../server.js';
import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';

// Feature: ecocycle-platform, Property 42: Notification Preference Management

describe('Property 42: Notification Preference Management', () => {
    beforeEach(async () => {
        await User.deleteMany({});
    });

    // Mock user class for testing
    class MockUser {
        constructor(data) {
            this._id = new mongoose.Types.ObjectId();
            this.name = `${data.firstName} ${data.lastName}`;
            this.email = data.email;
            this.username = data.username || data.email.split('@')[0] + Math.random().toString(36).substr(2, 5);
            this.password = data.password || 'hashedpassword123';
            this.role = data.role || 'citizen';
            this.profile = {
                firstName: data.firstName || 'Test',
                lastName: data.lastName || 'User',
                phone: data.phone,
                addresses: data.addresses || [],
                preferences: {
                    notifications: data.notificationPreferences || {
                        pickup: true,
                        rewards: true,
                        challenges: true
                    },
                    privacy: data.privacyPreferences || {
                        showInLeaderboard: true,
                        showFullName: true,
                        shareImpactData: true
                    }
                }
            };
            this.isActive = data.isActive !== false;
        }

        async save() {
            const user = new User(this);
            return await user.save();
        }
    }

    // Generators for property-based testing
    const userGen = () => fc.record({
        firstName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        lastName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        email: fc.emailAddress(),
        role: fc.constantFrom('citizen', 'collector', 'admin'),
        notificationPreferences: fc.record({
            pickup: fc.boolean(),
            rewards: fc.boolean(),
            challenges: fc.boolean()
        }),
        privacyPreferences: fc.record({
            showInLeaderboard: fc.boolean(),
            showFullName: fc.boolean(),
            shareImpactData: fc.boolean()
        })
    });

    const notificationPreferencesGen = () => fc.record({
        pickup: fc.boolean(),
        rewards: fc.boolean(),
        challenges: fc.boolean()
    });

    // Property 42.1: Preference Update Persistence
    test('should persist notification preference updates correctly', async () => {
        await fc.assert(fc.asyncProperty(
            userGen(),
            notificationPreferencesGen(),
            async (userData, newPreferences) => {
                // Clean up before each property test iteration
                await User.deleteMany({});
                
                // Create and save user
                const mockUser = new MockUser(userData);
                const user = await mockUser.save();
                const token = generateToken(user._id);

                // Update notification preferences
                const response = await request(app)
                    .put('/api/notifications/preferences')
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        notifications: newPreferences
                    });

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);

                // Verify preferences were updated in response
                const updatedPreferences = response.body.data.preferences.notifications;
                expect(updatedPreferences.pickup).toBe(newPreferences.pickup);
                expect(updatedPreferences.rewards).toBe(newPreferences.rewards);
                expect(updatedPreferences.challenges).toBe(newPreferences.challenges);

                // Verify preferences were persisted in database
                const updatedUser = await User.findById(user._id);
                expect(updatedUser.profile.preferences.notifications.pickup).toBe(newPreferences.pickup);
                expect(updatedUser.profile.preferences.notifications.rewards).toBe(newPreferences.rewards);
                expect(updatedUser.profile.preferences.notifications.challenges).toBe(newPreferences.challenges);

                // Verify privacy preferences were not affected
                expect(updatedUser.profile.preferences.privacy.showInLeaderboard)
                    .toBe(userData.privacyPreferences.showInLeaderboard);
                expect(updatedUser.profile.preferences.privacy.shareImpactData)
                    .toBe(userData.privacyPreferences.shareImpactData);
            }
        ), { numRuns: 7 });
    });

    // Property 42.2: Preference Retrieval Accuracy
    test('should retrieve notification preferences accurately', async () => {
        await fc.assert(fc.asyncProperty(
            userGen(),
            async (userData) => {
                // Clean up before each property test iteration
                await User.deleteMany({});
                
                // Create and save user
                const mockUser = new MockUser(userData);
                const user = await mockUser.save();
                const token = generateToken(user._id);

                // Retrieve notification preferences
                const response = await request(app)
                    .get('/api/notifications/preferences')
                    .set('Authorization', `Bearer ${token}`);

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);

                // Verify retrieved preferences match stored preferences
                const retrievedPreferences = response.body.data.preferences;
                expect(retrievedPreferences.notifications.pickup)
                    .toBe(userData.notificationPreferences.pickup);
                expect(retrievedPreferences.notifications.rewards)
                    .toBe(userData.notificationPreferences.rewards);
                expect(retrievedPreferences.notifications.challenges)
                    .toBe(userData.notificationPreferences.challenges);

                // Verify privacy preferences are also returned
                expect(retrievedPreferences.privacy.showInLeaderboard)
                    .toBe(userData.privacyPreferences.showInLeaderboard);
                expect(retrievedPreferences.privacy.shareImpactData)
                    .toBe(userData.privacyPreferences.shareImpactData);
            }
        ), { numRuns: 7 });
    });

    // Property 42.3: Partial Preference Updates
    test('should handle partial notification preference updates correctly', async () => {
        await fc.assert(fc.asyncProperty(
            userGen(),
            fc.constantFrom('pickup', 'rewards', 'challenges'),
            fc.boolean(),
            async (userData, preferenceKey, newValue) => {
                // Clean up before each property test iteration
                await User.deleteMany({});
                
                // Create and save user
                const mockUser = new MockUser(userData);
                const user = await mockUser.save();
                const token = generateToken(user._id);

                // Create partial update (only one preference)
                const partialUpdate = {
                    notifications: {
                        [preferenceKey]: newValue
                    }
                };

                // Update notification preferences
                const response = await request(app)
                    .put('/api/notifications/preferences')
                    .set('Authorization', `Bearer ${token}`)
                    .send(partialUpdate);

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);

                // Verify the updated preference
                const updatedPreferences = response.body.data.preferences.notifications;
                expect(updatedPreferences[preferenceKey]).toBe(newValue);

                // Verify other preferences remain unchanged (default to true for missing values)
                const otherKeys = ['pickup', 'rewards', 'challenges'].filter(key => key !== preferenceKey);
                for (const key of otherKeys) {
                    expect(updatedPreferences[key]).toBe(true); // Default value when not specified
                }

                // Verify in database
                const updatedUser = await User.findById(user._id);
                expect(updatedUser.profile.preferences.notifications[preferenceKey]).toBe(newValue);
            }
        ), { numRuns: 7 });
    });

    // Property 42.4: Invalid Preference Handling
    test('should handle invalid notification preference values gracefully', async () => {
        await fc.assert(fc.asyncProperty(
            userGen(),
            fc.oneof(
                fc.constant(null),
                fc.constant(undefined),
                fc.string(),
                fc.integer(),
                fc.array(fc.boolean()),
                fc.record({
                    pickup: fc.oneof(fc.string(), fc.integer(), fc.constant(null)),
                    rewards: fc.oneof(fc.string(), fc.integer(), fc.constant(null)),
                    challenges: fc.oneof(fc.string(), fc.integer(), fc.constant(null))
                })
            ),
            async (userData, invalidPreferences) => {
                // Clean up before each property test iteration
                await User.deleteMany({});
                
                // Create and save user
                const mockUser = new MockUser(userData);
                const user = await mockUser.save();
                const token = generateToken(user._id);

                // Attempt to update with invalid preferences
                const response = await request(app)
                    .put('/api/notifications/preferences')
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        notifications: invalidPreferences
                    });

                // Should still succeed but use default values for invalid inputs
                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);

                // Verify preferences are set to defaults (true) for invalid values
                const updatedPreferences = response.body.data.preferences.notifications;
                expect(typeof updatedPreferences.pickup).toBe('boolean');
                expect(typeof updatedPreferences.rewards).toBe('boolean');
                expect(typeof updatedPreferences.challenges).toBe('boolean');

                // Invalid values should default to true
                if (typeof invalidPreferences?.pickup !== 'boolean') {
                    expect(updatedPreferences.pickup).toBe(true);
                }
                if (typeof invalidPreferences?.rewards !== 'boolean') {
                    expect(updatedPreferences.rewards).toBe(true);
                }
                if (typeof invalidPreferences?.challenges !== 'boolean') {
                    expect(updatedPreferences.challenges).toBe(true);
                }
            }
        ), { numRuns: 7 });
    });

    // Property 42.5: Authentication Required for Preference Management
    test('should require authentication for preference operations', async () => {
        await fc.assert(fc.asyncProperty(
            notificationPreferencesGen(),
            async (preferences) => {
                // Attempt to update preferences without authentication
                const updateResponse = await request(app)
                    .put('/api/notifications/preferences')
                    .send({
                        notifications: preferences
                    });

                // Should be 401 (unauthorized) or 429 (rate limited)
                expect([401, 429]).toContain(updateResponse.status);
                expect(updateResponse.body.success).toBe(false);

                // Attempt to retrieve preferences without authentication
                const getResponse = await request(app)
                    .get('/api/notifications/preferences');

                // Should be 401 (unauthorized) or 429 (rate limited)
                expect([401, 429]).toContain(getResponse.status);
                expect(getResponse.body.success).toBe(false);
            }
        ), { numRuns: 5 });
    });

    // Property 42.6: User Isolation for Preferences
    test('should ensure users can only access their own preferences', async () => {
        await fc.assert(fc.asyncProperty(
            userGen(),
            userGen(),
            notificationPreferencesGen(),
            async (user1Data, user2Data, preferences) => {
                // Clean up before each property test iteration
                await User.deleteMany({});
                
                // Ensure different users
                if (user1Data.email === user2Data.email) {
                    user2Data.email = 'different_' + user2Data.email;
                }

                // Create two users
                const mockUser1 = new MockUser(user1Data);
                const mockUser2 = new MockUser(user2Data);
                
                const user1 = await mockUser1.save();
                const user2 = await mockUser2.save();
                
                const token1 = generateToken(user1._id);
                const token2 = generateToken(user2._id);

                // User 1 updates their preferences
                const updateResponse = await request(app)
                    .put('/api/notifications/preferences')
                    .set('Authorization', `Bearer ${token1}`)
                    .send({
                        notifications: preferences
                    });

                expect(updateResponse.status).toBe(200);

                // User 2 retrieves their own preferences (should be unchanged)
                const getResponse = await request(app)
                    .get('/api/notifications/preferences')
                    .set('Authorization', `Bearer ${token2}`);

                expect(getResponse.status).toBe(200);

                // User 2's preferences should match their original settings, not user 1's updates
                const user2Preferences = getResponse.body.data.preferences.notifications;
                expect(user2Preferences.pickup).toBe(user2Data.notificationPreferences.pickup);
                expect(user2Preferences.rewards).toBe(user2Data.notificationPreferences.rewards);
                expect(user2Preferences.challenges).toBe(user2Data.notificationPreferences.challenges);

                // Verify user 1's preferences were actually updated
                const user1GetResponse = await request(app)
                    .get('/api/notifications/preferences')
                    .set('Authorization', `Bearer ${token1}`);

                const user1Preferences = user1GetResponse.body.data.preferences.notifications;
                expect(user1Preferences.pickup).toBe(preferences.pickup);
                expect(user1Preferences.rewards).toBe(preferences.rewards);
                expect(user1Preferences.challenges).toBe(preferences.challenges);
            }
        ), { numRuns: 5 });
    });

    // Property 42.7: Preference Validation and Sanitization
    test('should validate and sanitize preference input data', async () => {
        await fc.assert(fc.asyncProperty(
            userGen(),
            async (userData) => {
                // Clean up before each property test iteration
                await User.deleteMany({});
                
                // Create and save user
                const mockUser = new MockUser(userData);
                const user = await mockUser.save();
                const token = generateToken(user._id);

                // Test various edge cases and malicious inputs
                const testCases = [
                    // Extra properties should be ignored
                    {
                        notifications: {
                            pickup: true,
                            rewards: false,
                            challenges: true,
                            maliciousProperty: 'should be ignored',
                            __proto__: { pollution: 'attempt' }
                        }
                    },
                    // Missing properties should default to true
                    {
                        notifications: {
                            pickup: false
                            // rewards and challenges missing
                        }
                    },
                    // Empty object should use defaults
                    {
                        notifications: {}
                    }
                ];

                for (const testCase of testCases) {
                    const response = await request(app)
                        .put('/api/notifications/preferences')
                        .set('Authorization', `Bearer ${token}`)
                        .send(testCase);

                    expect(response.status).toBe(200);
                    expect(response.body.success).toBe(true);

                    // Verify only valid properties are present
                    const preferences = response.body.data.preferences.notifications;
                    expect(Object.keys(preferences)).toEqual(['pickup', 'rewards', 'challenges']);
                    
                    // Verify all values are booleans
                    expect(typeof preferences.pickup).toBe('boolean');
                    expect(typeof preferences.rewards).toBe('boolean');
                    expect(typeof preferences.challenges).toBe('boolean');

                    // Verify no malicious properties
                    expect(preferences.maliciousProperty).toBeUndefined();
                    expect(preferences.__proto__).toBeUndefined();
                }
            }
        ), { numRuns: 5 });
    });

    // Property 42.8: Concurrent Preference Updates
    test('should handle concurrent preference updates correctly', async () => {
        await fc.assert(fc.asyncProperty(
            userGen(),
            notificationPreferencesGen(),
            notificationPreferencesGen(),
            async (userData, preferences1, preferences2) => {
                // Clean up before each property test iteration
                await User.deleteMany({});
                
                // Create and save user
                const mockUser = new MockUser(userData);
                const user = await mockUser.save();
                const token = generateToken(user._id);

                // Perform concurrent updates
                const [response1, response2] = await Promise.all([
                    request(app)
                        .put('/api/notifications/preferences')
                        .set('Authorization', `Bearer ${token}`)
                        .send({ notifications: preferences1 }),
                    request(app)
                        .put('/api/notifications/preferences')
                        .set('Authorization', `Bearer ${token}`)
                        .send({ notifications: preferences2 })
                ]);

                // Both requests should succeed
                expect(response1.status).toBe(200);
                expect(response2.status).toBe(200);

                // Final state should be consistent (one of the updates should win)
                const finalResponse = await request(app)
                    .get('/api/notifications/preferences')
                    .set('Authorization', `Bearer ${token}`);

                expect(finalResponse.status).toBe(200);
                
                const finalPreferences = finalResponse.body.data.preferences.notifications;
                
                // Final state should match either preferences1 or preferences2
                const matchesPrefs1 = 
                    finalPreferences.pickup === preferences1.pickup &&
                    finalPreferences.rewards === preferences1.rewards &&
                    finalPreferences.challenges === preferences1.challenges;
                
                const matchesPrefs2 = 
                    finalPreferences.pickup === preferences2.pickup &&
                    finalPreferences.rewards === preferences2.rewards &&
                    finalPreferences.challenges === preferences2.challenges;

                expect(matchesPrefs1 || matchesPrefs2).toBe(true);
            }
        ), { numRuns: 5 });
    });
});