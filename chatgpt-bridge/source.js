const actions = new Set(['getExpenses', 'getCashBook', 'getBlockProduction', 'getColumnProgress', 'getSites']);
export function createSource(config, request = fetch) {
  const url = new URL(config.url);
  if (url.protocol !== 'https:' || url.hostname !== 'script.google.com' || !url.pathname.endsWith('/exec')) throw new Error('Use a deployed Apps Script HTTPS /exec URL');
  let token;
  async function call(body) {
    const response = await request(url, {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify(body), signal:AbortSignal.timeout(30000)});
    if (!response.ok) throw new Error('Source unavailable');
    const data = await response.json();
    if (data.error) throw new Error('Source request rejected');
    return data;
  }
  async function login() {
    const result = await call({action:'login', username:config.username, password:config.password});
    if (!result.success || result.role !== 'Boss' || !result.token) throw new Error('Dedicated Boss account required');
    token = result.token;
  }
  return async function read(action) {
    if (!actions.has(action)) throw new Error('Read action not allowed');
    if (!token) await login();
    // Reauthenticate only on a subsequent call after an expired session.
    try { return await call({action, token}); }
    catch (error) { token = undefined; throw error; }
  };
}
