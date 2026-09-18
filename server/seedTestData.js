import mongoose from 'mongoose';
import User from './models/User.js';
import Waste from './models/Waste.js';
import dotenv from 'dotenv';

dotenv.config();

async function seedTestData() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');
        
        // Get a citizen user
        const citizen = await User.findOne({ role: 'citizen' });
        
        if (!citizen) {
            console.log('❌ No citizen user found. Please register a citizen first.');
            return;
        }
        
        console.log(`📝 Creating test waste data for: ${citizen.name}\n`);
        
        // Create sample waste entries (with proper coordinates)
        const wasteData = [
            {
                citizenId: citizen._id,
                citizen: citizen._id,
                wasteType: 'plastic',
                material: 'Plastic',
                weight: 5,
                status: 'pending',
                description: 'Plastic bottles and containers',
                location: {
                    address: {
                        street: '123 Green Street',
                        city: 'Dhaka',
                        zipCode: '1000'
                    },
                    coordinates: {
                        type: 'Point',
                        coordinates: [90.4125, 23.8103] // Dhaka coordinates [longitude, latitude]
                    }
                },
                pickupDetails: {
                    isRequested: true,
                    address: '123 Green Street, Dhaka',
                    requestedTime: new Date(Date.now() + 86400000)
                }
            },
            {
                citizenId: citizen._id,
                citizen: citizen._id,
                wasteType: 'paper',
                material: 'Paper',
                weight: 3,
                status: 'verified',
                description: 'Old newspapers and cardboard',
                location: {
                    address: {
                        street: '456 Eco Avenue',
                        city: 'Dhaka',
                        zipCode: '1200'
                    },
                    coordinates: {
                        type: 'Point',
                        coordinates: [90.4152, 23.8145]
                    }
                },
                pickupDetails: {
                    isRequested: true,
                    address: '456 Eco Avenue, Dhaka',
                    requestedTime: new Date(Date.now() + 172800000)
                }
            },
            {
                citizenId: citizen._id,
                citizen: citizen._id,
                wasteType: 'metal',
                material: 'Metal',
                weight: 8,
                status: 'pending',
                description: 'Aluminum cans and metal scraps',
                location: {
                    address: {
                        street: '789 Recycle Road',
                        city: 'Dhaka',
                        zipCode: '1300'
                    },
                    coordinates: {
                        type: 'Point',
                        coordinates: [90.4180, 23.8200]
                    }
                },
                pickupDetails: {
                    isRequested: true,
                    address: '789 Recycle Road, Dhaka',
                    requestedTime: new Date(Date.now() + 259200000)
                }
            },
            {
                citizenId: citizen._id,
                citizen: citizen._id,
                wasteType: 'glass',
                material: 'Glass',
                weight: 4,
                status: 'verified',
                description: 'Glass bottles and jars',
                location: {
                    address: {
                        street: '321 Clean Lane',
                        city: 'Dhaka',
                        zipCode: '1400'
                    },
                    coordinates: {
                        type: 'Point',
                        coordinates: [90.4095, 23.8050]
                    }
                },
                pickupDetails: {
                    isRequested: true,
                    address: '321 Clean Lane, Dhaka',
                    requestedTime: new Date(Date.now() + 345600000)
                }
            },
            {
                citizenId: citizen._id,
                citizen: citizen._id,
                wasteType: 'electronic',
                material: 'E-Waste',
                weight: 2,
                status: 'pending',
                description: 'Old electronics and cables',
                location: {
                    address: {
                        street: '654 Tech Street',
                        city: 'Dhaka',
                        zipCode: '1500'
                    },
                    coordinates: {
                        type: 'Point',
                        coordinates: [90.4210, 23.8250]
                    }
                },
                pickupDetails: {
                    isRequested: true,
                    address: '654 Tech Street, Dhaka',
                    requestedTime: new Date(Date.now() + 432000000)
                }
            }
        ];
        
        const createdWaste = [];
        
        for (const data of wasteData) {
            const waste = new Waste(data);
            await waste.save();
            createdWaste.push(waste);
        }
        
        console.log(`✅ Created ${createdWaste.length} waste entries:`);
        createdWaste.forEach((w, i) => {
            console.log(`   ${i + 1}. ${w.material} - ${w.weight}kg - ${w.status}`);
        });
        
        console.log('\n🎉 Test data seeded successfully!');
        console.log('💡 Now login to the admin panel to see the data.');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.connection.close();
    }
}

seedTestData();
