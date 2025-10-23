// Example patch: replace direct generateSmartReply(...) usage with ai-adapters
import ai from './src/ai-adapters/index.js';

// When user clicks Generate Suggestion:
document.getElementById('generateSuggestion').addEventListener('click', async () => {
  const context = {
    client_name: document.getElementById('clientName').value,
    agent_name: document.getElementById('agentName').value,
    issue_summary: document.getElementById('issueSummary').value,
    ticket_number: document.getElementById('ticketNumber').value
  };

  try {
    const suggestion = await ai.generate(context, selectedTone);
    document.getElementById('aiSuggestionBox').value = suggestion;
  } catch (err) {
    // fallback to local rule-based if provider missing
    console.error(err);
    alert('AI provider not configured. Falling back to local reply generator.');
    // You can call the existing rule-based function or import it here
  }
});
