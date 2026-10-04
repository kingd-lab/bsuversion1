(async function () {
  const user = await Auth.requireRole(['Admin', 'Boss', 'Site Manager']);
  if (!user) return;
  Layout.build('salaries.html', user);
  Layout.mainMount().innerHTML = document.getElementById('pageContent').innerHTML;
  const el = id => document.getElementById(id);
  el('menuBtn').addEventListener('click', Layout.toggleSidebar);
  let entries = [], previewSignature = null, busy = false;
  const money = n => '₦' + Number(n || 0).toLocaleString();
  const headers = ['Date', 'Site', 'Staff Name', 'Role', 'Salary Month', 'Amount', 'Payment Method', 'Description'];
  function notify(message) { el('toast').textContent = message; el('toast').className = 'toast show'; setTimeout(() => el('toast').className = 'toast', 6000); }
  async function request(action, data) {
    const url = new URL(API_URL), token = localStorage.getItem('sems_token') || '';
    if (data) url.searchParams.set('payload', JSON.stringify({action, token, ...data}));
    else { url.searchParams.set('action', action); url.searchParams.set('token', token); }
    const res = await fetch(url), result = await res.json();
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
    el('salaryImport').onclick = () => run(async () => {
      const file = el('salaryFile').files[0]; if (!file) throw new Error('Select a salary file.');
      const w = XLSX.read(await file.arrayBuffer(), {type:'array'}), sheet = w.Sheets[w.SheetNames[0]], grid = XLSX.utils.sheet_to_json(sheet, {header:1});
      if (!headers.every((h, i) => String((grid[0] || [])[i] || '').trim() === h)) throw new Error('Use the salary template column headings.');
      const imported = XLSX.utils.sheet_to_json(sheet, {defval:''}).map(r => ({date:isoDate(r.Date),site:String(r.Site).trim(),staffName:String(r['Staff Name']).trim(),role:r.Role,salaryMonth:isoDate(r['Salary Month']).slice(0,7),amount:Number(String(r.Amount).replace(/,/g,'')),paymentMethod:r['Payment Method'],description:r.Description}));
      if (!imported.length || imported.some(r => !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !/^\d{4}-\d{2}$/.test(r.salaryMonth) || !r.site || !r.staffName || !Number.isFinite(r.amount) || r.amount <= 0)) throw new Error('Check dates, months, site, staff name and amounts before importing.');
      if (!confirm(`Import ${imported.length} salary entries totalling ${money(imported.reduce((sum,r)=>sum+r.amount,0))}?`)) return;
      let added=0, skipped=0; for (let i=0;i<imported.length;i+=10) {const r=await request('addSalariesBulk',{entries:imported.slice(i,i+10)});added+=r.added;skipped+=r.skipped;}
      notify(`${added} added; ${skipped} existing entries skipped.`); await load();
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
