import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = 'http://localhost:5000';

async function testAdminAPI() {
    try {
        console.log('🔐 Step 1: Login as admin...\n');
        
        // Login
        const loginRes = await axios.post(`${API_URL}/api/auth/login`, {
            email: 'admin@example.com',
            password: 'admin123'
        });
        
        if (!loginRes.data.success) {
            console.log('❌ Login failed');
            return;
        }
        
        const token = loginRes.data.data.token;
        console.log('✅ Login successful!');
        console.log(`   Token: ${token.substring(0, 20)}...`);
        console.log(`   User: ${loginRes.data.data.name} (${loginRes.data.data.role})\n`);
        
        // Test 1: Get all users
        console.log('👥 Step 2: Fetching all users...\n');
        try {
            const usersRes = await axios.get(`${API_URL}/api/users/all`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            
            console.log('✅ Users API Response:');
            console.log(`   Status: ${usersRes.status}`);
            console.log(`   Data structure:`, Object.keys(usersRes.data));
            
            if (usersRes.data.users) {
                console.log(`   Total users: ${usersRes.data.users.length}`);
                console.log(`   First 3 users:`);
                usersRes.data.users.slice(0, 3).forEach((u, i) => {
                    console.log(`     ${i + 1}. ${u.name} (${u.email}) - ${u.role}`);
                });
            } else if (Array.isArray(usersRes.data)) {
                console.log(`   Total users: ${usersRes.data.length}`);
                console.log(`   First 3 users:`);
                usersRes.data.slice(0, 3).forEach((u, i) => {
                    console.log(`     ${i + 1}. ${u.name} (${u.email}) - ${u.role}`);
                });
            }
        } catch (error) {
            console.log('❌ Users API Error:', error.response?.data || error.message);
        }
        
        console.log('\n♻️  Step 3: Fetching waste data...\n');
        try {
            const wasteRes = await axios.get(`${API_URL}/api/waste/all`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            
            console.log('✅ Waste API Response:');
            console.log(`   Status: ${wasteRes.status}`);
            console.log(`   Data structure:`, Object.keys(wasteRes.data));
            
            if (Array.isArray(wasteRes.data)) {
                console.log(`   Total waste entries: ${wasteRes.data.length}`);
                console.log(`   First 3 entries:`);
                wasteRes.data.slice(0, 3).forEach((w, i) => {
                    console.log(`     ${i + 1}. ${w.material} - ${w.weight}kg - ${w.status}`);
                });
            } else if (wasteRes.data.data) {
                console.log(`   Total waste entries: ${wasteRes.data.data.wasteLogs?.length || 0}`);
            }
        } catch (error) {
            console.log('❌ Waste API Error:', error.response?.data || error.message);
        }
        
        console.log('\n📊 Step 4: Fetching analytics...\n');
        try {
            const analyticsRes = await axios.get(`${API_URL}/api/analytics/waste-stats`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            
            console.log('✅ Analytics API Response:');
            console.log(`   Status: ${analyticsRes.status}`);
            console.log(`   Global Total: ${analyticsRes.data.globalTotal} kg`);
            console.log(`   Total Requests: ${analyticsRes.data.totalRequests}`);
            console.log(`   Area Stats: ${analyticsRes.data.areaStats?.length || 0} areas`);
        } catch (error) {
            console.log('❌ Analytics API Error:', error.response?.data || error.message);
        }
        
        console.log('\n✅ All API tests completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('   Response:', error.response.data);
        }
    }
}

testAdminAPI();
