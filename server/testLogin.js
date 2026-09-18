import mongoose from 'mongoose';
import User from './models/User.js';
import dotenv from 'dotenv';

dotenv.config();

async function testLogin() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');
        
        // Test credentials
        const testCases = [
            { email: 'admin@example.com', password: 'admin123', shouldWork: true },
            { email: 'admin@gmail.com', password: 'admin123', shouldWork: false },
            { email: 'rahat1@gmail.com', password: 'password123', shouldWork: false },
        ];
        
        for (const test of testCases) {
            console.log(`\n🔐 Testing: ${test.email} / ${test.password}`);
            
            const user = await User.findOne({ email: test.email });
            
            if (!user) {
                console.log('   ❌ User not found');
                continue;
            }
            
            console.log(`   ✅ User found: ${user.name} (${user.role})`);
            
            const isMatch = await user.matchPassword(test.password);
            
            if (isMatch) {
                console.log(`   ✅ PASSWORD CORRECT!`);
            } else {
                console.log(`   ❌ Password incorrect`);
            }
        }
        
        console.log('\n\n📋 WORKING CREDENTIALS:');
        console.log('   Email: admin@example.com');
        console.log('   Password: admin123');
        console.log('   Role: admin');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.connection.close();
    }
}

testLogin();
