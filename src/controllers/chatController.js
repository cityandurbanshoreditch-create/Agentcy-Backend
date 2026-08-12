/* THE AGENTCY UK - Chat & User Controller */
const db = require('../db');
const { requireAuth } = require('../middleware/authMiddleware');
const { generateResponse, generateHandoverBrief, routeQuery } = require('../services/aiService');

function getMe(req) {
  const user = requireAuth(req);
  const msgCount = db.getUserMessageCount(user.id);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    msgCount,
    handover: !!user.handover
  };
}

function getHistory(req) {
  const user = requireAuth(req);
  const messages = db.getUserMessages(user.id);
  return {
    messages: messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      specialist: m.specialist,
      createdAt: m.created_at
    }))
  };
}

async function handleAnonChat(body) {
  const message = (body && body.message) ? String(body.message).trim() : '';
  if (!message) {
    throw new Error('Message content is required.');
  }

  // Generate AI response
  const reply = await generateResponse(message, []);
  
  // Log message for analytics/audit
  const specialistKey = routeQuery(message);
  db.addMessage({ user_id: null, role: 'user', content: message });
  db.addMessage({ user_id: null, role: 'assistant', content: reply, specialist: specialistKey });

  return { reply };
}

async function handleUserChat(req, body) {
  const user = requireAuth(req);
  const message = (body && body.message) ? String(body.message).trim() : '';
  if (!message) {
    throw new Error('Message content is required.');
  }

  // Get past user history for context
  const pastMsgs = db.getUserMessages(user.id);
  
  // Save user message
  db.addMessage({ user_id: user.id, role: 'user', content: message });

  // Generate AI response
  const reply = await generateResponse(message, pastMsgs);

  // Save assistant message
  const specialistKey = routeQuery(message);
  db.addMessage({ user_id: user.id, role: 'assistant', content: reply, specialist: specialistKey });

  return { reply };
}

async function handleHandover(req, body) {
  const user = requireAuth(req);
  const note = (body && body.note) ? String(body.note).trim() : '';

  const messages = db.getUserMessages(user.id);
  const briefText = generateHandoverBrief(user, messages, note);

  db.saveHandover({
    user_id: user.id,
    brief_text: briefText,
    note
  });

  return { success: true, message: 'Human handover requested successfully.' };
}

module.exports = {
  getMe,
  getHistory,
  handleAnonChat,
  handleUserChat,
  handleHandover
};
