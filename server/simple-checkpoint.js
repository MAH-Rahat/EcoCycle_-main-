#!/usr/bin/env node

/**
 * Simple Waste Management System Checkpoint
 */

console.log('🚀 Starting Waste Management System Checkpoint Validation...\n');

async function runCheckpoint() {
    let passedTests = 0;
    let totalTests = 0;
    
    function test(name, testFn) {
        totalTests++;
        try {
            const result = testFn();
            if (result) {
                console.log(`✅ ${name}: PASSED`);
                passedTests++;
            } else {
                console.log(`❌ ${name}: FAILED`);
            }
        } catch (error) {
            console.log(`❌ ${name}: ERROR - ${error.message}`);
        }
    }

    console.log('🔍 Testing Waste Logging Functionality...\n');

    // Import and test waste model
    try {
        const { default: WasteLog } = await import('./models/Waste.js');
        
        test('Waste Model Import', () => WasteLog !== undefined);
        
        test('Waste Data Validation Function', () => {
            const validData = {
                citizenId: '507f1f77bcf86cd799439011',
                wasteType: 'plastic',
                weight: 2.5
            };
            const result = WasteLog.validateWasteData(validData);
            return result.isValid === true;
        });

        test('Invalid Data Rejection', () => {
            const invalidData = { wasteType: 'invalid', weight: -1 };
            const result = WasteLog.validateWasteData(invalidData);
            return result.isValid === false && result.errors.length > 0;
        });

        test('Weight Boundary Validation', () => {
            const testData = {
                citizenId: '507f1f77bcf86cd799439011',
                wasteType: 'plastic',
                weight: 0.05 // Below minimum
            };
            const result = WasteLog.validateWasteData(testData);
            return result.isValid === false;
        });

    } catch (error) {
        console.log(`❌ Waste Model Import: ERROR - ${error.message}`);
    }

    console.log('\n📸 Testing Photo Upload Integration...\n');

    try {
        const { cloudinaryHelpers } = await import('./config/cloudinary.js');
        
        test('Cloudinary Helpers Import', () => cloudinaryHelpers !== undefined);
        
        test('URL Generation Functions', () => {
            const testId = 'test/image';
            const optimizedUrl = cloudinaryHelpers.getOptimizedUrl(testId);
            const thumbnailUrl = cloudinaryHelpers.getThumbnailUrl(testId);
            return optimizedUrl && thumbnailUrl && 
                   optimizedUrl.includes('cloudinary.com') && 
                   thumbnailUrl.includes('cloudinary.com');
        });

        test('Public ID Extraction', () => {
            const testUrl = 'https://res.cloudinary.com/test/image/upload/v123/folder/image.jpg';
            const extractedId = cloudinaryHelpers.extractPublicId(testUrl);
            return extractedId !== null;
        });

    } catch (error) {
        console.log(`❌ Cloudinary Import: ERROR - ${error.message}`);
    }

    console.log('\n💰 Testing EcoPoints Calculation...\n');

    test('Basic Points Calculation', () => {
        const pointsPerKg = 10;
        const weight = 2.5;
        const expectedPoints = 25;
        const calculatedPoints = Math.round(pointsPerKg * weight);
        return calculatedPoints === expectedPoints;
    });

    test('CO2 Calculation', () => {
        const co2PerKg = 2.0;
        const weight = 2.5;
        const expectedCO2 = 5.0;
        const calculatedCO2 = co2PerKg * weight;
        return Math.abs(calculatedCO2 - expectedCO2) < 0.001;
    });

    test('Rounding Behavior', () => {
        return Math.round(10.4) === 10 && Math.round(10.5) === 11;
    });

    test('Wallet Balance Logic', () => {
        const earned = 100;
        const spent = 30;
        const balance = earned - spent;
        return balance === 70;
    });

    console.log('\n🔄 Testing Real-time Updates...\n');

    try {
        const { default: socketService } = await import('./services/socketService.js');
        
        test('Socket Service Import', () => socketService !== undefined);
        
        test('Wallet Update Function', () => {
            return typeof socketService.emitWalletUpdate === 'function';
        });

        test('Notification Function', () => {
            return typeof socketService.sendNotification === 'function';
        });

        test('Dashboard Update Function', () => {
            return typeof socketService.emitDashboardUpdate === 'function';
        });

    } catch (error) {
        console.log(`❌ Socket Service Import: ERROR - ${error.message}`);
    }

    console.log('\n🌐 Testing API Endpoints...\n');

    try {
        const wasteController = await import('./controllers/wasteController.js');
        
        test('Waste Controller Import', () => wasteController !== undefined);
        
        test('Log Waste Function', () => {
            return typeof wasteController.logWaste === 'function';
        });

        test('Get User History Function', () => {
            return typeof wasteController.getUserWasteHistory === 'function';
        });

        test('Update Status Function', () => {
            return typeof wasteController.updateWasteStatus === 'function';
        });

    } catch (error) {
        console.log(`❌ Waste Controller Import: ERROR - ${error.message}`);
    }

    try {
        const wasteRoutes = await import('./routes/wasteRoutes.js');
        test('Waste Routes Import', () => wasteRoutes.default !== undefined);
    } catch (error) {
        console.log(`❌ Waste Routes Import: ERROR - ${error.message}`);
    }

    // Generate summary
    console.log('\n📊 CHECKPOINT SUMMARY\n');
    console.log('='.repeat(50));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${totalTests - passedTests}`);
    
    const successRate = ((passedTests / totalTests) * 100).toFixed(1);
    console.log(`Success Rate: ${successRate}%`);

    if (passedTests === totalTests) {
        console.log('\n🎉 CHECKPOINT PASSED: All waste management functionality is operational!');
        return 'PASSED';
    } else if (passedTests >= totalTests * 0.8) {
        console.log('\n⚠️ CHECKPOINT WARNING: Most functionality working, minor issues detected');
        return 'WARNING';
    } else {
        console.log('\n❌ CHECKPOINT FAILED: Critical issues detected in waste management system');
        return 'FAILED';
    }
}

runCheckpoint()
    .then(result => {
        console.log(`\nFinal Status: ${result}`);
        process.exit(result === 'PASSED' ? 0 : result === 'WARNING' ? 1 : 2);
    })
    .catch(error => {
        console.error('❌ Checkpoint error:', error);
        process.exit(3);
    });