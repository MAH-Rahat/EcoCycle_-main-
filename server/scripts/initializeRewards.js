import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Reward from '../models/Reward.js';
import Partner from '../models/Partner.js';

dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB connected for rewards initialization');
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        process.exit(1);
    }
};

const initializePartners = async () => {
    const existingPartners = await Partner.countDocuments();
    
    if (existingPartners === 0) {
        const samplePartners = [
            {
                name: 'EcoMart',
                description: 'Sustainable products and eco-friendly goods',
                logo: 'https://via.placeholder.com/200x100/4CAF50/FFFFFF?text=EcoMart',
                website: 'https://ecomart.example.com',
                contactInfo: {
                    email: 'partner@ecomart.com',
                    phone: '+1-555-0123',
                    address: {
                        street: '123 Green Street',
                        city: 'Eco City',
                        state: 'CA',
                        zipCode: '90210',
                        country: 'USA'
                    }
                },
                partnershipType: 'product_supplier',
                terms: [
                    'Valid for 30 days from redemption',
                    'Cannot be combined with other offers',
                    'Subject to product availability'
                ]
            },
            {
                name: 'Green Coffee Co.',
                description: 'Organic and fair-trade coffee shop chain',
                logo: 'https://via.placeholder.com/200x100/8BC34A/FFFFFF?text=Green+Coffee',
                website: 'https://greencoffee.example.com',
                contactInfo: {
                    email: 'rewards@greencoffee.com',
                    phone: '+1-555-0456'
                },
                partnershipType: 'local_business',
                terms: [
                    'Valid at participating locations only',
                    'One voucher per visit',
                    'Cannot be redeemed for cash'
                ]
            },
            {
                name: 'Earth Foundation',
                description: 'Environmental conservation and tree planting charity',
                logo: 'https://via.placeholder.com/200x100/2E7D32/FFFFFF?text=Earth+Foundation',
                website: 'https://earthfoundation.example.com',
                contactInfo: {
                    email: 'donations@earthfoundation.org'
                },
                partnershipType: 'charity',
                terms: [
                    'Donation will be made within 30 days',
                    'Tax receipt available upon request',
                    'Funds used for tree planting initiatives'
                ]
            }
        ];

        await Partner.insertMany(samplePartners);
        console.log('✅ Sample partners initialized');
        return await Partner.find();
    }
    
    return await Partner.find();
};

const initializeRewards = async () => {
    const existingRewards = await Reward.countDocuments();
    
    if (existingRewards === 0) {
        const partners = await Partner.find();
        const ecoMart = partners.find(p => p.name === 'EcoMart');
        const greenCoffee = partners.find(p => p.name === 'Green Coffee Co.');
        const earthFoundation = partners.find(p => p.name === 'Earth Foundation');

        const sampleRewards = [
            // Vouchers
            {
                name: '$5 EcoMart Voucher',
                description: 'Get $5 off your next purchase at EcoMart. Valid on all sustainable products including reusable bags, bamboo utensils, and eco-friendly cleaning supplies.',
                category: 'vouchers',
                pointsCost: 50,
                image: 'https://via.placeholder.com/400x300/4CAF50/FFFFFF?text=$5+EcoMart+Voucher',
                partnerId: ecoMart?._id,
                priority: 10,
                terms: [
                    'Valid for 30 days from redemption',
                    'Cannot be combined with other offers',
                    'Minimum purchase of $10 required'
                ],
                redemptionInstructions: 'Present this voucher code at checkout or enter online',
                estimatedDelivery: 'Instant digital delivery'
            },
            {
                name: '$10 EcoMart Voucher',
                description: 'Get $10 off your next purchase at EcoMart. Perfect for larger eco-friendly purchases like solar chargers, organic clothing, or home composting kits.',
                category: 'vouchers',
                pointsCost: 100,
                image: 'https://via.placeholder.com/400x300/4CAF50/FFFFFF?text=$10+EcoMart+Voucher',
                partnerId: ecoMart?._id,
                priority: 8,
                terms: [
                    'Valid for 30 days from redemption',
                    'Cannot be combined with other offers',
                    'Minimum purchase of $20 required'
                ],
                redemptionInstructions: 'Present this voucher code at checkout or enter online',
                estimatedDelivery: 'Instant digital delivery'
            },
            {
                name: 'Free Coffee at Green Coffee Co.',
                description: 'Enjoy a free medium-sized organic coffee or tea at any Green Coffee Co. location. Choose from our selection of fair-trade, sustainably sourced beverages.',
                category: 'vouchers',
                pointsCost: 30,
                image: 'https://via.placeholder.com/400x300/8BC34A/FFFFFF?text=Free+Coffee',
                partnerId: greenCoffee?._id,
                priority: 9,
                stock: 100,
                terms: [
                    'Valid at participating locations only',
                    'One voucher per visit',
                    'Cannot be redeemed for cash'
                ],
                redemptionInstructions: 'Show this code to the barista at any participating location',
                estimatedDelivery: 'Instant digital delivery'
            },

            // Products
            {
                name: 'Bamboo Utensil Set',
                description: 'Complete set of reusable bamboo utensils including fork, knife, spoon, and chopsticks. Comes with a convenient carrying case made from organic cotton.',
                category: 'products',
                pointsCost: 75,
                image: 'https://via.placeholder.com/400x300/795548/FFFFFF?text=Bamboo+Utensils',
                partnerId: ecoMart?._id,
                priority: 7,
                stock: 50,
                terms: [
                    'Free shipping included',
                    'Made from sustainable bamboo',
                    '30-day return policy'
                ],
                redemptionInstructions: 'Product will be shipped to your registered address',
                estimatedDelivery: '5-7 business days'
            },
            {
                name: 'Reusable Water Bottle',
                description: 'Premium stainless steel water bottle with double-wall insulation. Keeps drinks cold for 24 hours or hot for 12 hours. BPA-free and dishwasher safe.',
                category: 'products',
                pointsCost: 60,
                image: 'https://via.placeholder.com/400x300/2196F3/FFFFFF?text=Water+Bottle',
                partnerId: ecoMart?._id,
                priority: 8,
                stock: 75,
                terms: [
                    'Available in multiple colors',
                    'Lifetime warranty against defects',
                    'Free shipping included'
                ],
                redemptionInstructions: 'Choose your preferred color during redemption',
                estimatedDelivery: '3-5 business days'
            },
            {
                name: 'Organic Cotton Tote Bag',
                description: 'Stylish and durable tote bag made from 100% organic cotton. Perfect for grocery shopping, beach trips, or everyday use. Machine washable.',
                category: 'products',
                pointsCost: 40,
                image: 'https://via.placeholder.com/400x300/FF9800/FFFFFF?text=Tote+Bag',
                partnerId: ecoMart?._id,
                priority: 6,
                stock: 100,
                terms: [
                    'Made from certified organic cotton',
                    'Machine washable',
                    'Supports fair trade practices'
                ],
                redemptionInstructions: 'Product will be shipped to your registered address',
                estimatedDelivery: '3-5 business days'
            },

            // Donations
            {
                name: 'Plant 5 Trees',
                description: 'Your EcoPoints will fund the planting of 5 trees in deforested areas. Each tree helps combat climate change by absorbing CO2 and supporting local ecosystems.',
                category: 'donations',
                pointsCost: 25,
                image: 'https://via.placeholder.com/400x300/2E7D32/FFFFFF?text=Plant+5+Trees',
                partnerId: earthFoundation?._id,
                priority: 9,
                terms: [
                    'Trees planted within 30 days',
                    'GPS coordinates provided',
                    'Tax receipt available'
                ],
                redemptionInstructions: 'Donation will be processed automatically',
                estimatedDelivery: 'Confirmation within 24 hours'
            },
            {
                name: 'Plant 10 Trees',
                description: 'Fund the planting of 10 trees and make an even bigger impact on the environment. Includes a personalized certificate with the GPS location of your trees.',
                category: 'donations',
                pointsCost: 50,
                image: 'https://via.placeholder.com/400x300/2E7D32/FFFFFF?text=Plant+10+Trees',
                partnerId: earthFoundation?._id,
                priority: 8,
                terms: [
                    'Trees planted within 30 days',
                    'Personalized certificate included',
                    'GPS coordinates and photos provided'
                ],
                redemptionInstructions: 'Certificate will be emailed to you',
                estimatedDelivery: 'Certificate within 48 hours'
            },
            {
                name: 'Ocean Cleanup Donation',
                description: 'Support ocean cleanup efforts by funding the removal of plastic waste from our oceans. Your contribution helps protect marine life and ecosystems.',
                category: 'donations',
                pointsCost: 35,
                image: 'https://via.placeholder.com/400x300/0277BD/FFFFFF?text=Ocean+Cleanup',
                partnerId: earthFoundation?._id,
                priority: 7,
                terms: [
                    'Funds used for ocean cleanup projects',
                    'Impact report provided quarterly',
                    'Tax receipt available'
                ],
                redemptionInstructions: 'Donation will be processed automatically',
                estimatedDelivery: 'Confirmation within 24 hours'
            },

            // Experiences
            {
                name: 'Virtual Eco-Workshop',
                description: 'Join a 2-hour virtual workshop on sustainable living. Learn about composting, energy conservation, and eco-friendly lifestyle tips from environmental experts.',
                category: 'experiences',
                pointsCost: 45,
                image: 'https://via.placeholder.com/400x300/9C27B0/FFFFFF?text=Eco+Workshop',
                priority: 6,
                stock: 20,
                terms: [
                    'Workshop held monthly',
                    'Interactive Q&A session included',
                    'Digital resource pack provided'
                ],
                redemptionInstructions: 'Workshop link will be emailed to you',
                estimatedDelivery: 'Access details within 24 hours'
            }
        ];

        await Reward.insertMany(sampleRewards);
        console.log('✅ Sample rewards initialized');
    } else {
        console.log('ℹ️ Rewards already exist, skipping initialization');
    }
};

const main = async () => {
    try {
        await connectDB();
        await initializePartners();
        await initializeRewards();
        console.log('🎉 Rewards system initialization completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Initialization failed:', error);
        process.exit(1);
    }
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { initializePartners, initializeRewards };