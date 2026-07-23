const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const db = require('./db');
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');

const app = express();

// Derrière le proxy nginx / l'Ingress : fait confiance au premier X-Forwarded-For
// pour que le rate-limiter voie la vraie IP client
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
// Limite la taille du body : protège contre les payloads abusifs
app.use(express.json({ limit: '10kb' }));

// Anti brute-force sur les endpoints d'authentification
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Trop de tentatives, réessayez dans quelques minutes' }
});

// Probes Kubernetes : liveness (process vivant) et readiness (DB joignable)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});
app.get('/api/health/ready', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'unavailable' });
  }
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/tasks', taskRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route introuvable' });
});

// Gestionnaire d'erreurs : log serveur complet, message générique côté client
// (ne jamais exposer stack trace ou détails internes)
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

module.exports = app;
