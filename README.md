Support Email Composer — Offline Copilot Space

Overview
--------
This is an offline, browser-only support email composer that helps agents quickly compose
personalized, tone-aware replies. Everything runs client-side; no external network calls.

Key features
------------
- Tone selector: Formal, Friendly, Apologetic, Proactive.
- AI Smart Suggestions: rule-based generator (generateSuggestion) that creates tone-aware replies from context.
- Token personalization: supports {{client_name}}, {{agent_name}}, {{issue_summary}}, {{ticket_number}}, {{current_date}}.
- Templates: loadable from templates.json (local), editable, saveable to localStorage, export/import via JSON.
- Live preview: updates instantly when editing context or templates; preview replaces tokens.
- Test Template: "Test Template" shows simulated completed email using sample token values.
- Local persistence: templates and draft saved to localStorage.

Files
-----
- index.html : UI layout and DOM structure.
- styles.css : lightweight styling.
- app.js : main logic controller (token management, preview rendering, template CRUD, AI-suggestion generator).
- templates.json : shipped starting templates (can be imported/exported).
- README.txt : this file.

How to use
----------
1. Open index.html in a browser (file:// or a static server).
2. Fill in context fields (client name, agent, issue summary, ticket number).
3. Select or create a template; edit the body and use tokens as needed.
4. Choose a tone and click "Generate Suggestion" for a quick reply.
5. Click "Apply to Editor" to move the suggestion into the editor, then "Save" to persist.
6. Use "Test Template" to preview with sample token values.
7. Export templates to share or import using the import input.

Developer notes
---------------
- All storage is localStorage keys: 'sec_templates_v1' and 'sec_draft_v1'.
- The "AI" is deterministic and rule-based (no external APIs).
- To add templates programmatically, update templates.json or import a JSON file with shape:
  { "templates": [ { "id": "...", "title": "...", "category": "...", "tags": [...], "body": "..." } ] }

Customization ideas
-------------------
- Add merge behavior when applying AI suggestion (append vs replace).
- Add more sophisticated template ranking for search (TF-IDF style).
- Add undo/redo for editor changes.

Privacy
-------
All data remains in your browser. No network calls are made except loading local templates.json
(if present). Nothing is sent to any server.

Changelog
---------
- Initial offline implementation with tone system, local templates, and preview.

If you want changes or new features (example: keyboard shortcuts, autosave interval tuning,
or richer token set), ask and the composer can be extended.
