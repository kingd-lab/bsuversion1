(async function () {
  const user = await Auth.requireRole(['Admin', 'Boss', 'Site Manager']);
  if (!user) return;
  Layout.build('salaries.html', user);
  Layout.mainMount().innerHTML = document.getElementById('pageContent').innerHTML;
  const el = id => document.getElementById(id);
  el('menuBtn').addEventListener('click', Layout.toggleSidebar);
  let entries = [], previewSignature = null, busy = false, pendingImport = [];
  const money = n => '₦' + Number(n || 0).toLocaleString();
  const headers = ['Date', 'Site', 'Staff Name', 'Role', 'Salary Month', 'Amount', 'Payment Method', 'Description'];
  function notify(message) { if (el('salaryStatus')) { el('salaryStatus').textContent = message; el('salaryStatus').hidden = false; } el('toast').textContent = message; el('toast').className = 'toast show'; setTimeout(() => el('toast').className = 'toast', 6000); }
  async function request(action, data) {
    const url = new URL(API_URL), token = localStorage.getItem('sems_token') || '';
    if (data) url.searchParams.set('payload', JSON.stringify({action, token, ...data}));
    else { url.searchParams.set('action', action); url.searchParams.set('token', token); }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    let result;
    try { const res = await fetch(url, {signal:controller.signal}); if(!res.ok) throw new Error('Server request failed: ' + res.status); result = await res.json(); }
    catch(err) { if(err.name === 'AbortError') throw new Error('Request timed out. Check the salary ledger before retrying.'); throw err; }
    finally { clearTimeout(timer); }
    if (result.error) throw new Error(result.error);
    return result;
  }
  function rowsInto(id, rows) {
    el(id).replaceChildren();
    for (const values of rows) { const tr = document.createElement('tr'); for (const value of values) { const td = document.createElement('td'); td.textContent = value == null ? '' : value; tr.appendChild(td); } el(id).appendChild(tr); }
  }
  function selected() { return entries.filter(r => (!el('salarySiteFilter').value || r.Site === el('salarySiteFilter').value) && (!el('salaryMonthFilter').value || r['Salary Month'] === el('salaryMonthFilter').value)); }
  function render() { const rows = selected(); el('salaryTotal').textContent = money(rows.reduce((sum, r) => sum + Number(r.Amount || 0), 0)); rowsInto('salaryRows', rows.map(r => headers.map(h => h === 'Amount' ? money(r[h]) : r[h]))); }
  async function load() { entries = (await request('getSalaries')).entries || []; render(); }
  async function run(task) { if (busy) return; busy = true; try { await task(); } catch (err) { notify(err.message); } finally { busy = false; } }
  function download(rows, name) { const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers, ...rows]), 'Salaries'); XLSX.writeFile(workbook, name); }
  function isoDate(v) { if (typeof v === 'number') { const d = XLSX.SSF.parse_date_code(v); return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`; } return String(v || '').trim(); }
  function signature(result) { return result.signature; }
  el('salarySiteFilter').onchange = render; el('salaryMonthFilter').onchange = render;
  el('exportSalaries').onclick = () => download(selected().map(r => headers.map(h => r[h])), 'Salaries.xlsx');
  if (user.role === 'Admin') {
    el('salaryAdmin').hidden = false;
    el('salaryForm').onsubmit = event => { event.preventDefault(); run(async () => { const data = Object.fromEntries(new FormData(event.target)); data.amount = Number(data.amount); const result = await request('addSalariesBulk', {entries: [data]}); notify(`${result.added} added; ${result.skipped} existing entries skipped.`); event.target.reset(); await load(); }); };
    el('salaryTemplate').onclick = () => download([], 'Salary_Import_Template.xlsx');
    async function previewImport() {
      pendingImport = []; el('salaryConfirmImport').hidden = true; el('salaryImportPreview').hidden = true;
      const file = el('salaryFile').files[0]; if (!file) throw new Error('Select a salary file.');
      notify('Reading ' + file.name + '…');
      if (typeof XLSX === 'undefined') throw new Error('Excel reader could not load. Refresh with an internet connection and try again.');
      const w = XLSX.read(await file.arrayBuffer(), {type:'array'}), sheet = w.Sheets[w.SheetNames[0]], grid = XLSX.utils.sheet_to_json(sheet, {header:1});
      if (!headers.every((h, i) => String((grid[0] || [])[i] || '').trim() === h)) throw new Error('Use the salary template column headings.');
      const imported = XLSX.utils.sheet_to_json(sheet, {defval:''}).map(r => ({date:isoDate(r.Date),site:String(r.Site).trim(),staffName:String(r['Staff Name']).trim(),role:r.Role,salaryMonth:isoDate(r['Salary Month']).slice(0,7),amount:Number(String(r.Amount).replace(/,/g,'')),paymentMethod:r['Payment Method'],description:r.Description}));
      if (!imported.length || imported.some(r => !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !/^\d{4}-\d{2}$/.test(r.salaryMonth) || !r.site || !r.staffName || !Number.isFinite(r.amount) || r.amount <= 0)) throw new Error('Check dates, months, site, staff name and amounts before importing.');
      pendingImport = imported;
      rowsInto('salaryImportRows', imported.map(r=>[r.date,r.staffName,r.role,money(r.amount),r.description]));
      el('salaryImportPreview').hidden = false; el('salaryConfirmImport').hidden = false;
      notify(imported.length + ' entries ready, total ' + money(imported.reduce((sum,r)=>sum+r.amount,0)) + '. Review and click Confirm salary import.');
    }
    el('salaryFile').onchange = () => run(previewImport);
    el('salaryImport').onclick = () => run(previewImport);
    el('salaryConfirmImport').onclick = () => run(async () => {
      if (!pendingImport.length) throw new Error('Choose a file and preview it first.');
      el('salaryConfirmImport').disabled = true;
      let added=0, skipped=0;
      try {
        for (let i=0;i<pendingImport.length;i+=10) {
          notify('Saving salary entries ' + (i+1) + '–' + Math.min(i+10,pendingImport.length) + '…');
          const r=await request('addSalariesBulk',{entries:pendingImport.slice(i,i+10)});
          if(!r.success || !Number.isFinite(r.added) || !Number.isFinite(r.skipped)) throw new Error('Unexpected backend response. Update Code.gs and Salaries.gs, deploy a new Apps Script version, then check the ledger before retrying.');
          added+=r.added;skipped+=r.skipped;
        }
        pendingImport=[];el('salaryConfirmImport').hidden=true;await load();
        notify(added + ' salaries saved; ' + skipped + ' existing entries skipped. Salary list refreshed.');
      } finally { el('salaryConfirmImport').disabled = false; }
    });
    el('salaryPreview').onclick = () => run(async () => { const r = await request('migrateSalaryExpenses', {dryRun:true}); previewSignature = signature(r); rowsInto('migrationRows', r.entries.map(e=>[e.Date,e.Site,e.Description,money(e.Amount)])); el('migrationSummary').textContent = `${r.count} existing salaries: ${money(r.total)}. Review before moving.`; el('salaryMigrate').hidden = !r.count; });
    el('salaryMigrate').onclick = () => run(async () => { const r=await request('migrateSalaryExpenses',{dryRun:true}); if(signature(r)!==previewSignature) throw new Error('Expenses changed. Preview again before moving.'); if(!confirm(`Move ${r.count} salary entries (${money(r.total)}) from Expenses to Salaries and archive originals?`)) return; const result=await request('migrateSalaryExpenses',{dryRun:false,expectedSignature:previewSignature});notify(`${result.moved} salaries moved.`);el('salaryMigrate').hidden=true;previewSignature=null;await load(); });
  }
  try {
    const data = await Api.getSites();
    for (const site of data.sites || []) { const name=site['Site Name']; if(!name || (user.role==='Site Manager' && name!==user.site))continue; for(const id of ['salarySite','salarySiteFilter']){const option=document.createElement('option');option.value=name;option.textContent=name;el(id).appendChild(option);} }
    await load();
  } catch(err) { notify(err.message); }
})();
