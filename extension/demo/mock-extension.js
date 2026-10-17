/* DEMO ONLY. Not in manifest.json. It never stores anything persistently. */
(function () {
  'use strict';
  if (globalThis.chrome?.storage?.local) return;
  const data = {}, changeListeners = new Set(), messageListeners = new Set();
  function changes(changed) { for (const listener of changeListeners) listener(changed, 'local'); }
  const chromeMock = {
    runtime: {id: 'gtn-offline-demo', onMessage: {addListener: listener => messageListeners.add(listener), removeListener: listener => messageListeners.delete(listener)}},
    storage: {
      local: {
        get: async keys => keys === null ? structuredClone(data) : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter(key => key in data).map(key => [key, structuredClone(data[key])])),
        set: async entries => { const result = {}; for (const [key, value] of Object.entries(entries)) { result[key] = {oldValue: data[key], newValue: value}; data[key] = value; } queueMicrotask(() => changes(result)); },
        remove: async keys => { const result = {}; for (const key of Array.isArray(keys) ? keys : [keys]) { result[key] = {oldValue: data[key]}; delete data[key]; } queueMicrotask(() => changes(result)); }
      },
      onChanged: {addListener: listener => changeListeners.add(listener), removeListener: listener => changeListeners.delete(listener)}
    }
  };
  globalThis.chrome = chromeMock;
})();
