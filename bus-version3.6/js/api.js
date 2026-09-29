/**
 * api.js — thin wrapper around the Google Apps Script Web App.
 *
 * IMPORTANT: set API_URL to your deployed Apps Script Web App URL.
 */
const API_URL = 'https://script.google.com/macros/s/AKfycbyvEl2WHRz8-CTbIBHXIDpSC5zyGYcFjO4SggfQWxPj7ldHK7QneBXrNKD2BB6wPNO0/exec';

/**
 * parseLocalDate — the backend sends dates as plain
 * 'yyyy-MM-dd' (or 'yyyy-MM-dd HH:mm:ss' for timestamps) strings.
 * Parse the Y/M/D/H/M/S pieces directly into a local Date so the browser
 * does not silently shift a date through UTC parsing.
 */
function parseLocalDate(v) {
  if (v instanceof Date) return v;
  if (typeof v === 'string') {
    let m = v.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  }
  return new Date(v);
}

const Api = (function () {
  function getToken() {
    return localStorage.getItem('sems_token');
  }

  async function get(action, params) {
    const url = new URL(API_URL);
    url.searchParams.set('action', action);
    url.searchParams.set('token', getToken() || '');
    if (params) {
      Object.keys(params).forEach(k => url.searchParams.set(k, params[k]));
    }

    const res = await fetch(url.toString(), { method: 'GET' });
    if (!res.ok) throw new Error('API request failed (' + res.status + ')');

    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  }

  async function post(action, payload) {
    const body = Object.assign({ action: action, token: getToken() }, payload || {});

    // Apps Script Web Apps may redirect requests. The application therefore
    // sends write actions as GET + payload, which the backend's doGet handler
    // unwraps and routes to the same action handlers.
    const url = new URL(API_URL);
    url.searchParams.set('payload', JSON.stringify(body));

    const res = await fetch(url.toString(), { method: 'GET' });
    if (!res.ok) throw new Error('API request failed (' + res.status + ')');

    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  }

  // Centralized date ordering so Dashboard, Manager and Reports consumers
  // get the actual expense date order rather than submission timestamp order.
  async function getExpenses() {
    const data = await get('getExpenses');
    if (Array.isArray(data.expenses)) {
      data.expenses.sort((a, b) => parseLocalDate(b.Date) - parseLocalDate(a.Date));
    }
    return data;
  }

  return {
    login: (username, password) => post('login', { username, password }),
    logout: () => post('logout', {}),
    verifySession: () => get('verifySession'),

    getExpenses,
    getDashboardStats: () => get('getDashboardStats'),
    getUsers: () => get('getUsers'),
    getSites: () => get('getSites'),
    getAuditLog: () => get('getAuditLog'),
    getProjectHealth: () => get('getProjectHealth'),
    getBlockProduction: () => get('getBlockProduction'),
    getColumnProgress: () => get('getColumnProgress'),

    submitExpense: (expense) => post('submitExpense', { expense }),
    submitExpensesBulk: (expenses) => post('submitExpensesBulk', { expenses }),
    addUser: (user) => post('addUser', { user }),
    addSite: (site) => post('addSite', { site }),
    addProject: (project) => post('addProject', { project }),
    addBlockProduction: (entry) => post('addBlockProduction', { entry }),
    addBlockProductionSandBulk: (sandRows) => post('addBlockProductionSandBulk', { sandRows }),
    addColumnProgress: (entry) => post('addColumnProgress', { entry }),
    autoRecategorize: (fromCategory, dryRun) => post('autoRecategorize', { fromCategory, dryRun }),

    getCashBook: () => get('getCashBook'),
    getSandEntries: () => get('getSandEntries'),
    addCashBookEntry: (entry) => post('addCashBookEntry', { entry }),
    addCashBookEntriesBulk: (entries) => post('addCashBookEntriesBulk', { entries }),
    deleteCashBookEntry: (entryId) => post('deleteCashBookEntry', { entryId })
  };
})();
