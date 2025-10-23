// Express entrypoint - mounts /api/ai and provides basic security & rate limiting
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const rateLimiter = require('./middleware/rateLimiter');
const aiRouter = require('./routes/ai');

const app = express();

// Basic security & parsing
app.use(helmet());
app.use(express.json({ limit: '256kb' }));

// CORS - allow your frontend origin in production; '*' for quick local dev
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: CORS_ORIGIN }));

// Rate limiting to protect provider usage
app.use(rateLimiter);

// Mount API
app.use('/api/ai', aiRouter);

// Health
app.get('/healthz', (req, res) => res.json({ ok: true, env: process.env.NODE_ENV || 'development' }));

// Error handler (simple)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'server error' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`AI proxy server listening on port ${PORT} (CORS_ORIGIN=${CORS_ORIGIN})`);
});
