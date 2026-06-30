require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const flash = require('connect-flash');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');

const { getDb, saveNow } = require('./db/database');

const app = express();
const server = http.createServer(app);

// WebSocket server for real-time orders
const wss = new WebSocketServer({ server, path: '/ws/orders' });

wss.on('connection', (ws) => {
  console.log('Admin WebSocket connected');
  ws.on('close', () => console.log('Admin WebSocket disconnected'));
});

function broadcastOrder(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(data));
    }
  });
}

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Security
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'stella-bistro-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
  },
}));

// Flash messages
app.use(flash());

app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.session = req.session;
  next();
});

// Rate limiting
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
});

const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many orders, please try again later.' },
});

app.use('/api/', publicLimiter);
app.use('/api/orders', orderLimiter);

// Initialize DB
let dbReady = false;
app.use(async (req, res, next) => {
  if (!dbReady) {
    try {
      await getDb();
      dbReady = true;
      console.log('Database initialized');
    } catch (e) {
      console.error('DB init error:', e);
    }
  }
  next();
});

// Make broadcastOrder available to routes
app.use((req, res, next) => {
  req.broadcastOrder = broadcastOrder;
  next();
});

// Make broadcastOrder available via module reference for routes that need it
app.broadcastOrder = broadcastOrder;

// Routes
const publicRoutes = require('./routes/public');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');

app.use('/', publicRoutes);
app.use('/api', apiRoutes);
app.use('/stella-control', adminRoutes);

// 404 handler
app.use((req, res) => {
  if (req.path.startsWith('/stella-control')) {
    return res.status(404).render('admin/login', { pageTitle: 'Login', error_msg: ['Page not found'] });
  }
  res.status(404).render('NotFound', { pageTitle: '404 - Not Found', settings: {} });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Stella Bistro running on http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/stella-control`);
});

// Graceful shutdown: persist database before exit
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  saveNow();
  process.exit(0);
});
process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  saveNow();
  process.exit(0);
});

module.exports = { app, server, broadcastOrder };
