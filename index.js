require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Client, LocalAuth } = require('whatsapp-web.js');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const fs = require('fs');
const db = require('./db');

// --- SERVER SETUP ---
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-multi-user';

// --- MIDDLEWARE ---
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json());
app.use(cors());

// --- SOCKET.IO ---
// We need to route socket events to specific users.
// We'll use rooms: socket.join(`user_${userId}`)
const io = new Server(server, { cors: { origin: "*" } });

io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return next(new Error('Authentication error'));
        socket.userId = decoded.id;
        next();
    });
});

io.on('connection', (socket) => {
    const userId = socket.userId;
    socket.join(`user_${userId}`);
    console.log(`User ${userId} connected to socket.`);

    // If client exists, check status
    const session = sessionManager.getSession(userId);
    if (session) {
        if (session.isReady) socket.emit('ready', true);
        // Re-emit QR if pending? 
        // Complex, simplified: User can request QR or Status
    } else {
        // Auto-initialize if not running?
        // sessionManager.startSession(userId); 
        // Better: Wait for user to trigger or auto-start on login
    }
});

// --- SESSION MANAGER (Multi-User Core) ---
class SessionManager {
    constructor() {
        this.sessions = new Map(); // userId -> { client, imap, isReady }
    }

    getSession(userId) {
        return this.sessions.get(userId);
    }

    async startSession(userId) {
        if (this.sessions.has(userId)) return this.sessions.get(userId);

        const emit = (event, data) => io.to(`user_${userId}`).emit(event, data);
        const log = (msg) => emit('log', msg);

        log('Initializing your personal session...');

        // Create Client
        const client = new Client({
            authStrategy: new LocalAuth({ clientId: `user_${userId}` }),
            puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] }
        });

        const sessionData = { client, imap: null, isReady: false };
        this.sessions.set(userId, sessionData);

        client.on('qr', (qr) => {
            emit('qr', qr);
            log('New QR Code generated. Scan to connect.');
        });

        client.on('ready', () => {
            sessionData.isReady = true;
            emit('ready', true);
            log('WhatsApp Connected!');
            this.startEmailListener(userId);
        });

        client.on('auth_failure', msg => log(`Auth failed: ${msg}`));

        client.on('disconnected', () => {
            sessionData.isReady = false;
            emit('ready', false);
            log('WhatsApp Disconnected.');
            // this.sessions.delete(userId); // Optional: keep attempting?
        });

        client.initialize();
        return sessionData;
    }

    async stopSession(userId, clearSession = false) {
        const session = this.sessions.get(userId);
        if (!session) return;

        if (session.imap) {
            try { session.imap.end(); } catch (e) { }
        }

        if (session.client) {
            try { await session.client.destroy(); } catch (e) { }
        }

        if (clearSession) {
            const authPath = path.join(__dirname, '.wwebjs_auth', `session_user_${userId}`);
            try { fs.rmSync(authPath, { recursive: true, force: true }); } catch (e) { }
        }

        this.sessions.delete(userId);
        io.to(`user_${userId}`).emit('ready', false);
        io.to(`user_${userId}`).emit('log', 'Session stopped.');
    }

    startEmailListener(userId) {
        const session = this.sessions.get(userId);
        if (!session || !session.isReady) return;

        const userConfig = db.getUserById(userId);
        if (!userConfig || !userConfig.email_user || !userConfig.email_pass) {
            io.to(`user_${userId}`).emit('log', 'Email not configured. Skipping IMAP.');
            return;
        }

        if (session.imap) { try { session.imap.end(); } catch (e) { } }

        const log = (msg) => io.to(`user_${userId}`).emit('log', msg);

        const imap = new Imap({
            user: userConfig.email_user,
            password: userConfig.email_pass,
            host: userConfig.email_host || 'imap.gmail.com',
            port: userConfig.email_port || 993,
            tls: true,
            tlsOptions: { rejectUnauthorized: false }
        });

        session.imap = imap;

        imap.once('ready', () => {
            log(`IMAP Connected: ${userConfig.email_user}`);
            imap.openBox('INBOX', false, (err) => {
                if (err) return log('Error opening inbox');
                log('Monitoring Inbox...');
                imap.on('mail', () => this.fetchEmails(userId, imap));
            });
        });

        imap.once('error', (err) => {
            log(`IMAP Error: ${err.message}`);
            session.imap = null;
        });

        imap.connect();
    }

    fetchEmails(userId, imap) {
        const session = this.sessions.get(userId);
        const userConfig = db.getUserById(userId);
        const senders = db.getSenders(userId).map(s => s.email);

        if (!senders.length || !userConfig.whatsapp_number) return;

        senders.forEach(sender => {
            imap.search(['UNSEEN', ['FROM', sender]], (err, results) => {
                if (err || !results || !results.length) return;

                const f = imap.fetch(results, { bodies: '', markSeen: true });
                f.on('message', (msg) => {
                    msg.on('body', (stream) => {
                        simpleParser(stream, async (err, mail) => {
                            if (err) return;
                            if (mail.from.value[0].address.toLowerCase() === sender.toLowerCase()) {
                                const notification = `🚀 *Novo Email!* (User: ${userConfig.username})\n\nDe: *${mail.from.text}*\nAssunto: ${mail.subject}\nData: ${new Date().toLocaleString('pt-BR')}`;
                                try {
                                    await session.client.sendMessage(userConfig.whatsapp_number, notification);
                                    io.to(`user_${userId}`).emit('log', `Sent notification to ${userConfig.whatsapp_number}`);
                                } catch (e) { console.error(e); }
                            }
                        });
                    });
                });
            });
        });
    }
}

const sessionManager = new SessionManager();


// --- AUTH ENDPOINTS ---

app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

    try {
        const hash = await bcrypt.hash(password, 10);
        const user = db.createUser(username, hash);
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
        res.json({ token, user: { id: user.id, username: user.username } });

        // Auto-start session
        sessionManager.startSession(user.id);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = db.getUserByUsername(username);

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username } });

    // Auto-start session on login
    sessionManager.startSession(user.id);
});


// --- PROTECTED API ---

const authenticate = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

app.use('/api', authenticate);

// IMPORTANT: Exclude Auth endpoints from middleware above? 
// Express runs middleware sequentially. I should have put /register and /login BEFORE `app.use('/api', authenticate)`
// BUT since they are defined BEFORE, specific routes usually take precedence if defined exactly... 
// actually NO, app.use matches loosely. 
// FIX: Move auth endpoints ABOVE the middleware line or use router.
// SEE BELOW: I will redefine route logic properly.
// The code structure above is linear, so I need to place auth routes BEFORE the middleware.
// Since I wrote them above, check logic order:
// 1. app definition
// 2. /api/register (defined)
// 3. /api/login (defined)
// 4. app.use('/api', authenticate) -- This will only affect routes defined AFTER it?
// Express doesn't work that way for router stack usually, it applies to Request path. 
// BUT `app.post` handlers are tried strictly in order. 
// So /api/register defined FIRST will handle the request and send response, stopping the chain. 
// So the middleware won't be reached for them. Correct.

app.get('/api/me', (req, res) => {
    const user = db.getUserById(req.user.id);
    if (!user) return res.sendStatus(404);
    // Remove password
    delete user.password_hash;
    if (user.email_pass) user.email_pass = '********';
    res.json(user);
});

app.put('/api/me', (req, res) => {
    const user = db.updateUserConfig(req.user.id, req.body);
    // Restart logic if email configured
    sessionManager.startEmailListener(req.user.id);
    res.json(user);
});

app.post('/api/whatsapp/restart', async (req, res) => {
    sessionManager.stopSession(req.user.id, true); // Hard reset
    setTimeout(() => sessionManager.startSession(req.user.id), 2000);
    res.json({ message: 'Restarting session...' });
});

app.post('/api/whatsapp/logout', async (req, res) => {
    sessionManager.stopSession(req.user.id, false);
    res.json({ message: 'Session stopped' });
});

app.get('/api/senders', (req, res) => {
    res.json(db.getSenders(req.user.id));
});

app.post('/api/senders', (req, res) => {
    try {
        const r = db.addSender(req.user.id, req.body.email);
        res.json(r);
    } catch (e) { res.status(400).json({ error: e.message }) }
});

app.delete('/api/senders/:id', (req, res) => {
    db.removeSender(req.user.id, req.params.id);
    res.sendStatus(200);
});


// Serve Frontend
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'frontend/dist')));
    app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'frontend/dist/index.html')));
}

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
