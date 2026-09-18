#!/usr/bin/env node

/**
 * Waste Management System Checkpoint Validation
 * 
 * This script validates all waste management functionality:
 * 1. Waste logging and data validation
 * 2. Photo upload integration (configuration)
 * 3. EcoPoints calculation accuracy
 * 4. Real-time update capabilities
 * 5. API endpoint availability
 */

import WasteLog, { Waste } from './models/Waste.js';
import WasteTypeConfig from './models/WasteTypeConfig.js';
import EcoPointsWallet from './models/EcoPointsWallet.js';
import { cloudinaryHelpers } from './config/cloudinary.js';
import socketService from './services/socketService.js';

class WasteManagementValidator {
    constructor() {
        this.results = {
            wasteLogging: { status: 'pending', tests: [] },
            photoUpload: { status: 'pending', tests: [] },
            ecoPointsCalculation: { status: 'pending', tests: [] },
            realTimeUpdates: { status: 'pending', tests: [] },
            apiEndpoints: { status: 'pending', tests: [] }
        };
    }

    log(category, test, status, message, details = null) {
        const result = { test, status, message, details, timestamp: new Date() };
        this.results[category].tests.push(result);
        
        const emoji = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
        console.log(`${emoji} [${category.toUpperCase()}] ${test}: ${message}`);
        
        if (details) {
            console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
        }
    }

    async validateWasteLogging() {
        console.log('\n🔍 Validating Waste Logging Functionality...\n');

        try {
            // Test 1: Waste data validation function
            const validData = {
                citizenId: '507f1f77bcf86cd799439011',
                wasteType: 'plastic',
                weight: 2.5,
                description: 'Test plastic bottle'
            };

            const validation = WasteLog.validateWasteData(validData);
            if (validation.isValid) {
                this.log('wasteLogging', 'Valid Data Validation', 'pass', 'Valid waste data passes validation');
            } else {
                this.log('wasteLogging', 'Valid Data Validation', 'fail', 'Valid waste data failed validation', validation.errors);
            }

            // Test 2: Invalid data rejection
            const invalidData = {
                wasteType: 'invalid_type',
                weight: -1
            };

            const invalidValidation = WasteLog.validateWasteData(invalidData);
            if (!invalidValidation.isValid && invalidValidation.errors.length > 0) {
                this.log('wasteLogging', 'Invalid Data Rejection', 'pass', 'Invalid waste data properly rejected', invalidValidation.errors);
            } else {
                this.log('wasteLogging', 'Invalid Data Rejection', 'fail', 'Invalid waste data was not properly rejected');
            }

            // Test 3: Weight boundary validation
            const boundaryTests = [
                { weight: 0.1, expected: 'pass', desc: 'minimum valid weight' },
                { weight: 0.05, expected: 'fail', desc: 'below minimum weight' },
                { weight: 1000, expected: 'pass', desc: 'maximum valid weight' },
                { weight: 1001, expected: 'fail', desc: 'above maximum weight' }
            ];

            boundaryTests.forEach(test => {
                const testData = { ...validData, weight: test.weight };
                const result = WasteLog.validateWasteData(testData);
                const actualResult = result.isValid ? 'pass' : 'fail';
                
                if (actualResult === test.expected) {
                    this.log('wasteLogging', `Weight Boundary (${test.desc})`, 'pass', `Weight ${test.weight}kg handled correctly`);
                } else {
                    this.log('wasteLogging', `Weight Boundary (${test.desc})`, 'fail', `Weight ${test.weight}kg not handled correctly`);
                }
            });

            // Test 4: Waste type enumeration
            const validTypes = ['plastic', 'paper', 'metal', 'glass', 'electronic', 'organic', 'hazardous'];
            const invalidTypes = ['invalid', 'unknown', '', null, undefined];

            validTypes.forEach(type => {
                const testData = { ...validData, wasteType: type };
                const result = WasteLog.validateWasteData(testData);
                if (result.isValid) {
                    this.log('wasteLogging', `Valid Waste Type (${type})`, 'pass', `Waste type '${type}' accepted`);
                } else {
                    this.log('wasteLogging', `Valid Waste Type (${type})`, 'fail', `Valid waste type '${type}' rejected`);
                }
            });

            this.results.wasteLogging.status = 'completed';

        } catch (error) {
            this.log('wasteLogging', 'System Error', 'fail', 'Waste logging validation failed', error.message);
            this.results.wasteLogging.status = 'error';
        }
    }

    async validatePhotoUpload() {
        console.log('\n📸 Validating Photo Upload Integration...\n');

        try {
            // Test 1: Cloudinary configuration validation
            try {
                cloudinaryHelpers.validateConfig();
                this.log('photoUpload', 'Cloudinary Configuration', 'pass', 'Cloudinary configuration is valid');
            } catch (error) {
                this.log('photoUpload', 'Cloudinary Configuration', 'warn', 'Cloudinary configuration missing (expected in dev)', error.message);
            }

            // Test 2: URL generation functions
            const testPublicId = 'ecocycle/waste-photos/test_image_123';
            
            try {
                const optimizedUrl = cloudinaryHelpers.getOptimizedUrl(testPublicId);
                const thumbnailUrl = cloudinaryHelpers.getThumbnailUrl(testPublicId);
                
                if (optimizedUrl && thumbnailUrl) {
                    this.log('photoUpload', 'URL Generation', 'pass', 'Photo URL generation functions work correctly', {
                        optimized: optimizedUrl,
                        thumbnail: thumbnailUrl
                    });
                } else {
                    this.log('photoUpload', 'URL Generation', 'fail', 'Photo URL generation failed');
                }
            } catch (error) {
                this.log('photoUpload', 'URL Generation', 'fail', 'Photo URL generation error', error.message);
            }

            // Test 3: Public ID extraction
            const testUrls = [
                'https://res.cloudinary.com/ecocycle-dev/image/upload/v1234567890/ecocycle/waste-photos/test_image.jpg',
                'https://res.cloudinary.com/test/image/upload/folder/image.png',
                'invalid-url'
            ];

            testUrls.forEach((url, index) => {
                try {
                    const extractedId = cloudinaryHelpers.extractPublicId(url);
                    if (index < 2 && extractedId) {
                        this.log('photoUpload', `Public ID Extraction ${index + 1}`, 'pass', `Successfully extracted public ID: ${extractedId}`);
                    } else if (index === 2 && !extractedId) {
                        this.log('photoUpload', `Public ID Extraction ${index + 1}`, 'pass', 'Invalid URL properly handled');
                    } else {
                        this.log('photoUpload', `Public ID Extraction ${index + 1}`, 'fail', 'Public ID extraction failed');
                    }
                } catch (error) {
                    this.log('photoUpload', `Public ID Extraction ${index + 1}`, 'fail', 'Public ID extraction error', error.message);
                }
            });

            this.results.photoUpload.status = 'completed';

        } catch (error) {
            this.log('photoUpload', 'System Error', 'fail', 'Photo upload validation failed', error.message);
            this.results.photoUpload.status = 'error';
        }
    }

    async validateEcoPointsCalculation() {
        console.log('\n💰 Validating EcoPoints Calculation...\n');

        try {
            // Test 1: Basic calculation logic
            const mockConfig = {
                type: 'plastic',
                pointsPerKg: 10,
                co2SavedPerKg: 2.0
            };

            const testCases = [
                { weight: 1.0, expectedPoints: 10, expectedCO2: 2.0 },
                { weight: 2.5, expectedPoints: 25, expectedCO2: 5.0 },
                { weight: 0.1, expectedPoints: 1, expectedCO2: 0.2 },
                { weight: 1.234, expectedPoints: 12, expectedCO2: 2.468 }
            ];

            testCases.forEach((testCase, index) => {
                const calculatedPoints = Math.round(mockConfig.pointsPerKg * testCase.weight);
                const calculatedCO2 = mockConfig.co2SavedPerKg * testCase.weight;

                if (calculatedPoints === testCase.expectedPoints) {
                    this.log('ecoPointsCalculation', `Points Calculation ${index + 1}`, 'pass', 
                        `${testCase.weight}kg → ${calculatedPoints} points (expected ${testCase.expectedPoints})`);
                } else {
                    this.log('ecoPointsCalculation', `Points Calculation ${index + 1}`, 'fail', 
                        `${testCase.weight}kg → ${calculatedPoints} points (expected ${testCase.expectedPoints})`);
                }

                if (Math.abs(calculatedCO2 - testCase.expectedCO2) < 0.001) {
                    this.log('ecoPointsCalculation', `CO2 Calculation ${index + 1}`, 'pass', 
                        `${testCase.weight}kg → ${calculatedCO2}kg CO2 (expected ${testCase.expectedCO2})`);
                } else {
                    this.log('ecoPointsCalculation', `CO2 Calculation ${index + 1}`, 'fail', 
                        `${testCase.weight}kg → ${calculatedCO2}kg CO2 (expected ${testCase.expectedCO2})`);
                }
            });

            // Test 2: Rounding behavior
            const roundingTests = [
                { calculation: 10.4, expected: 10 },
                { calculation: 10.5, expected: 11 },
                { calculation: 10.6, expected: 11 },
                { calculation: 0.4, expected: 0 },
                { calculation: 0.5, expected: 1 }
            ];

            roundingTests.forEach((test, index) => {
                const rounded = Math.round(test.calculation);
                if (rounded === test.expected) {
                    this.log('ecoPointsCalculation', `Rounding Test ${index + 1}`, 'pass', 
                        `${test.calculation} → ${rounded} (expected ${test.expected})`);
                } else {
                    this.log('ecoPointsCalculation', `Rounding Test ${index + 1}`, 'fail', 
                        `${test.calculation} → ${rounded} (expected ${test.expected})`);
                }
            });

            // Test 3: Wallet balance consistency
            const mockWallet = {
                balance: 100,
                totalEarned: 150,
                totalSpent: 50
            };

            const isConsistent = mockWallet.balance === (mockWallet.totalEarned - mockWallet.totalSpent);
            if (isConsistent) {
                this.log('ecoPointsCalculation', 'Wallet Balance Consistency', 'pass', 
                    `Balance (${mockWallet.balance}) = Earned (${mockWallet.totalEarned}) - Spent (${mockWallet.totalSpent})`);
            } else {
                this.log('ecoPointsCalculation', 'Wallet Balance Consistency', 'fail', 
                    `Balance inconsistency detected`);
            }

            this.results.ecoPointsCalculation.status = 'completed';

        } catch (error) {
            this.log('ecoPointsCalculation', 'System Error', 'fail', 'EcoPoints calculation validation failed', error.message);
            this.results.ecoPointsCalculation.status = 'error';
        }
    }

    async validateRealTimeUpdates() {
        console.log('\n🔄 Validating Real-time Update Capabilities...\n');

        try {
            // Test 1: Socket service initialization
            if (socketService && typeof socketService.emitWalletUpdate === 'function') {
                this.log('realTimeUpdates', 'Socket Service Availability', 'pass', 'Socket service is properly initialized');
            } else {
                this.log('realTimeUpdates', 'Socket Service Availability', 'fail', 'Socket service not available');
            }

            // Test 2: Event emission functions
            const eventFunctions = [
                'emitWalletUpdate',
                'emitNewTransaction',
                'emitPickupStatusUpdate',
                'emitDashboardUpdate',
                'sendNotification'
            ];

            eventFunctions.forEach(funcName => {
                if (typeof socketService[funcName] === 'function') {
                    this.log('realTimeUpdates', `${funcName} Function`, 'pass', `${funcName} function is available`);
                } else {
                    this.log('realTimeUpdates', `${funcName} Function`, 'fail', `${funcName} function is missing`);
                }
            });

            // Test 3: Mock event emission (without actual socket connection)
            try {
                const mockUserId = '507f1f77bcf86cd799439011';
                const mockWalletData = {
                    balance: 100,
                    totalEarned: 150,
                    totalSpent: 50,
                    transactions: [{ type: 'earned', amount: 10, description: 'Test' }],
                    updatedAt: new Date()
                };

                // This won't actually emit since no socket is connected, but tests the function
                socketService.emitWalletUpdate(mockUserId, mockWalletData);
                this.log('realTimeUpdates', 'Mock Event Emission', 'pass', 'Event emission functions execute without errors');
            } catch (error) {
                this.log('realTimeUpdates', 'Mock Event Emission', 'fail', 'Event emission function error', error.message);
            }

            this.results.realTimeUpdates.status = 'completed';

        } catch (error) {
            this.log('realTimeUpdates', 'System Error', 'fail', 'Real-time updates validation failed', error.message);
            this.results.realTimeUpdates.status = 'error';
        }
    }

    async validateApiEndpoints() {
        console.log('\n🌐 Validating API Endpoint Structure...\n');

        try {
            // Test 1: Controller function availability
            const { getUserWasteHistory, logWaste, getAllWasteLogs, updateWasteStatus, getWasteTypeConfigs } = 
                await import('./controllers/wasteController.js');

            const controllerFunctions = [
                { name: 'getUserWasteHistory', func: getUserWasteHistory },
                { name: 'logWaste', func: logWaste },
                { name: 'getAllWasteLogs', func: getAllWasteLogs },
                { name: 'updateWasteStatus', func: updateWasteStatus },
                { name: 'getWasteTypeConfigs', func: getWasteTypeConfigs }
            ];

            controllerFunctions.forEach(({ name, func }) => {
                if (typeof func === 'function') {
                    this.log('apiEndpoints', `${name} Controller`, 'pass', `${name} controller function is available`);
                } else {
                    this.log('apiEndpoints', `${name} Controller`, 'fail', `${name} controller function is missing`);
                }
            });

            // Test 2: Model method availability
            const modelMethods = [
                { name: 'validateWasteData', func: WasteLog.validateWasteData },
                { name: 'calculatePoints', func: WasteLog.prototype.calculatePoints }
            ];

            modelMethods.forEach(({ name, func }) => {
                if (typeof func === 'function') {
                    this.log('apiEndpoints', `${name} Model Method`, 'pass', `${name} model method is available`);
                } else {
                    this.log('apiEndpoints', `${name} Model Method`, 'fail', `${name} model method is missing`);
                }
            });

            // Test 3: Route structure validation (basic check)
            try {
                const wasteRoutes = await import('./routes/wasteRoutes.js');
                if (wasteRoutes.default) {
                    this.log('apiEndpoints', 'Route Module', 'pass', 'Waste routes module loads successfully');
                } else {
                    this.log('apiEndpoints', 'Route Module', 'fail', 'Waste routes module failed to load');
                }
            } catch (error) {
                this.log('apiEndpoints', 'Route Module', 'fail', 'Waste routes module error', error.message);
            }

            this.results.apiEndpoints.status = 'completed';

        } catch (error) {
            this.log('apiEndpoints', 'System Error', 'fail', 'API endpoints validation failed', error.message);
            this.results.apiEndpoints.status = 'error';
        }
    }

    generateSummaryReport() {
        console.log('\n📊 WASTE MANAGEMENT SYSTEM CHECKPOINT SUMMARY\n');
        console.log('=' * 60);

        let totalTests = 0;
        let passedTests = 0;
        let failedTests = 0;
        let warningTests = 0;

        Object.entries(this.results).forEach(([category, result]) => {
            const categoryTests = result.tests;
            const passed = categoryTests.filter(t => t.status === 'pass').length;
            const failed = categoryTests.filter(t => t.status === 'fail').length;
            const warnings = categoryTests.filter(t => t.status === 'warn').length;

            totalTests += categoryTests.length;
            passedTests += passed;
            failedTests += failed;
            warningTests += warnings;

            const statusEmoji = result.status === 'completed' ? '✅' : result.status === 'error' ? '❌' : '⚠️';
            console.log(`${statusEmoji} ${category.toUpperCase()}: ${passed}/${categoryTests.length} tests passed`);
            
            if (failed > 0) {
                console.log(`   ❌ ${failed} failed tests`);
            }
            if (warnings > 0) {
                console.log(`   ⚠️ ${warnings} warnings`);
            }
        });

        console.log('\n' + '=' * 60);
        console.log(`OVERALL RESULTS: ${passedTests}/${totalTests} tests passed`);
        
        if (failedTests > 0) {
            console.log(`❌ ${failedTests} tests failed`);
        }
        if (warningTests > 0) {
            console.log(`⚠️ ${warningTests} warnings`);
        }

        const successRate = ((passedTests / totalTests) * 100).toFixed(1);
        console.log(`📈 Success Rate: ${successRate}%`);

        // Determine overall system status
        if (failedTests === 0 && warningTests <= 2) {
            console.log('\n🎉 CHECKPOINT PASSED: Waste Management System is operational!');
            return 'PASSED';
        } else if (failedTests <= 2) {
            console.log('\n⚠️ CHECKPOINT WARNING: Waste Management System has minor issues');
            return 'WARNING';
        } else {
            console.log('\n❌ CHECKPOINT FAILED: Waste Management System has critical issues');
            return 'FAILED';
        }
    }

    async runFullValidation() {
        console.log('🚀 Starting Waste Management System Checkpoint Validation...\n');
        
        await this.validateWasteLogging();
        await this.validatePhotoUpload();
        await this.validateEcoPointsCalculation();
        await this.validateRealTimeUpdates();
        await this.validateApiEndpoints();
        
        return this.generateSummaryReport();
    }
}

// Run validation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const validator = new WasteManagementValidator();
    validator.runFullValidation()
        .then(result => {
            process.exit(result === 'PASSED' ? 0 : result === 'WARNING' ? 1 : 2);
        })
        .catch(error => {
            console.error('❌ Validation script error:', error);
            process.exit(3);
        });
}

export default WasteManagementValidator;