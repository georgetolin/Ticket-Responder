// Core JS controller for the offline email composer
// All logic runs client-side, uses localStorage for persistence.
// Modular functions: generateSmartReply, detectIssueType, personalizeTemplate, etc.

const STORAGE_KEYS = {
  TEMPLATES: 'sec_templates_v1',
  DRAFT: 'sec_draft_v1'
};

// In-memory state
let templates = []; // loaded template objects
let selectedTemplateId = null;
let selectedTone = 'friendly'; // default tone

// DOM refs
const $ = id => document.getElementById(id);
const templateListEl = document.getElementById('templateList');
const previewEl = document.getElementById('preview');

// --- Initialization ---
async function init() {
  bindUIHandlers();
  await loadTemplates(); // loads from localStorage or templates.json
  loadDraft();
  renderTemplateList();
  activateFirstTemplateIfNone();
  updatePreview();
}

function bindUIHandlers() {
  // Tone selector
  document.querySelectorAll('.tone-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedTone = btn.dataset.tone;
      document.querySelectorAll('.tone-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updatePreview();
    });
  });

  // Context fields update preview live
  ['clientName','agentName','issueSummary','ticketNumber'].forEach(id => {
    $(id).addEventListener('input', () => saveDraft() || updatePreview());
  });

  // Template editor events
  $('templateBody').addEventListener('input', () => saveDraft() || updatePreview());
  $('templateTitle').addEventListener('input', saveDraft);
  $('templateTags').addEventListener('input', saveDraft);

  // Template controls
  $('newTemplate').addEventListener('click', createNewTemplate);
  $('saveTemplate').addEventListener('click', saveCurrentTemplate);
  $('deleteTemplate').addEventListener('click', deleteCurrentTemplate);

  // Search
  $('templateSearch').addEventListener('input', handleTemplateSearch);

  // Template list clicks delegated
  templateListEl.addEventListener('click', (e) => {
    const item = e.target.closest('.template-item');
    if (!item) return;
    selectTemplate(item.dataset.id);
  });

  // AI suggestion generation & apply
  $('generateSuggestion').addEventListener('click', () => {
    const ctx = readContext();
    const suggestion = generateSmartReply(ctx, selectedTone);
    $('aiSuggestionBox').value = suggestion;
  });
  $('applySuggestion').addEventListener('click', () => {
    const suggestion = $('aiSuggestionBox').value.trim();
    if (!suggestion) return;
    // Overwrite editor body by default (merge could be added later)
    $('templateBody').value = suggestion;
    saveDraft();
    updatePreview();
  });

  // Detect issue button
  $('detectIssue').addEventListener('click', () => {
    const type = detectIssueType($('issueSummary').value || '');
    alert('Detected issue type: ' + type);
  });

  // Test Template
  $('testTemplateBtn').addEventListener('click', testTemplate);

  // Export / Import
  $('exportTemplates').addEventListener('click', exportTemplates);
  $('importInput').addEventListener('change', importTemplatesFromFile);

  // Preview actions
  $('copyPreview').addEventListener('click', copyPreviewToClipboard);
  $('clearDraft').addEventListener('click', clearDraft);
}

// --- Templates load/save ---
async function loadTemplates() {
  const stored = localStorage.getItem(STORAGE_KEYS.TEMPLATES);
  if (stored) {
    try {
      templates = JSON.parse(stored);
      return;
    } catch (e) {
      console.warn('Failed to parse stored templates, falling back to default', e);
    }
  }

  // Try loading from templates.json (local file)
  try {
    const resp = await fetch('templates.json', {cache: 'no-store'});
    if (resp.ok) {
      const json = await resp.json();
      templates = json.templates || [];
      saveTemplatesToLocalStorage();
      return;
    }
  } catch (e) {
    // fetch might fail in some file:// contexts — fallback to embedded defaults
    console.warn('Could not fetch templates.json, using embedded defaults', e);
  }

  // Embedded fallback templates
  templates = [
    {
      id: 'embedded-generic',
      title: 'Generic acknowledgement',
      category: 'general',
      tags: ['generic','acknowledgement'],
      body: "Hi {{client_name}},\n\nThanks for reaching out regarding {{issue_summary}}. We'll investigate and follow up shortly.\n\nBest regards,\n{{agent_name}}\n{{current_date}}"
    }
  ];
  saveTemplatesToLocalStorage();
}

function saveTemplatesToLocalStorage() {
  localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(templates));
}

function loadDraft() {
  const stored = localStorage.getItem(STORAGE_KEYS.DRAFT);
  if (!stored) return;
  try {
    const d = JSON.parse(stored);
    if (d.clientName) $('clientName').value = d.clientName;
    if (d.agentName) $('agentName').value = d.agentName;
    if (d.issueSummary) $('issueSummary').value = d.issueSummary;
    if (d.ticketNumber) $('ticketNumber').value = d.ticketNumber;
    if (d.templateBody) $('templateBody').value = d.templateBody;
    if (d.templateTitle) $('templateTitle').value = d.templateTitle;
    if (d.templateTags) $('templateTags').value = d.templateTags;
  } catch (e) {
    console.warn('Could not load draft', e);
  }
}

function saveDraft() {
  const d = {
    clientName: $('clientName').value,
    agentName: $('agentName').value,
    issueSummary: $('issueSummary').value,
    ticketNumber: $('ticketNumber').value,
    templateBody: $('templateBody').value,
    templateTitle: $('templateTitle').value,
    templateTags: $('templateTags').value
  };
  localStorage.setItem(STORAGE_KEYS.DRAFT, JSON.stringify(d));
}

// --- Template CRUD ---
function renderTemplateList(filter = '') {
  templateListEl.innerHTML = '';
  const q = filter.trim().toLowerCase();
  const filtered = templates.filter(t => {
    if (!q) return true;
    return (t.title + ' ' + t.tags.join(' ') + ' ' + (t.body || '')).toLowerCase().includes(q);
  });
  filtered.forEach(t => {
    const div = document.createElement('div');
    div.className = 'template-item' + (t.id === selectedTemplateId ? ' active':'');
    div.dataset.id = t.id;
    div.textContent = t.title + ' — ' + (t.category || '');
    templateListEl.appendChild(div);
  });
}

function activateFirstTemplateIfNone() {
  if (!selectedTemplateId && templates.length) {
    selectTemplate(templates[0].id);
  }
}

function selectTemplate(id) {
  const t = templates.find(x => x.id === id);
  if (!t) return;
  selectedTemplateId = id;
  $('templateTitle').value = t.title;
  $('templateTags').value = (t.tags || []).join(',');
  $('templateBody').value = t.body || '';
  renderTemplateList($('templateSearch').value);
  saveDraft();
  updatePreview();
}

function createNewTemplate() {
  const id = 'tmpl-' + Date.now();
  const newT = { id, title: 'New template', category: 'custom', tags: [], body: 'Hi {{client_name}},\n\n' };
  templates.unshift(newT);
  saveTemplatesToLocalStorage();
  selectTemplate(id);
  renderTemplateList();
}

function saveCurrentTemplate() {
  if (!selectedTemplateId) {
    alert('No template selected. Create or select one first.');
    return;
  }
  const idx = templates.findIndex(t => t.id === selectedTemplateId);
  if (idx === -1) return;
  templates[idx].title = $('templateTitle').value || templates[idx].title;
  templates[idx].tags = ($('templateTags').value || '').split(',').map(s => s.trim()).filter(Boolean);
  templates[idx].body = $('templateBody').value;
  saveTemplatesToLocalStorage();
  renderTemplateList($('templateSearch').value);
  alert('Template saved locally.');
}

function deleteCurrentTemplate() {
  if (!selectedTemplateId) return;
  if (!confirm('Delete selected template?')) return;
  templates = templates.filter(t => t.id !== selectedTemplateId);
  saveTemplatesToLocalStorage();
  selectedTemplateId = null;
  renderTemplateList();
  activateFirstTemplateIfNone();
  updatePreview();
}

function handleTemplateSearch(e) {
  renderTemplateList(e.target.value || '');
}

// --- Export / Import ---
function exportTemplates() {
  const data = JSON.stringify({ templates }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'templates_export.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importTemplatesFromFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const parsed = JSON.parse(ev.target.result);
      if (!parsed.templates || !Array.isArray(parsed.templates)) throw new Error('Invalid format');
      // Merge or replace? We'll append and avoid id conflicts.
      const existingIds = new Set(templates.map(t => t.id));
      parsed.templates.forEach(t => {
        if (!t.id) t.id = 'import-' + Date.now() + '-' + Math.random().toString(36).slice(2,8);
        if (existingIds.has(t.id)) t.id = t.id + '-dup-' + Math.random().toString(36).slice(2,4);
        templates.push(t);
      });
      saveTemplatesToLocalStorage();
      renderTemplateList();
      alert('Imported templates successfully.');
    } catch (err) {
      alert('Failed to import: ' + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = ''; // reset input
}

// --- Helpers: tokens, preview, personalization ---
function readContext() {
  return {
    client_name: $('clientName').value || '',
    agent_name: $('agentName').value || '',
    issue_summary: $('issueSummary').value || '',
    ticket_number: $('ticketNumber').value || '',
    current_date: new Date().toLocaleDateString()
  };
}

// Replace tokens like {{client_name}} with provided tokens (case-insensitive)
function personalizeTemplate(templateString, tokens = {}) {
  if (!templateString) return '';
  return templateString.replace(/{{\s*([\w\-]+)\s*}}/gi, (match, p1) => {
    const key = p1.toLowerCase();
    if (tokens.hasOwnProperty(key)) return tokens[key];
    return match; // leave unreplaced token for visibility
  });
}

function updatePreview() {
  // Compose preview from editor body + tokens + tone adjustments if needed
  const ctx = readContext();
  let body = $('templateBody').value || '';
  // If the body appears empty but a template is selected, use that template's body
  if (!body && selectedTemplateId) {
    const t = templates.find(x => x.id === selectedTemplateId);
    if (t) body = t.body || '';
  }

  // If the current template contains the token {{issue_summary}} and issue summary is empty,
  // add a small warning to preview.
  if (body.includes('{{issue_summary}}') && !ctx.issue_summary) {
    // don't mutate template; just show hint in preview
    body = body + "\n\n[Note: no issue summary provided — consider adding details.]";
  }

  // Personalize tokens
  const tokens = {
    client_name: ctx.client_name || 'Customer',
    agent_name: ctx.agent_name || 'Support Team',
    issue_summary: ctx.issue_summary || '',
    ticket_number: ctx.ticket_number || '',
    current_date: ctx.current_date || new Date().toLocaleDateString()
  };
  let rendered = personalizeTemplate(body, tokens);

  // Small tone-specific polish without changing source template
  rendered = applyTonePolishToPreview(rendered, selectedTone, tokens);

  // Display
  previewEl.textContent = rendered;
}

// Add subtle tone-driven phrases to the preview display (does not modify editor)
function applyTonePolishToPreview(text, tone, tokens) {
  const closing = `\n\nBest regards,\n${tokens.agent_name}`;
  // Prevent duplicate closings
  if (text.trim().endsWith(tokens.agent_name) || text.includes('Best regards')) {
    return text;
  }
  switch (tone) {
    case 'formal':
      return text + closing;
    case 'friendly':
      return text + '\n\nThanks! We’ll get this sorted. \n\nWarm regards,\n' + tokens.agent_name;
    case 'apologetic':
      return text + '\n\nWe apologize for the inconvenience and appreciate your patience.\n\nKind regards,\n' + tokens.agent_name;
    case 'proactive':
      return text + '\n\nWe’re already investigating and will follow up with next steps.\n\nBest regards,\n' + tokens.agent_name;
    default:
      return text + closing;
  }
}

// --- Smart reply generator ---
function detectIssueType(summary) {
  const s = (summary || '').toLowerCase();
  if (!s) return 'unknown';
  const check = (arr) => arr.some(k => s.includes(k));
  if (check(['login', 'sign in', 'signin', 'can't sign', 'cannot login', 'account locked', 'locked'])) return 'login';
  if (check(['password', 'reset password', 'forgot password', 'change password'])) return 'password';
  if (check(['billing','invoice','charge','payment','refund'])) return 'billing';
  if (check(['performance','slow','lag','timeout'])) return 'performance';
  if (check(['error','unexpected','bug','crash'])) return 'error';
  return 'general';
}

// Generate a polite, tone-aware reply given context.
// This function is the offline "AI" — rule-based and deterministic.
function generateSmartReply(context, tone) {
  // Normalize keys
  const ctx = {
    client_name: context.client_name || context.clientName || '',
    agent_name: context.agent_name || context.agentName || 'Support Team',
    issue_summary: context.issue_summary || context.issueSummary || '',
    ticket_number: context.ticket_number || context.ticketNumber || ''
  };
  const type = detectIssueType(ctx.issue_summary);
  let base = '';

  // Base reply per detected issue type
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

  // Tone modifications (short, concise)
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

  // Append ticket & date context if present
  const ticketLine = ctx.ticket_number ? `\nTicket: ${ctx.ticket_number}` : '';
  const currentDate = `\nDate: ${new Date().toLocaleDateString()}`;

  const reply = `${base}${toneSuffix}${ticketLine}${currentDate}`;
  return reply;
}

// --- Test Template: simulate completed email with dummy tokens ---
function testTemplate() {
  const sampleTokens = {
    client_name: 'Acme Corp.',
    agent_name: $('agentName').value || 'Alex Rivera',
    issue_summary: $('issueSummary').value || 'Unable to upload files',
    ticket_number: $('ticketNumber').value || 'TCK-12345',
    current_date: new Date().toLocaleDateString()
  };

  // Use current editor body or selected template
  const body = $('templateBody').value || (selectedTemplateId && templates.find(t => t.id===selectedTemplateId)?.body) || 'Hi {{client_name}},\n\n...';
  const rendered = personalizeTemplate(body, sampleTokens);
  // Show test in preview but prefix with label
  previewEl.textContent = '[Test Template Preview — simulated values]\n\n' + rendered;
}

// --- Utility: copy preview text ---
function copyPreviewToClipboard() {
  const text = previewEl.textContent || '';
  navigator.clipboard?.writeText(text).then(() => {
    alert('Preview copied to clipboard.');
  }).catch(() => {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    alert('Preview copied to clipboard.');
  });
}

function clearDraft() {
  if (!confirm('Clear draft and editor fields?')) return;
  localStorage.removeItem(STORAGE_KEYS.DRAFT);
  $('clientName').value = '';
  $('agentName').value = '';
  $('issueSummary').value = '';
  $('ticketNumber').value = '';
  $('templateBody').value = '';
  $('templateTitle').value = '';
  $('templateTags').value = '';
  updatePreview();
}

// Initialize app on load
window.addEventListener('DOMContentLoaded', init);
