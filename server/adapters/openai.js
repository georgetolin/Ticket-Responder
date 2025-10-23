// OpenAI adapter (server-side proxy).
// Requires OPENAI_API_KEY in env.
// WARNING: do not commit real secrets. Use .env or secret manager.

const axios = require('axios');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';

if (!OPENAI_API_KEY) {
  console.warn('OPENAI_API_KEY not found in environment; OpenAI adapter will fail until configured.');
}

async function generate(context = {}, tone = 'friendly') {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured on server');

  // Prepare system + user messages to instruct the model to output a complete support reply.
  const system = `You are a helpful customer support assistant. Given context about a support ticket, generate a concise, polite, and professional email reply. Use the tone specified (formal, friendly, apologetic, proactive). Include a short closing with agent name when provided. Do not include markdown or extra commentary.`;

  const userParts = [
    `Tone: ${tone}`,
    `Client name: ${context.client_name || context.clientName || 'Customer'}`,
    `Agent name: ${context.agent_name || context.agentName || 'Support Team'}`,
    `Ticket number: ${context.ticket_number || context.ticketNumber || ''}`,
    `Issue summary: ${context.issue_summary || context.issueSummary || ''}`
  ];

  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: userParts.join('\n') }
  ];

  const resp = await axios.post('https://api.openai.com/v1/chat/completions', {
    model: OPENAI_MODEL,
    messages,
    temperature: 0.2,
    max_tokens: 500
  }, {
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    timeout: 20000
  });

  const choice = resp.data?.choices && resp.data.choices[0];
  if (!choice) throw new Error('No response from OpenAI');
  return (choice.message && choice.message.content) || String(choice);
}

module.exports = { generate };
