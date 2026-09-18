import mongoose from 'mongoose';
import User from './models/User.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function checkUsers() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');
        
        // Get all users
        const users = await User.find().select('name email username role password');
        
        console.log('👥 ALL USERS IN DATABASE:\n');
        
        for (const user of users) {
            console.log(`📧 Email: ${user.email}`);
            console.log(`   Username: ${user.username}`);
            console.log(`   Name: ${user.name}`);
            console.log(`   Role: ${user.role}`);
            console.log(`   Password Hash: ${user.password.substring(0, 20)}...`);
            
            // Test if password "admin123" works for this user
            if (user.role === 'admin') {
                const testPasswords = ['admin123', 'Admin123', 'password', 'admin'];
                for (const testPass of testPasswords) {
                    const isMatch = await bcrypt.compare(testPass, user.password);
                    if (isMatch) {
                        console.log(`   ✅ PASSWORD WORKS: "${testPass}"`);
                    }
                }
            }
            
            console.log('');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.connection.close();
    }
}

checkUsers();
