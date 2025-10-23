// AI API route - accepts POST { context, tone, provider? }
// Responds: { reply: "..." }
// Providers: "rulebased" (local), "openai" (server-side proxy). Default provider = process.env.DEFAULT_PROVIDER || 'rulebased'

const express = require('express');
const router = express.Router();

const rulebased = require('../adapters/rulebased');
const openaiAdapter = require('../adapters/openai');

const DEFAULT_PROVIDER = process.env.DEFAULT_PROVIDER || 'rulebased';

// Basic request validator
function validateBody(body) {
  if (!body || typeof body !== 'object') return 'Missing JSON body';
  if (!body.context || typeof body.context !== 'object') return 'Missing "context" object';
  return null;
}

router.post('/', async (req, res, next) => {
  try {
    const err = validateBody(req.body);
    if (err) return res.status(400).json({ error: err });

    const { context = {}, tone = 'friendly', provider } = req.body;
    const selected = provider || DEFAULT_PROVIDER;

    let reply;
    if (selected === 'rulebased') {
      reply = await rulebased.generate(context, tone);
    } else if (selected === 'openai') {
      reply = await openaiAdapter.generate(context, tone);
    } else {
      return res.status(400).json({ error: `Unknown provider: ${selected}` });
    }

    return res.json({ reply });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
