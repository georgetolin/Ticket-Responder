// Provider stub adapter. This file shows the expected interface.
// It does NOT call any network by default — you must implement the fetch to your server or provider.
// If you want a hosted server, implement a server endpoint that validates requests and keeps secrets.

export async function generate(context = {}, tone = 'friendly') {
  // Example: if you have a server endpoint at /api/ai that you control,
  // you might call it like this (uncomment and implement server-side securely):
  //
  // const resp = await fetch('/api/ai', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ context, tone })
  // });
  // const data = await resp.json();
  // return data.reply;

  // Fallback behavior: explicit error so developer remembers to configure provider
  throw new Error('Provider adapter not configured. Implement /api/ai or customize this adapter.');
}

export default { generate };
