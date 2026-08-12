/* THE AGENTCY UK - SQLite Database Layer */
const { DB_PATH } = require('../config');
const path = require('path');
const fs = require('fs');

let dbModule;
try {
  dbModule = require('node:sqlite');
} catch (e) {
  try {
    dbModule = require('sqlite3');
  } catch (err) {
    dbModule = null;
  }
}

class DatabaseWrapper {
  constructor(filePath) {
    this.filePath = filePath;
    this.isNativeSqlite = false;
    
    // Ensure dir exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (dbModule && dbModule.DatabaseSync) {
      this.db = new dbModule.DatabaseSync(filePath);
      this.isNativeSqlite = true;
    } else {
      // Fallback JSON-backed SQLite emulator if node:sqlite isn't available
      this.useJsonStorage = true;
      this.jsonPath = filePath + '.json';
      this.data = this.loadJson();
    }

    this.initTables();
  }

  loadJson() {
    if (fs.existsSync(this.jsonPath)) {
      try {
        return JSON.parse(fs.readFileSync(this.jsonPath, 'utf8'));
      } catch (e) {}
    }
    return { users: [], messages: [], handovers: [], reset_tokens: [] };
  }

  saveJson() {
    fs.writeFileSync(this.jsonPath, JSON.stringify(this.data, null, 2), 'utf8');
  }

  initTables() {
    if (this.isNativeSqlite) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          salt TEXT NOT NULL,
          handover INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_active DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          specialist TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS handovers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER UNIQUE NOT NULL,
          brief_text TEXT NOT NULL,
          note TEXT DEFAULT '',
          requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS reset_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          token TEXT UNIQUE NOT NULL,
          expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
      `);
    }
  }

  // --- User Operations ---
  createUser({ name, email, password_hash, salt }) {
    const now = new Date().toISOString();
    if (this.isNativeSqlite) {
      const stmt = this.db.prepare(
        `INSERT INTO users (name, email, password_hash, salt, created_at, last_active) VALUES (?, ?, ?, ?, ?, ?)`
      );
      const res = stmt.run(name, email.toLowerCase(), password_hash, salt, now, now);
      return this.getUserById(res.lastInsertRowid);
    } else {
      if (this.data.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        throw new Error('UNIQUE constraint failed: users.email');
      }
      const user = {
        id: Number(this.data.users.length + 1),
        name,
        email: email.toLowerCase(),
        password_hash,
        salt,
        handover: 0,
        created_at: now,
        last_active: now
      };
      this.data.users.push(user);
      this.saveJson();
      return user;
    }
  }

  getUserByEmail(email) {
    if (!email) return null;
    if (this.isNativeSqlite) {
      const stmt = this.db.prepare(`SELECT * FROM users WHERE LOWER(email) = LOWER(?)`);
      return stmt.get(email.toLowerCase()) || null;
    } else {
      return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
    }
  }

  getUserById(id) {
    if (this.isNativeSqlite) {
      const stmt = this.db.prepare(`SELECT * FROM users WHERE id = ?`);
      return stmt.get(Number(id)) || null;
    } else {
      return this.data.users.find(u => u.id === Number(id)) || null;
    }
  }

  touchUserActive(id) {
    const now = new Date().toISOString();
    if (this.isNativeSqlite) {
      this.db.prepare(`UPDATE users SET last_active = ? WHERE id = ?`).run(now, Number(id));
    } else {
      const user = this.getUserById(id);
      if (user) { user.last_active = now; this.saveJson(); }
    }
  }

  setUserHandover(id, flag = 1) {
    if (this.isNativeSqlite) {
      this.db.prepare(`UPDATE users SET handover = ? WHERE id = ?`).run(flag, Number(id));
    } else {
      const user = this.getUserById(id);
      if (user) { user.handover = flag; this.saveJson(); }
    }
  }

  updateUserPassword(id, password_hash, salt) {
    if (this.isNativeSqlite) {
      this.db.prepare(`UPDATE users SET password_hash = ?, salt = ? WHERE id = ?`).run(password_hash, salt, Number(id));
    } else {
      const user = this.getUserById(id);
      if (user) {
        user.password_hash = password_hash;
        user.salt = salt;
        this.saveJson();
      }
    }
  }

  getAllUsers() {
    if (this.isNativeSqlite) {
      return this.db.prepare(`SELECT * FROM users ORDER BY handover DESC, last_active DESC`).all();
    } else {
      return [...this.data.users].sort((a, b) => (b.handover - a.handover) || (new Date(b.last_active) - new Date(a.last_active)));
    }
  }

  // --- Message Operations ---
  addMessage({ user_id, role, content, specialist }) {
    const now = new Date().toISOString();
    const targetUserId = user_id ? Number(user_id) : null;
    if (this.isNativeSqlite) {
      const stmt = this.db.prepare(
        `INSERT INTO messages (user_id, role, content, specialist, created_at) VALUES (?, ?, ?, ?, ?)`
      );
      const res = stmt.run(targetUserId, role, content, specialist || null, now);
      if (targetUserId) this.touchUserActive(targetUserId);
      return { id: Number(res.lastInsertRowid), user_id: targetUserId, role, content, specialist, created_at: now };
    } else {
      const msg = {
        id: this.data.messages.length + 1,
        user_id: targetUserId,
        role,
        content,
        specialist: specialist || null,
        created_at: now
      };
      this.data.messages.push(msg);
      if (targetUserId) this.touchUserActive(targetUserId);
      this.saveJson();
      return msg;
    }
  }

  getUserMessages(user_id) {
    const targetUserId = Number(user_id);
    if (this.isNativeSqlite) {
      return this.db.prepare(`SELECT * FROM messages WHERE user_id = ? ORDER BY created_at ASC`).all(targetUserId);
    } else {
      return this.data.messages.filter(m => m.user_id === targetUserId).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }
  }

  getUserMessageCount(user_id) {
    const targetUserId = Number(user_id);
    if (this.isNativeSqlite) {
      const res = this.db.prepare(`SELECT COUNT(*) as count FROM messages WHERE user_id = ? AND role = 'user'`).get(targetUserId);
      return res ? res.count : 0;
    } else {
      return this.data.messages.filter(m => m.user_id === targetUserId && m.role === 'user').length;
    }
  }

  // --- Handover Operations ---
  saveHandover({ user_id, brief_text, note }) {
    const now = new Date().toISOString();
    const targetUserId = Number(user_id);
    this.setUserHandover(targetUserId, 1);
    if (this.isNativeSqlite) {
      this.db.prepare(`DELETE FROM handovers WHERE user_id = ?`).run(targetUserId);
      const stmt = this.db.prepare(
        `INSERT INTO handovers (user_id, brief_text, note, requested_at) VALUES (?, ?, ?, ?)`
      );
      stmt.run(targetUserId, brief_text, note || '', now);
    } else {
      this.data.handovers = this.data.handovers.filter(h => h.user_id !== targetUserId);
      this.data.handovers.push({
        id: this.data.handovers.length + 1,
        user_id: targetUserId,
        brief_text,
        note: note || '',
        requested_at: now
      });
      this.saveJson();
    }
  }

  getHandover(user_id) {
    const targetUserId = Number(user_id);
    if (this.isNativeSqlite) {
      return this.db.prepare(`SELECT * FROM handovers WHERE user_id = ?`).get(targetUserId) || null;
    } else {
      return this.data.handovers.find(h => h.user_id === targetUserId) || null;
    }
  }

  // --- Reset Tokens ---
  createResetToken(user_id, token, expiresMinutes = 30) {
    const now = new Date();
    const targetUserId = Number(user_id);
    const expiresAt = new Date(now.getTime() + expiresMinutes * 60 * 1000).toISOString();
    if (this.isNativeSqlite) {
      this.db.prepare(`DELETE FROM reset_tokens WHERE user_id = ?`).run(targetUserId);
      this.db.prepare(`INSERT INTO reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)`).run(targetUserId, token, expiresAt);
    } else {
      this.data.reset_tokens = this.data.reset_tokens.filter(rt => rt.user_id !== targetUserId);
      this.data.reset_tokens.push({
        id: this.data.reset_tokens.length + 1,
        user_id: targetUserId,
        token,
        expires_at: expiresAt,
        created_at: now.toISOString()
      });
      this.saveJson();
    }
    return { token, expiresAt };
  }

  getResetToken(token) {
    if (this.isNativeSqlite) {
      return this.db.prepare(`SELECT * FROM reset_tokens WHERE token = ?`).get(token) || null;
    } else {
      return this.data.reset_tokens.find(rt => rt.token === token) || null;
    }
  }

  deleteResetToken(token) {
    if (this.isNativeSqlite) {
      this.db.prepare(`DELETE FROM reset_tokens WHERE token = ?`).run(token);
    } else {
      this.data.reset_tokens = this.data.reset_tokens.filter(rt => rt.token !== token);
      this.saveJson();
    }
  }
}

const db = new DatabaseWrapper(DB_PATH);
module.exports = db;
