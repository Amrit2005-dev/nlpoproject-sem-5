// Safe localStorage wrapper with memory fallback

const memoryStore = new Map();

export const storage = {
  get: (key, defaultValue = null) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
      }
    } catch (e) {
      console.warn(`[storage] Failed to get ${key}:`, e);
    }
    return memoryStore.has(key) ? memoryStore.get(key) : defaultValue;
  },

  set: (key, value) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (e) {
      console.warn(`[storage] Failed to set ${key}:`, e);
    }
    memoryStore.set(key, value);
  },

  remove: (key) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn(`[storage] Failed to remove ${key}:`, e);
    }
    memoryStore.delete(key);
  },

  clear: () => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.clear();
      }
    } catch (e) {
      console.warn('[storage] Failed to clear localStorage:', e);
    }
    memoryStore.clear();
  }
};
