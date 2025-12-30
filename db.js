const Database = require('better-sqlite3');
const db = new Database('database.sqlite');

// Enable Foreign Keys
db.pragma('foreign_keys = ON');

// create users table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    whatsapp_number TEXT,
    email_user TEXT,
    email_pass TEXT,
    email_host TEXT DEFAULT 'imap.gmail.com',
    email_port INTEGER DEFAULT 993,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS senders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, email)
  );
`);

module.exports = {
  // --- User Auth & Config ---
  createUser: (username, password_hash) => {
    try {
      const info = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, password_hash);
      return { id: info.lastInsertRowid, username };
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new Error('Username already exists');
      throw err;
    }
  },

  getUserByUsername: (username) => {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  },

  getUserById: (id) => {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },

  updateUserConfig: (id, data) => {
    const sets = [];
    const values = [];
    for (const key in data) {
      if (data[key] !== undefined) {
        sets.push(`${key} = ?`);
        values.push(data[key]);
      }
    }
    if (sets.length === 0) return db.prepare('SELECT * FROM users WHERE id = ?').get(id);

    values.push(id);
    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },

  // --- Senders ---
  getSenders: (userId) => {
    return db.prepare('SELECT * FROM senders WHERE user_id = ?').all(userId);
  },

  addSender: (userId, email) => {
    try {
      const info = db.prepare('INSERT INTO senders (user_id, email) VALUES (?, ?)').run(userId, email);
      return { id: info.lastInsertRowid, email };
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new Error('Sender already exists for this user');
      throw err;
    }
  },

  removeSender: (userId, senderId) => {
    db.prepare('DELETE FROM senders WHERE id = ? AND user_id = ?').run(senderId, userId);
  }
};
