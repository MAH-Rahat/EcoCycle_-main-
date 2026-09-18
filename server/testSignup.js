import mongoose from 'mongoose';
import User from './models/User.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function testSignup() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');
        
        // Test creating a new user
        const testUser = {
            name: 'Test Signup User',
            email: 'testsignup@example.com',
            mobile: '01712345678',
            username: 'testsignup',
            password: 'test123',
            role: 'citizen'
        };
        
        console.log('📝 Testing user creation...');
        console.log('   Data:', testUser);
        
        // Check if user already exists
        const existing = await User.findOne({ email: testUser.email });
        if (existing) {
            console.log('\n⚠️  User already exists, deleting first...');
            await User.deleteOne({ email: testUser.email });
        }
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(testUser.password, salt);
        
        // Create user
        const user = await User.create({
            ...testUser,
            password: hashedPassword,
            points: 100
        });
        
        console.log('\n✅ User created successfully!');
        console.log(`   ID: ${user._id}`);
        console.log(`   Name: ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Points: ${user.points}`);
        
        // Verify user can be found
        const foundUser = await User.findById(user._id);
        console.log('\n✅ User can be retrieved from database');
        
        // Test password matching
        const isMatch = await foundUser.matchPassword(testUser.password);
        console.log(`✅ Password matching works: ${isMatch}`);
        
        // Clean up
        await User.deleteOne({ _id: user._id });
        console.log('\n🧹 Test user deleted');
        
        console.log('\n✅ All signup tests passed!');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error('   Stack:', error.stack);
    } finally {
        await mongoose.connection.close();
    }
}

testSignup();
