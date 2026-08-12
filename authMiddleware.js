/* THE AGENTCY UK - Authentication & Authorization Middleware */
const config = require('../config');
const { verifyJwt } = require('../utils/cryptoUtils');
const db = require('../db');

function requireAuth(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized: Missing or invalid token');
  }

  const token = authHeader.substring(7).trim();
  const decoded = verifyJwt(token);
  if (!decoded || !decoded.userId) {
    throw new Error('Unauthorized: Invalid or expired token');
  }

  const user = db.getUserById(decoded.userId);
  if (!user) {
    throw new Error('Unauthorized: User not found');
  }

  return user;
}

function requireAdminKey(req, queryParams) {
  const keyInQuery = queryParams ? queryParams.get('key') : null;
  const keyInHeader = req.headers['x-admin-key'] || req.headers['X-Admin-Key'] || null;
  const providedKey = keyInQuery || keyInHeader;

  if (!providedKey || providedKey.trim() !== config.ADMIN_KEY.trim()) {
    throw new Error('Unauthorized: Invalid admin key');
  }
  return true;
}

module.exports = {
  requireAuth,
  requireAdminKey
};
