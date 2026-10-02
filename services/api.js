// Static-first service layer. Set window.QCC_DB_API_BASE before this script
// to connect the same UI to a real backend later.
(function () {
  const API_BASE = String(window.QCC_DB_API_BASE || '').replace(/\/$/, '');
  const DRAFTS_KEY = 'qcc-db:drafts:v1';
  const SESSION_KEY = 'qcc-db:session:v1';

  const readStorage = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.warn(`Unable to read ${key}`, error);
      return fallback;
    }
  };

  const writeStorage = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
    return value;
  };

  const slugify = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const safeFileName = (value) => slugify(value) || 'qcc-db-export';

  const downloadBlob = (blob, fileName) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  const toCSV = (rows) => {
    if (!Array.isArray(rows) || rows.length === 0) return '';
    const headers = Array.from(rows.reduce((set, row) => {
      Object.keys(row || {}).forEach(key => set.add(key));
      return set;
    }, new Set()));
    const escape = (value) => {
      const normalized = value === null || value === undefined
        ? ''
        : typeof value === 'object' ? JSON.stringify(value) : String(value);
      return `"${normalized.replace(/"/g, '""')}"`;
    };
    return [
      headers.map(escape).join(','),
      ...rows.map(row => headers.map(header => escape(row?.[header])).join(',')),
    ].join('\n');
  };

  async function request(path, options = {}) {
    if (!API_BASE) {
      throw new Error('BACKEND_NOT_CONFIGURED');
    }
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP_${response.status}`);
    }
    const contentType = response.headers.get('content-type') || '';
    return contentType.includes('application/json') ? response.json() : response.text();
  }

  const drafts = {
    list() {
      return readStorage(DRAFTS_KEY, []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    save(input) {
      const list = readStorage(DRAFTS_KEY, []);
      const now = new Date().toISOString();
      const id = input.id || `draft-${Date.now()}`;
      const next = {
        ...input,
        id,
        status: input.status || 'draft',
        createdAt: input.createdAt || now,
        updatedAt: now,
      };
      const index = list.findIndex(item => item.id === id);
      if (index >= 0) list[index] = next;
      else list.push(next);
      writeStorage(DRAFTS_KEY, list);
      return next;
    },
    remove(id) {
      const next = readStorage(DRAFTS_KEY, []).filter(item => item.id !== id);
      writeStorage(DRAFTS_KEY, next);
      return next;
    },
  };

  const auth = {
    getSession() {
      const session = readStorage(SESSION_KEY, null);
      if (session && session.mode !== 'local') {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return session;
    },
    enterLocalSession(profile) {
      const session = {
        id: `local-${Date.now()}`,
        displayName: profile.displayName.trim(),
        organization: profile.organization?.trim() || '',
        role: 'Data contributor',
        mode: 'local',
      };
      writeStorage(SESSION_KEY, session);
      return session;
    },
    logout() {
      localStorage.removeItem(SESSION_KEY);
    },
  };

  window.QCC_API = {
    baseUrl: API_BASE,
    backendConnected: Boolean(API_BASE),
    request,
    drafts,
    auth,
    loadJSON(path) {
      return fetch(path, { cache: 'no-store' }).then(response => {
        if (!response.ok) throw new Error(`Unable to load ${path}`);
        return response.json();
      });
    },
    downloadJSON(data, name) {
      downloadBlob(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }),
        `${safeFileName(name)}.json`,
      );
    },
    downloadCSV(rows, name) {
      const csv = `\uFEFF${toCSV(rows)}`;
      downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${safeFileName(name)}.csv`);
    },
    formatBytes(bytes) {
      if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
      const units = ['B', 'KB', 'MB', 'GB'];
      const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
      return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
    },
  };
})();
