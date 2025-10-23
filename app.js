// Core JS controller for the offline email composer
// All logic runs client-side, uses localStorage for persistence.
// This version avoids optional chaining and uses safe feature checks
// so it runs on a wide range of browsers (and on GitHub Pages).

(function () {
  'use strict';

  const STORAGE_KEYS = {
    TEMPLATES: 'sec_templates_v1',
    DRAFT: 'sec_draft_v1'
  };

  // In-memory state
  let templates = []; // loaded template objects
  let selectedTemplateId = null;
  let selectedTone = 'friendly'; // default tone

  // DOM refs (populated in init)
  var templateListEl = null;
  var previewEl = null;

  // Minimal helper
  function $(id) { return document.getElementById(id); }

  // --- Initialization ---
  function init() {
    // populate DOM refs now that DOM is ready
    templateListEl = $('templateList');
    previewEl = $('preview');

    bindUIHandlers();
    loadTemplates().then(function () {
      loadDraft();
      renderTemplateList();
      activateFirstTemplateIfNone();
      updatePreview();
    }).catch(function (err) {
      console.error('Error during init loadTemplates:', err);
      // still try to continue with defaults
      loadDraft();
      renderTemplateList();
      activateFirstTemplateIfNone();
      updatePreview();
    });
  }

  function bindUIHandlers() {
    // Tone selector
    var toneButtons = document.querySelectorAll('.tone-btn') || [];
    toneButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectedTone = btn.dataset.tone;
        toneButtons.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        updatePreview();
      });
    });

    // Context fields update preview live
    ['clientName','agentName','issueSummary','ticketNumber'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('input', function () { saveDraft(); updatePreview(); });
    });

    // Template editor events
    var tb = $('templateBody');
    if (tb) tb.addEventListener('input', function () { saveDraft(); updatePreview(); });
    var tt = $('templateTitle');
    if (tt) tt.addEventListener('input', saveDraft);
    var tg = $('templateTags');
    if (tg) tg.addEventListener('input', saveDraft);

    // Template controls
    var newT = $('newTemplate');
    if (newT) newT.addEventListener('click', createNewTemplate);
    var saveT = $('saveTemplate');
    if (saveT) saveT.addEventListener('click', saveCurrentTemplate);
    var delT = $('deleteTemplate');
    if (delT) delT.addEventListener('click', deleteCurrentTemplate);

    // Search
    var searchEl = $('templateSearch');
    if (searchEl) searchEl.addEventListener('input', handleTemplateSearch);

    // Template list clicks delegated
    if (templateListEl) {
      templateListEl.addEventListener('click', function (e) {
        var item = e.target;
        while (item && !item.classList.contains('template-item')) {
          item = item.parentElement;
        }
        if (!item) return;
        var id = item.dataset && item.dataset.id;
        if (id) selectTemplate(id);
      });
    }

    // AI suggestion generation & apply (uses local rule-based generator)
    var genBtn = $('generateSuggestion');
    if (genBtn) genBtn.addEventListener('click', function () {
      var ctx = readContext();
      var suggestion = generateSmartReply(ctx, selectedTone);
      var box = $('aiSuggestionBox');
      if (box) box.value = suggestion;
    });

    var applyBtn = $('applySuggestion');
    if (applyBtn) applyBtn.addEventListener('click', function () {
      var box = $('aiSuggestionBox');
      if (!box) return;
      var suggestion = box.value.trim();
      if (!suggestion) return;
      var editor = $('templateBody');
      if (editor) {
        editor.value = suggestion;
        saveDraft();
        updatePreview();
      }
    });

    // Detect issue button
    var di = $('detectIssue');
    if (di) di.addEventListener('click', function () {
      var type = detectIssueType(($('issueSummary') && $('issueSummary').value) || '');
      alert('Detected issue type: ' + type);
    });

    // Test Template
    var testBtn = $('testTemplateBtn');
    if (testBtn) testBtn.addEventListener('click', testTemplate);

    // Export / Import
    var exportBtn = $('exportTemplates');
    if (exportBtn) exportBtn.addEventListener('click', exportTemplates);
    var importInput = $('importInput');
    if (importInput) importInput.addEventListener('change', importTemplatesFromFile);

    // Preview actions
    var copyBtn = $('copyPreview');
    if (copyBtn) copyBtn.addEventListener('click', copyPreviewToClipboard);
    var clearBtn = $('clearDraft');
    if (clearBtn) clearBtn.addEventListener('click', clearDraft);
  }

  // --- Templates load/save ---
  function loadTemplates() {
    return new Promise(function (resolve) {
      var stored = localStorage.getItem(STORAGE_KEYS.TEMPLATES);
      if (stored) {
        try {
          templates = JSON.parse(stored);
          resolve();
          return;
        } catch (e) {
          console.warn('Failed to parse stored templates, falling back to default', e);
        }
      }

      // Try loading from templates.json (local file, relative path)
      fetch('./templates.json', { cache: 'no-store' }).then(function (resp) {
        if (resp.ok) {
          return resp.json().then(function (json) {
            templates = json.templates || [];
            saveTemplatesToLocalStorage();
            resolve();
          }).catch(function (err) {
            console.warn('Failed to parse templates.json:', err);
            resolve();
          });
        } else {
          // not ok (404 etc) — fallback to embedded defaults
          resolve();
        }
      }).catch(function (e) {
        // fetch might fail in some contexts — fallback to embedded defaults
        console.warn('Could not fetch templates.json, using embedded defaults', e);
        resolve();
      });
    }).then(function () {
      if (!templates || templates.length === 0) {
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
    });
  }

  function saveTemplatesToLocalStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(templates));
    } catch (e) {
      console.warn('Failed saving templates to localStorage', e);
    }
  }

  function loadDraft() {
    var stored = localStorage.getItem(STORAGE_KEYS.DRAFT);
    if (!stored) return;
    try {
      var d = JSON.parse(stored);
      if (d.clientName && $('clientName')) $('clientName').value = d.clientName;
      if (d.agentName && $('agentName')) $('agentName').value = d.agentName;
      if (d.issueSummary && $('issueSummary')) $('issueSummary').value = d.issueSummary;
      if (d.ticketNumber && $('ticketNumber')) $('ticketNumber').value = d.ticketNumber;
      if (d.templateBody && $('templateBody')) $('templateBody').value = d.templateBody;
      if (d.templateTitle && $('templateTitle')) $('templateTitle').value = d.templateTitle;
      if (d.templateTags && $('templateTags')) $('templateTags').value = d.templateTags;
    } catch (e) {
      console.warn('Could not load draft', e);
    }
  }

  function saveDraft() {
    try {
      var d = {
        clientName: ($('clientName') && $('clientName').value) || '',
        agentName: ($('agentName') && $('agentName').value) || '',
        issueSummary: ($('issueSummary') && $('issueSummary').value) || '',
        ticketNumber: ($('ticketNumber') && $('ticketNumber').value) || '',
        templateBody: ($('templateBody') && $('templateBody').value) || '',
        templateTitle: ($('templateTitle') && $('templateTitle').value) || '',
        templateTags: ($('templateTags') && $('templateTags').value) || ''
      };
      localStorage.setItem(STORAGE_KEYS.DRAFT, JSON.stringify(d));
    } catch (e) {
      console.warn('Failed saving draft', e);
    }
  }

  // --- Template CRUD ---
  function renderTemplateList(filter) {
    filter = (filter || '').trim().toLowerCase();
    if (!templateListEl) return;
    templateListEl.innerHTML = '';
    var filtered = templates.filter(function (t) {
      if (!filter) return true;
      var hay = (t.title || '') + ' ' + ((t.tags && t.tags.join(' ')) || '') + ' ' + ((t.body) || '');
      return hay.toLowerCase().indexOf(filter) !== -1;
    });
    filtered.forEach(function (t) {
      var div = document.createElement('div');
      div.className = 'template-item' + (t.id === selectedTemplateId ? ' active' : '');
      div.dataset.id = t.id;
      div.textContent = (t.title || '') + ' — ' + (t.category || '');
      templateListEl.appendChild(div);
    });
  }

  function activateFirstTemplateIfNone() {
    if (!selectedTemplateId && templates && templates.length) {
      selectTemplate(templates[0].id);
    }
  }

  function selectTemplate(id) {
    var t = templates.find(function (x) { return x && x.id === id; });
    if (!t) return;
    selectedTemplateId = id;
    if ($('templateTitle')) $('templateTitle').value = t.title || '';
    if ($('templateTags')) $('templateTags').value = (t.tags || []).join(',');
    if ($('templateBody')) $('templateBody').value = t.body || '';
    var searchVal = ($('templateSearch') && $('templateSearch').value) || '';
    renderTemplateList(searchVal);
    saveDraft();
    updatePreview();
  }

  function createNewTemplate() {
    var id = 'tmpl-' + Date.now();
    var newT = { id: id, title: 'New template', category: 'custom', tags: [], body: 'Hi {{client_name}},\n\n' };
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
    var idx = templates.findIndex(function (t) { return t.id === selectedTemplateId; });
    if (idx === -1) return;
    templates[idx].title = ($('templateTitle') && $('templateTitle').value) || templates[idx].title;
    var tagsStr = ($('templateTags') && $('templateTags').value) || '';
    templates[idx].tags = tagsStr.split(',').map(function (s) { return s.trim(); }).filter(function (s) { return !!s; });
    templates[idx].body = ($('templateBody') && $('templateBody').value) || templates[idx].body;
    saveTemplatesToLocalStorage();
    renderTemplateList(($('templateSearch') && $('templateSearch').value) || '');
    alert('Template saved locally.');
  }

  function deleteCurrentTemplate() {
    if (!selectedTemplateId) return;
    if (!confirm('Delete selected template?')) return;
    templates = templates.filter(function (t) { return t.id !== selectedTemplateId; });
    saveTemplatesToLocalStorage();
    selectedTemplateId = null;
    renderTemplateList();
    activateFirstTemplateIfNone();
    updatePreview();
  }

  function handleTemplateSearch(e) {
    renderTemplateList((e && e.target && e.target.value) || '');
  }

  // --- Export / Import ---
  function exportTemplates() {
    try {
      var data = JSON.stringify({ templates: templates }, null, 2);
      var blob = new Blob([data], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'templates_export.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Export failed: ' + e.message);
    }
  }

  function importTemplatesFromFile(e) {
    var file = (e && e.target && e.target.files && e.target.files[0]);
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var parsed = JSON.parse(ev.target.result);
        if (!parsed.templates || !Array.isArray(parsed.templates)) throw new Error('Invalid format');
        var existingIds = new Set((templates || []).map(function (t) { return t.id; }));
        parsed.templates.forEach(function (t) {
          if (!t.id) t.id = 'import-' + Date.now() + '-' + Math.random().toString(36).slice(2,8);
          while (existingIds.has(t.id)) {
            t.id = t.id + '-dup-' + Math.random().toString(36).slice(2,4);
          }
          existingIds.add(t.id);
          templates.push(t);
        });
        saveTemplatesToLocalStorage();
        renderTemplateList();
        alert('Imported templates successfully.');
      } catch (err) {
        alert('Failed to import: ' + (err.message || String(err)));
      }
    };
    reader.readAsText(file);
    if (e && e.target) e.target.value = ''; // reset input
  }

  // --- Helpers: tokens, preview, personalization ---
  function readContext() {
    return {
      client_name: ($('clientName') && $('clientName').value) || '',
      agent_name: ($('agentName') && $('agentName').value) || '',
      issue_summary: ($('issueSummary') && $('issueSummary').value) || '',
      ticket_number: ($('ticketNumber') && $('ticketNumber').value) || '',
      current_date: new Date().toLocaleDateString()
    };
  }

  // Replace tokens like {{client_name}} with provided tokens (case-insensitive)
  function personalizeTemplate(templateString, tokens) {
    tokens = tokens || {};
    if (!templateString) return '';
    return templateString.replace(/{{\s*([\w\-]+)\s*}}/gi, function (match, p1) {
      var key = (p1 || '').toLowerCase();
      if (Object.prototype.hasOwnProperty.call(tokens, key)) return tokens[key];
      return match; // leave unreplaced token for visibility
    });
  }

  function updatePreview() {
    var ctx = readContext();
    var body = ($('templateBody') && $('templateBody').value) || '';
    // If the body appears empty but a template is selected, use that template's body
    if (!body && selectedTemplateId) {
      var found = templates.find(function (x) { return x && x.id === selectedTemplateId; });
      if (found && found.body) body = found.body;
    }

    // If the current template contains the token {{issue_summary}} and issue summary is empty,
    // add a small warning to preview.
    if (body && body.indexOf('{{issue_summary}}') !== -1 && !ctx.issue_summary) {
      body = body + "\n\n[Note: no issue summary provided — consider adding details.]";
    }

    // Personalize tokens
    var tokens = {
      client_name: ctx.client_name || 'Customer',
      agent_name: ctx.agent_name || 'Support Team',
      issue_summary: ctx.issue_summary || '',
      ticket_number: ctx.ticket_number || '',
      current_date: ctx.current_date || new Date().toLocaleDateString()
    };
    var rendered = personalizeTemplate(body, tokens);

    // Small tone-specific polish without changing source template
    rendered = applyTonePolishToPreview(rendered, selectedTone, tokens);

    // Display
    if (previewEl) previewEl.textContent = rendered;
  }

  // Add subtle tone-driven phrases to the preview display (does not modify editor)
  function applyTonePolishToPreview(text, tone, tokens) {
    var closing = "\n\nBest regards,\n" + tokens.agent_name;
    // Prevent duplicate closings
    if (!text) return closing;
    if (text.trim().endsWith(tokens.agent_name) || text.indexOf('Best regards') !== -1) {
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
    var s = (summary || '').toLowerCase();
    if (!s) return 'unknown';
    var check = function (arr) {
      return arr.some(function (k) { return s.indexOf(k) !== -1; });
    };
    if (check(['login', 'sign in', 'signin', "can't sign", 'cannot login', 'account locked', 'locked'])) return 'login';
    if (check(['password', 'reset password', 'forgot password', 'change password'])) return 'password';
    if (check(['billing','invoice','charge','payment','refund'])) return 'billing';
    if (check(['performance','slow','lag','timeout'])) return 'performance';
    if (check(['error','unexpected','bug','crash'])) return 'error';
    return 'general';
  }

  // Generate a polite, tone-aware reply given context.
  function generateSmartReply(context, tone) {
    var ctx = {
      client_name: (context && (context.client_name || context.clientName)) || '',
      agent_name: (context && (context.agent_name || context.agentName)) || 'Support Team',
      issue_summary: (context && (context.issue_summary || context.issueSummary)) || '',
      ticket_number: (context && (context.ticket_number || context.ticketNumber)) || ''
    };
    var type = detectIssueType(ctx.issue_summary);
    var base = '';

    switch (type) {
      case 'login':
        base = "Hi " + (ctx.client_name || 'there') + ",\n\nThanks for letting us know you’re having trouble signing in. Please try resetting your password using the \"Forgot password\" link. If you still can’t access your account, reply and we will initiate a manual reset.";
        break;
      case 'password':
        base = "Hi " + (ctx.client_name || 'there') + ",\n\nWe can help with the password reset. I have initiated a reset link to the email associated with your account. Please follow the instructions to complete the update.";
        break;
      case 'billing':
        base = "Hi " + (ctx.client_name || 'there') + ",\n\nThanks for raising this billing concern. I’ve forwarded the details to our billing team for review. We will follow up with an update or any required refund on this ticket.";
        break;
      case 'performance':
        base = "Hi " + (ctx.client_name || 'there') + ",\n\nI’m sorry you experienced slowness. Could you share the time, affected page, and any error messages? This helps us reproduce and fix the issue quickly.";
        break;
      case 'error':
        base = "Hi " + (ctx.client_name || 'there') + ",\n\nThank you for reporting this error. Could you provide a screenshot and the steps to reproduce it? We’ll investigate right away.";
        break;
      default:
        base = "Hi " + (ctx.client_name || 'there') + ",\n\nThanks for contacting us about " + (ctx.issue_summary || 'this matter') + ". We’re looking into it and will get back to you with next steps.";
    }

    var toneSuffix = '';
    switch (tone) {
      case 'formal':
        toneSuffix = "\n\nWe appreciate your patience.\n\nBest regards,\n" + ctx.agent_name;
        break;
      case 'friendly':
        toneSuffix = "\n\nNo worries — we’ll get this sorted quickly for you.\n\nWarm regards,\n" + ctx.agent_name;
        break;
      case 'apologetic':
        toneSuffix = "\n\nWe sincerely apologize for any inconvenience this may have caused and appreciate your patience.\n\nKind regards,\n" + ctx.agent_name;
        break;
      case 'proactive':
        toneSuffix = "\n\nWe’ve already started looking into this and will follow up shortly with an update.\n\nBest regards,\n" + ctx.agent_name;
        break;
      default:
        toneSuffix = "\n\nBest regards,\n" + ctx.agent_name;
    }

    var ticketLine = ctx.ticket_number ? ("\nTicket: " + ctx.ticket_number) : '';
    var currentDate = "\nDate: " + new Date().toLocaleDateString();

    var reply = base + toneSuffix + ticketLine + currentDate;
    return reply;
  }

  // --- Test Template: simulate completed email with dummy tokens ---
  function testTemplate() {
    var sampleTokens = {
      client_name: 'Acme Corp.',
      agent_name: ($('agentName') && $('agentName').value) || 'Alex Rivera',
      issue_summary: ($('issueSummary') && $('issueSummary').value) || 'Unable to upload files',
      ticket_number: ($('ticketNumber') && $('ticketNumber').value) || 'TCK-12345',
      current_date: new Date().toLocaleDateString()
    };

    // Use current editor body or selected template
    var body = ($('templateBody') && $('templateBody').value) || '';
    if (!body && selectedTemplateId) {
      var found = templates.find(function (item) { return item && item.id === selectedTemplateId; });
      if (found && found.body) body = found.body;
    }
    if (!body) body = 'Hi {{client_name}},\n\n...';

    var rendered = personalizeTemplate(body, sampleTokens);
    // Show test in preview but prefix with label
    if (previewEl) previewEl.textContent = '[Test Template Preview — simulated values]\n\n' + rendered;
  }

  // --- Utility: copy preview text ---
  function copyPreviewToClipboard() {
    var text = (previewEl && previewEl.textContent) || '';

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(function () {
        alert('Preview copied to clipboard.');
      }).catch(function () {
        // fallback to older approach
        fallbackCopyText(text);
      });
      return;
    }

    // Fallback when clipboard API is unavailable
    fallbackCopyText(text);
  }

  function fallbackCopyText(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      alert('Preview copied to clipboard.');
    } catch (e) {
      alert('Copy failed: ' + (e && e.message));
    }
    ta.remove();
  }

  function clearDraft() {
    if (!confirm('Clear draft and editor fields?')) return;
    try { localStorage.removeItem(STORAGE_KEYS.DRAFT); } catch (e) {}
    if ($('clientName')) $('clientName').value = '';
    if ($('agentName')) $('agentName').value = '';
    if ($('issueSummary')) $('issueSummary').value = '';
    if ($('ticketNumber')) $('ticketNumber').value = '';
    if ($('templateBody')) $('templateBody').value = '';
    if ($('templateTitle')) $('templateTitle').value = '';
    if ($('templateTags')) $('templateTags').value = '';
    updatePreview();
  }

  // Initialize app on load
  document.addEventListener('DOMContentLoaded', init);

  // Expose for debugging if needed (optional)
  window.__SEC_app = {
    readContext: readContext,
    generateSmartReply: generateSmartReply,
    updatePreview: updatePreview
  };

}());
```
