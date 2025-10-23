// Simple pluggable AI adapter registry for the composer
// Two adapters included: "rulebased" (local) and "provider-stub" (placeholder).
// Consumers call selectAdapter(name) then adapter.generate(context, tone).

import rulebased from './rulebased.js';
import providerStub from './provider-stub.js';

const adapters = {
  rulebased,
  provider: providerStub
};

let active = 'rulebased';

export function listAdapters() {
  return Object.keys(adapters);
}

export function selectAdapter(name) {
  if (adapters[name]) active = name;
  else throw new Error('Unknown adapter: ' + name);
}

export async function generate(context, tone) {
  const adapter = adapters[active];
  if (!adapter || typeof adapter.generate !== 'function') {
    throw new Error('Active adapter invalid');
  }
  return adapter.generate(context, tone);
}

// Default export convenience
export default { listAdapters, selectAdapter, generate };
