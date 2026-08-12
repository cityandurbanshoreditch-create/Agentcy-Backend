/* THE AGENTCY UK - Main Server */
const http = require('http');
const { URL } = require('url');
const config = require('./config');
const authController = require('./controllers/authController');
const chatController = require('./controllers/chatController');
const adminController = require('./controllers/adminController');

// CORS Headers Helper
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
}

// JSON Response Helper
function sendJson(res, statusCode, data) {
  setCorsHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Error Response Helper
function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

// Helper to parse JSON request body
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 1e6) { // 1MB limit
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

// Request Handler
const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname.replace(/\/+$/, '') || '/';
  const method = req.method.toUpperCase();

  try {
    // --- Health Check / Welcome ---
    if ((pathname === '/' || pathname === '/health') && method === 'GET') {
      return sendJson(res, 200, {
        status: 'online',
        service: 'The Agentcy UK Backend API',
        version: '1.0.0',
        timestamp: new Date().toISOString()
      });
    }

    // --- Authentication Routes ---
    if (pathname === '/auth/signup' && method === 'POST') {
      const body = await parseJsonBody(req);
      const data = authController.handleSignup(body);
      return sendJson(res, 200, data);
    }

    if (pathname === '/auth/login' && method === 'POST') {
      const body = await parseJsonBody(req);
      const data = authController.handleLogin(body);
      return sendJson(res, 200, data);
    }

    if (pathname === '/auth/forgot' && method === 'POST') {
      const body = await parseJsonBody(req);
      const data = authController.handleForgot(body);
      return sendJson(res, 200, data);
    }

    if (pathname === '/auth/reset' && method === 'POST') {
      const body = await parseJsonBody(req);
      const data = authController.handleReset(body);
      return sendJson(res, 200, data);
    }

    // --- User & History Routes ---
    if (pathname === '/me' && method === 'GET') {
      const data = chatController.getMe(req);
      return sendJson(res, 200, data);
    }

    if (pathname === '/history' && method === 'GET') {
      const data = chatController.getHistory(req);
      return sendJson(res, 200, data);
    }

    // --- Chat Routes ---
    if (pathname === '/chat/anon' && method === 'POST') {
      const body = await parseJsonBody(req);
      const data = await chatController.handleAnonChat(body);
      return sendJson(res, 200, data);
    }

    if (pathname === '/chat' && method === 'POST') {
      const body = await parseJsonBody(req);
      const data = await chatController.handleUserChat(req, body);
      return sendJson(res, 200, data);
    }

    if (pathname === '/handover' && method === 'POST') {
      const body = await parseJsonBody(req);
      const data = await chatController.handleHandover(req, body);
      return sendJson(res, 200, data);
    }

    // --- Admin Routes ---
    if (pathname === '/admin/users' && method === 'GET') {
      const data = adminController.getAdminUsers(req, parsedUrl.searchParams);
      return sendJson(res, 200, data);
    }

    if (pathname === '/admin/conversation' && method === 'GET') {
      const data = adminController.getAdminConversation(req, parsedUrl.searchParams);
      return sendJson(res, 200, data);
    }

    // 404 Route Not Found
    return sendError(res, 404, `Route ${method} ${pathname} not found`);

  } catch (err) {
    const isUnauthorized = err.message.startsWith('Unauthorized');
    const statusCode = isUnauthorized ? 401 : 400;
    return sendError(res, statusCode, err.message);
  }
});

server.listen(config.PORT, () => {
  console.log(`===================================================`);
  console.log(`  The Agentcy UK Backend is running successfully!`);
  console.log(`  Local URL: http://localhost:${config.PORT}`);
  console.log(`  Admin Secret Key: ${config.ADMIN_KEY}`);
  console.log(`===================================================`);
});
