// In-memory store: used for local development, mock mode and tests. Data is lost on restart.
function createMemoryStore() {
  const items = new Map();
  return {
    kind: 'memory',
    async put(item) { items.set(item.id, structuredClone(item)); return item; },
    async get(id) { const item = items.get(id); return item ? structuredClone(item) : null; },
    // Read-modify-write: fn receives a copy and returns the new item (or null to leave it unchanged).
    async mutate(id, fn) {
      const current = items.get(id);
      if (!current) return null;
      const next = fn(structuredClone(current));
      if (!next) return structuredClone(current);
      items.set(id, structuredClone(next));
      return structuredClone(next);
    },
    async list() { return [...items.values()].map((i) => structuredClone(i)); },
    async clear() { items.clear(); },
  };
}

module.exports = { createMemoryStore };
