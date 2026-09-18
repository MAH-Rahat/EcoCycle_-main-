import mongoose from 'mongoose';
import User from './models/User.js';
import Waste from './models/Waste.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkData() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');
        
        // Check Users
        const userCount = await User.countDocuments();
        const adminCount = await User.countDocuments({ role: 'admin' });
        const collectorCount = await User.countDocuments({ role: 'collector' });
        const citizenCount = await User.countDocuments({ role: 'citizen' });
        
        console.log('👥 USER STATISTICS:');
        console.log(`   Total Users: ${userCount}`);
        console.log(`   Admins: ${adminCount}`);
        console.log(`   Collectors: ${collectorCount}`);
        console.log(`   Citizens: ${citizenCount}\n`);
        
        // Check Waste
        const wasteCount = await Waste.countDocuments();
        const pendingWaste = await Waste.countDocuments({ status: 'Pending' });
        const acceptedWaste = await Waste.countDocuments({ status: 'Accepted' });
        
        console.log('♻️  WASTE STATISTICS:');
        console.log(`   Total Waste Entries: ${wasteCount}`);
        console.log(`   Pending: ${pendingWaste}`);
        console.log(`   Accepted: ${acceptedWaste}\n`);
        
        if (wasteCount > 0) {
            const recentWaste = await Waste.find().sort({ createdAt: -1 }).limit(3).populate('citizen', 'name email');
            console.log('📋 RECENT WASTE ENTRIES:');
            recentWaste.forEach((w, i) => {
                console.log(`   ${i + 1}. ${w.material} - ${w.weight}kg - ${w.status} - By: ${w.citizen?.name || 'Unknown'}`);
            });
        }
        
        console.log('\n✅ Database is properly connected and has data!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.connection.close();
    }
}

checkData();
