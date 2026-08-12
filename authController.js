/* THE AGENTCY UK - Authentication Controller */
const db = require('../db');
const { hashPassword, verifyPassword, signJwt, generateRandomToken } = require('../utils/cryptoUtils');
const config = require('../config');

function handleSignup(body) {
  const { email, password, name } = body || {};

  if (!email || !email.includes('@')) {
    throw new Error('Please provide a valid email address.');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  const existing = db.getUserByEmail(email);
  if (existing) {
    throw new Error('An account with this email address already exists.');
  }

  const displayName = (name && name.trim()) ? name.trim() : email.split('@')[0];
  const { hash, salt } = hashPassword(password);
  
  const user = db.createUser({
    name: displayName,
    email: email.toLowerCase().trim(),
    password_hash: hash,
    salt
  });

  const token = signJwt({ userId: user.id, email: user.email });
  return { token, name: user.name };
}

function handleLogin(body) {
  const { email, password } = body || {};

  if (!email || !password) {
    throw new Error('Please enter both your email and password.');
  }

  const user = db.getUserByEmail(email);
  if (!user) {
    throw new Error('Invalid email or password.');
  }

  const isValid = verifyPassword(password, user.password_hash, user.salt);
  if (!isValid) {
    throw new Error('Invalid email or password.');
  }

  db.touchUserActive(user.id);
  const token = signJwt({ userId: user.id, email: user.email });
  return { token, name: user.name };
}

function handleForgot(body) {
  const { email } = body || {};
  if (!email || !email.includes('@')) {
    throw new Error('Please provide a valid email address.');
  }

  const user = db.getUserByEmail(email);
  if (!user) {
    // Return success to avoid email enumeration
    return { success: true, message: 'If an account exists, a reset link was generated.' };
  }

  const resetToken = generateRandomToken(24);
  db.createResetToken(user.id, resetToken, 30);

  const resetLink = `${config.FRONTEND_URL}/account.html?reset_token=${resetToken}`;
  return {
    success: true,
    message: 'If an account exists, a reset link was generated.',
    link: resetLink
  };
}

function handleReset(body) {
  const { token, newPassword } = body || {};
  if (!token || !newPassword || newPassword.length < 6) {
    throw new Error('Invalid reset token or password too short.');
  }

  const record = db.getResetToken(token);
  if (!record) {
    throw new Error('Invalid or expired password reset link.');
  }

  if (new Date(record.expires_at) < new Date()) {
    db.deleteResetToken(token);
    throw new Error('This password reset link has expired.');
  }

  const { hash, salt } = hashPassword(newPassword);
  db.updateUserPassword(record.user_id, hash, salt);
  db.deleteResetToken(token);

  return { success: true, message: 'Password has been successfully reset.' };
}

module.exports = {
  handleSignup,
  handleLogin,
  handleForgot,
  handleReset
};
