// Server-side deterministic reply generator (safe fallback)
// Mirrors client-side rule-based logic.

function detectIssueType(summary = '') {
  const s = (summary || '').toLowerCase();
  if (!s) return 'unknown';
  if (/(login|sign in|signin|account locked|locked)/.test(s)) return 'login';
  if (/(password|reset password|forgot password)/.test(s)) return 'password';
  if (/(billing|invoice|charge|payment|refund)/.test(s)) return 'billing';
  if (/(slow|lag|performance|timeout)/.test(s)) return 'performance';
  if (/(error|unexpected|bug|crash)/.test(s)) return 'error';
  return 'general';
}

async function generate(context = {}, tone = 'friendly') {
  const ctx = {
    client_name: context.client_name || context.clientName || '',
    agent_name: context.agent_name || context.agentName || 'Support Team',
    issue_summary: context.issue_summary || context.issueSummary || '',
    ticket_number: context.ticket_number || context.ticketNumber || ''
  };

  const type = detectIssueType(ctx.issue_summary);
  let base = '';

  switch (type) {
    case 'login':
      base = `Hi ${ctx.client_name || 'there'},\n\nThanks for letting us know you’re having trouble signing in. Please try resetting your password using the “Forgot password” link. If you still can’t access your account, reply and we will initiate a manual reset.`;
      break;
    case 'password':
      base = `Hi ${ctx.client_name || 'there'},\n\nWe can help with the password reset. I have initiated a reset link to the email associated with your account. Please follow the instructions to complete the update.`;
      break;
    case 'billing':
      base = `Hi ${ctx.client_name || 'there'},\n\nThanks for raising this billing concern. I’ve forwarded the details to our billing team for review. We will follow up with an update or any required refund on this ticket.`;
      break;
    case 'performance':
      base = `Hi ${ctx.client_name || 'there'},\n\nI’m sorry you experienced slowness. Could you share the time, affected page, and any error messages? This helps us reproduce and fix the issue quickly.`;
      break;
    case 'error':
      base = `Hi ${ctx.client_name || 'there'},\n\nThank you for reporting this error. Could you provide a screenshot and the steps to reproduce it? We’ll investigate right away.`;
      break;
    default:
      base = `Hi ${ctx.client_name || 'there'},\n\nThanks for contacting us about ${ctx.issue_summary || 'this matter'}. We’re looking into it and will get back to you with next steps.`;
  }

  let toneSuffix = '';
  switch (tone) {
    case 'formal':
      toneSuffix = `\n\nWe appreciate your patience.\n\nBest regards,\n${ctx.agent_name}`;
      break;
    case 'friendly':
      toneSuffix = `\n\nNo worries — we’ll get this sorted quickly for you.\n\nWarm regards,\n${ctx.agent_name}`;
      break;
    case 'apologetic':
      toneSuffix = `\n\nWe sincerely apologize for any inconvenience this may have caused and appreciate your patience.\n\nKind regards,\n${ctx.agent_name}`;
      break;
    case 'proactive':
      toneSuffix = `\n\nWe’ve already started looking into this and will follow up shortly with an update.\n\nBest regards,\n${ctx.agent_name}`;
      break;
    default:
      toneSuffix = `\n\nBest regards,\n${ctx.agent_name}`;
  }

  const ticketLine = ctx.ticket_number ? `\nTicket: ${ctx.ticket_number}` : '';
  const currentDate = `\nDate: ${new Date().toLocaleDateString()}`;

  return `${base}${toneSuffix}${ticketLine}${currentDate}`;
}

module.exports = { generate };
