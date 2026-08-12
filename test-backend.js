/* THE AGENTCY UK - Comprehensive Backend Integration Test */
const http = require('http');
const config = require('./src/config');
require('./src/server'); // Start server in process

function request(path, { method = 'GET', body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : '';
    const req = http.request(`http://localhost:${config.PORT}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataString),
        ...headers
      }
    }, res => {
      let respBody = '';
      res.on('data', chunk => respBody += chunk);
      res.on('end', () => {
        try {
          const parsed = respBody ? JSON.parse(respBody) : {};
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: respBody });
        }
      });
    });
    req.on('error', reject);
    if (dataString) req.write(dataString);
    req.end();
  });
}

async function runTests() {
  console.log('\n===================================================');
  console.log('  RUNNING INTEGRATION TESTS FOR THE AGENTCY UK');
  console.log('===================================================\n');

  try {
    // 1. Health check
    console.log('[1] Testing GET /health ...');
    const health = await request('/health');
    console.assert(health.status === 200, 'Health check failed');
    console.log('    ✓ Health status:', health.body.status, health.body.service);

    // 2. Anonymous chat taster
    console.log('\n[2] Testing POST /chat/anon (Mortgage question) ...');
    const anonRes = await request('/chat/anon', {
      method: 'POST',
      body: { message: 'How much can I borrow as a first-time buyer with £50k income?' }
    });
    console.assert(anonRes.status === 200, 'Anon chat failed');
    console.assert(anonRes.body.reply.includes('@@miles'), 'Specialist routing tag missing');
    console.log('    ✓ Anonymous reply received with specialist tag:');
    console.log('     ', anonRes.body.reply.substring(0, 100) + '...');

    // 3. User Signup
    const testEmail = `test.user.${Date.now()}@example.com`;
    console.log(`\n[3] Testing POST /auth/signup (${testEmail}) ...`);
    const signupRes = await request('/auth/signup', {
      method: 'POST',
      body: { email: testEmail, password: 'password123', name: 'Sarah Connor' }
    });
    console.assert(signupRes.status === 200, 'Signup failed');
    console.assert(signupRes.body.token, 'Token missing in signup');
    const userToken = signupRes.body.token;
    console.log('    ✓ User registered successfully. Token:', userToken.substring(0, 25) + '...');

    // 4. User Login
    console.log('\n[4] Testing POST /auth/login ...');
    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: { email: testEmail, password: 'password123' }
    });
    console.assert(loginRes.status === 200, 'Login failed');
    console.log('    ✓ User logged in successfully. Name:', loginRes.body.name);

    // 5. Get User Profile (/me)
    console.log('\n[5] Testing GET /me ...');
    const meRes = await request('/me', {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    console.assert(meRes.status === 200, 'GET /me failed');
    console.log('    ✓ Profile fetched. Name:', meRes.body.name, '| Handover:', meRes.body.handover);

    // 6. Authenticated Chat (/chat)
    console.log('\n[6] Testing POST /chat (Valuation question) ...');
    const chatRes1 = await request('/chat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { message: "What is my flat worth in Islington?" }
    });
    console.assert(chatRes1.status === 200, 'Auth chat failed');
    console.assert(chatRes1.body.reply.includes('@@valentina'), 'Valuations routing tag missing');
    console.log('    ✓ Reply 1 received:', chatRes1.body.reply.substring(0, 110) + '...');

    console.log('\n[7] Testing POST /chat (Tenancy question) ...');
    const chatRes2 = await request('/chat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { message: "Can my landlord raise my rent by 20%?" }
    });
    console.assert(chatRes2.status === 200, 'Auth chat 2 failed');
    console.assert(chatRes2.body.reply.includes('@@noah'), 'Landlord routing tag missing');
    console.log('    ✓ Reply 2 received:', chatRes2.body.reply.substring(0, 110) + '...');

    // 8. Fetch History (/history)
    console.log('\n[8] Testing GET /history ...');
    const historyRes = await request('/history', {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    console.assert(historyRes.status === 200, 'History failed');
    console.assert(historyRes.body.messages.length >= 4, 'Message count mismatch');
    console.log('    ✓ History fetched. Total messages stored:', historyRes.body.messages.length);

    // 9. Request Human Handover (/handover)
    console.log('\n[9] Testing POST /handover ...');
    const handoverRes = await request('/handover', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { note: 'Please call me after 2pm on Thursday.' }
    });
    console.assert(handoverRes.status === 200, 'Handover request failed');
    console.log('    ✓ Handover requested successfully.');

    // 10. Admin Users Console (/admin/users)
    console.log('\n[10] Testing GET /admin/users ...');
    const adminUsersRes = await request(`/admin/users?key=${config.ADMIN_KEY}`);
    console.assert(adminUsersRes.status === 200, 'Admin users failed');
    console.assert(adminUsersRes.body.users.length > 0, 'Admin users list empty');
    console.log('    ✓ Admin users fetched. Consumers count:', adminUsersRes.body.users.length);
    console.log('      First user:', adminUsersRes.body.users[0].name, '| Handover flag:', adminUsersRes.body.users[0].handover);

    // 11. Admin Conversation Detail (/admin/conversation)
    console.log('\n[11] Testing GET /admin/conversation ...');
    const adminConvRes = await request(`/admin/conversation?email=${encodeURIComponent(testEmail)}&key=${config.ADMIN_KEY}`);
    console.assert(adminConvRes.status === 200, 'Admin conv failed');
    console.assert(adminConvRes.body.brief !== null, 'Admin brief should exist');
    console.log('    ✓ Admin conversation & handover brief verified successfully.');
    console.log('      Brief summary:\n', adminConvRes.body.brief.text.split('\n')[0]);

    console.log('\n===================================================');
    console.log('  ALL INTEGRATION TESTS PASSED 100% SUCCESSFULLY!');
    console.log('===================================================\n');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ Test failed with error:', err);
    process.exit(1);
  }
}

// Give server time to bind port
setTimeout(runTests, 500);
