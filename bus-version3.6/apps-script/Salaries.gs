const SALARY_HEADERS = ['Salary ID', 'Date', 'Site', 'Staff Name', 'Role', 'Salary Month', 'Amount', 'Payment Method', 'Description', 'Submitted By', 'Timestamp', 'Source Expense ID'];

function setupSalarySheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Salaries');
  if (!sheet) {
    sheet = ss.insertSheet('Salaries');
    sheet.appendRow(SALARY_HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange('A1:L1').setFontWeight('bold');
  }
  if (JSON.stringify(sheet.getRange(1, 1, 1, 12).getValues()[0]) !== JSON.stringify(SALARY_HEADERS)) {
    throw new Error('Salaries headers differ. Keep the existing sheet and correct its headers before continuing.');
  }
  return sheet;
}

function salaryOnly_(entry) {
  if (/^(salary|salaries)$/i.test(String(entry.Category || '').trim())) return true;
  const description = String(entry.Description || '').replace(/\[[^\]]*\]|\([^)]*\)/g, '').trim();
  return /\b(salary|salaries)\b/i.test(description) && !/\ballowance\b/i.test(description);
}

function salaryAccess_(session, write) {
  if (write ? session.role !== 'Admin' : !['Admin', 'Boss', 'Site Manager'].includes(session.role)) throw new Error('Access denied');
}

function salaryRows_() {
  const rows = setupSalarySheet().getDataRange().getValues();
  return rows.slice(1).filter(r => r[0]).map(r => rowToObject(rows[0], r));
}

function getSalaries(session) {
  salaryAccess_(session, false);
  let entries = salaryRows_();
  if (session.role === 'Site Manager') entries = entries.filter(r => r.Site === session.site);
  entries.sort((a, b) => String(b.Date).localeCompare(String(a.Date)));
  return {entries, total: entries.reduce((sum, r) => sum + (Number(r.Amount) || 0), 0)};
}

function salaryKey_(row) {
  return [row.Date, row.Site, row['Staff Name'], row['Salary Month'], row.Amount, row.Description]
    .map(v => String(v == null ? '' : v).trim().toLowerCase()).join('|');
}

function salaryDateValid_(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(date + 'T00:00:00Z');
  return !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function addSalariesBulk(session, entries) {
  salaryAccess_(session, true);
  if (!Array.isArray(entries) || !entries.length || entries.length > 20) throw new Error('Submit 1–20 salary entries per request.');
  const prepared = entries.map(e => {
    const date = String(e.date || '');
    const month = String(e.salaryMonth || date.slice(0, 7));
    const amount = Number(e.amount);
    if (!salaryDateValid_(date) || !salaryDateValid_(month + '-01') || !String(e.staffName || '').trim() || !String(e.site || '').trim() || !Number.isFinite(amount) || amount <= 0) throw new Error('Each salary needs a date, site, staff name, salary month and positive amount.');
    return {'Date': date, 'Site': String(e.site).trim(), 'Staff Name': String(e.staffName).trim(), 'Role': e.role || '', 'Salary Month': month, 'Amount': amount, 'Payment Method': e.paymentMethod || '', 'Description': e.description || ''};
  });
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const sheet = setupSalarySheet();
    const seen = new Set(salaryRows_().map(salaryKey_));
    let added = 0, skipped = 0;
    prepared.forEach(r => {
      const key = salaryKey_(r);
      if (seen.has(key)) { skipped++; return; }
      sheet.appendRow(['SAL-' + Utilities.getUuid(), r.Date, r.Site, r['Staff Name'], r.Role, r['Salary Month'], r.Amount, r['Payment Method'], r.Description, session.username, new Date(), '']);
      const last = sheet.getLastRow();
      forcePlainTextDate(sheet, last, 2, r.Date);
      forcePlainTextDate(sheet, last, 6, r['Salary Month']);
      seen.add(key); added++;
    });
    logAudit(session.username, 'SALARY_IMPORT', added + ' added; ' + skipped + ' existing entries skipped');
    return {success: true, added, skipped};
  } finally { lock.releaseLock(); }
}

// Preview first. Migration preserves full originals in SalaryExpenseArchive.
// Source IDs make retries safe if a request stops after copying a salary.
function migrateSalaryExpenses(session, dryRun, expectedSignature) {
  salaryAccess_(session, true);
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const expenseSheet = getSheet(SHEET_EXPENSES);
    const data = expenseSheet.getDataRange().getValues();
    const candidates = data.slice(1).map((row, i) => ({row, index: i + 2, entry: rowToObject(data[0], row)}))
      .filter(r => r.entry['Expense ID'] && salaryOnly_(r.entry));
    const signature = JSON.stringify(candidates.map(r => [r.entry['Expense ID'], r.entry.Site, r.entry.Date, r.entry.Amount, r.entry.Description]));
    if (dryRun !== false) return {entries: candidates.map(r => r.entry), signature, count: candidates.length, total: candidates.reduce((sum, r) => sum + Number(r.entry.Amount || 0), 0)};
    if (expectedSignature !== signature) throw new Error('Expenses changed. Preview again before moving salaries.');
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const salaries = setupSalarySheet();
    let archive = ss.getSheetByName('SalaryExpenseArchive');
    if (!archive) { archive = ss.insertSheet('SalaryExpenseArchive'); archive.appendRow(data[0]); }
    if (JSON.stringify(archive.getRange(1, 1, 1, data[0].length).getValues()[0]) !== JSON.stringify(data[0])) throw new Error('SalaryExpenseArchive headers differ from Expenses.');
    const copied = new Set(salaryRows_().map(r => String(r['Source Expense ID'])));
    const archived = new Set(archive.getDataRange().getValues().slice(1).map(r => String(r[data[0].indexOf('Expense ID')])));
    candidates.forEach(r => {
      const e = r.entry, id = String(e['Expense ID']);
      if (!archived.has(id)) { archive.appendRow(r.row); archived.add(id); }
      if (!copied.has(id)) {
        const date = formatCellDate(e.Date);
        salaries.appendRow(['SAL-' + Utilities.getUuid(), date, e.Site, 'Staff (aggregated)', '', date.slice(0, 7), e.Amount, e['Payment Method'] || '', e.Description, session.username, new Date(), id]);
        forcePlainTextDate(salaries, salaries.getLastRow(), 2, date);
        forcePlainTextDate(salaries, salaries.getLastRow(), 6, date.slice(0, 7));
        copied.add(id);
      }
    });
    SpreadsheetApp.flush();
    // Delete only after both persistent copies exist, from the bottom upwards.
    candidates.slice().reverse().forEach(r => expenseSheet.deleteRow(r.index));
    logAudit(session.username, 'SALARY_MIGRATION', candidates.length + ' salary expenses moved; originals archived');
    return {success: true, moved: candidates.length};
  } finally { lock.releaseLock(); }
}
