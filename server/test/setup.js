import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongod;

// Setup in-memory MongoDB before all tests
beforeAll(async () => {
    // Close any existing connections first
    if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
    }

    // Start in-memory MongoDB instance
    mongod = await MongoMemoryServer.create({
        instance: {
            port: 27017, // Use default port for compatibility
            dbName: 'ecocycle_test'
        }
    });
    
    const uri = mongod.getUri();
    
    // Connect mongoose to the in-memory database
    await mongoose.connect(uri);
}, 30000);

// Cleanup after all tests
afterAll(async () => {
    // Close mongoose connection
    await mongoose.connection.close();
    
    // Stop in-memory MongoDB instance
    if (mongod) {
        await mongod.stop();
    }
}, 30000);

// Clear all collections before each test
beforeEach(async () => {
    const collections = mongoose.connection.collections;
    
    for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany({});
    }
});