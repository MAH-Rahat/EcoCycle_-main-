import mongoose from 'mongoose';
import User from './models/User.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function resetPasswords() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');
        
        // Define password resets
        const resets = [
            { email: 'admin@gmail.com', newPassword: 'admin123' },
            { email: 'rahat1@gmail.com', newPassword: 'collector123' },
        ];
        
        for (const reset of resets) {
            const user = await User.findOne({ email: reset.email });
            
            if (!user) {
                console.log(`❌ User not found: ${reset.email}`);
                continue;
            }
            
            // Hash the new password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(reset.newPassword, salt);
            
            // Update password
            await User.findByIdAndUpdate(user._id, {
                password: hashedPassword
            });
            
            console.log(`✅ Password reset for: ${reset.email}`);
            console.log(`   Username: ${user.username}`);
            console.log(`   Name: ${user.name}`);
            console.log(`   Role: ${user.role}`);
            console.log(`   New Password: ${reset.newPassword}\n`);
        }
        
        console.log('\n📋 ALL WORKING CREDENTIALS:\n');
        console.log('1. Admin Account:');
        console.log('   Email: admin@example.com');
        console.log('   Password: admin123\n');
        
        console.log('2. Admin Account (Rahat):');
        console.log('   Email: admin@gmail.com');
        console.log('   Password: admin123\n');
        
        console.log('3. Collector Account:');
        console.log('   Email: collector@example.com');
        console.log('   Password: collector123\n');
        
        console.log('4. Collector Account (Rahat):');
        console.log('   Email: rahat1@gmail.com');
        console.log('   Password: collector123\n');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.connection.close();
    }
}

resetPasswords();
