/* THE AGENTCY UK - Admin Console Controller */
const db = require('../db');
const { requireAdminKey } = require('../middleware/authMiddleware');
const config = require('../config');

function getAdminUsers(req, queryParams) {
  requireAdminKey(req, queryParams);

  const users = db.getAllUsers();
  
  const formattedUsers = users.map(user => {
    const questions = db.getUserMessageCount(user.id);
    const handoverRecord = db.getHandover(user.id);

    // Check if there is an active password reset token
    let resetPending = null;
    if (db.isNativeSqlite) {
      const stmt = db.db.prepare(`SELECT * FROM reset_tokens WHERE user_id = ? ORDER BY expires_at DESC LIMIT 1`);
      const tokenRec = stmt.get(user.id);
      if (tokenRec && new Date(tokenRec.expires_at) > new Date()) {
        resetPending = {
          link: `${config.FRONTEND_URL}/account.html?reset_token=${tokenRec.token}`
        };
      }
    } else {
      const tokenRec = db.data.reset_tokens.find(rt => rt.user_id === user.id && new Date(rt.expires_at) > new Date());
      if (tokenRec) {
        resetPending = {
          link: `${config.FRONTEND_URL}/account.html?reset_token=${tokenRec.token}`
        };
      }
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      questions,
      lastActive: user.last_active,
      handover: !!user.handover || !!handoverRecord,
      resetPending
    };
  });

  return { users: formattedUsers };
}

function getAdminConversation(req, queryParams) {
  requireAdminKey(req, queryParams);

  const email = queryParams.get('email');
  if (!email) {
    throw new Error('Consumer email parameter is required.');
  }

  const user = db.getUserByEmail(email);
  if (!user) {
    throw new Error('Consumer not found.');
  }

  const handoverRecord = db.getHandover(user.id);
  const rawMessages = db.getUserMessages(user.id);

  const brief = handoverRecord ? {
    text: handoverRecord.brief_text,
    requested: handoverRecord.requested_at,
    note: handoverRecord.note || ''
  } : null;

  const messages = rawMessages.map(m => ({
    role: m.role,
    content: m.content,
    createdAt: m.created_at
  }));

  return {
    user: {
      name: user.name,
      email: user.email
    },
    brief,
    messages
  };
}

module.exports = {
  getAdminUsers,
  getAdminConversation
};
