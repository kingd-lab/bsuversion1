const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const admin = {role:'Admin', username:'admin', site:'ALL'};
function app() {
  const sheets = new Map(); let failDelete = false, failSalaryAppend = false, uuid = 0;
  class Sheet {
    constructor(rows=[]) { this.rows=rows; }
    appendRow(row) { if(failSalaryAppend && this===sheets.get('Salaries'))throw Error('copy failed'); this.rows.push(row.slice()); }
    setFrozenRows() {}
    getLastRow() { return this.rows.length; }
    getDataRange() { return {getValues:()=>this.rows.map(r=>r.slice())}; }
    getRange(row,col,n=1,width=1) { return {getValues:()=>this.rows.slice(row-1,row-1+n).map(r=>r.slice(col-1,col-1+width)),setFontWeight(){},setNumberFormat(){},setValue:v=>this.rows[row-1][col-1]=v}; }
    deleteRow(index) { if(failDelete){failDelete=false;throw Error('delete interrupted');}this.rows.splice(index-1,1); }
  }
  const headers=['Expense ID','Date','Site','Category','Description','Amount','Payment Method'];
  sheets.set('Expenses',new Sheet([headers,
    ['E1','2026-07-31','MB2','Salary / Allowance','July salary (salary report) [Excavation – Salary / Allowance]',190000,'Cash'],
    ['E2','2026-08-01','MB2','Salary / Allowance','August salary (salary report) [Excavation – Salary / Allowance]',700000,'Cash'],
    ['E3','2026-09-14','MB2','Salary / Allowance','Salary',150000,'Cash'],
    ['E4','2026-09-25','MB2','Salary / Allowance','Salary / Allowance [Excavation – Salary / Allowance]',65000,'Cash'],
    ['E5','2026-07-24','MB2','Excavation of Trenches','Sand Evacuation (5 labourers)',40000,'Cash']]));
  const ctx=vm.createContext({SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:n=>sheets.get(n),insertSheet:n=>{const s=new Sheet();sheets.set(n,s);return s;}}),flush(){}},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},Utilities:{getUuid:()=>String(++uuid)},getSheet:n=>sheets.get(n),SHEET_EXPENSES:'Expenses',rowToObject:(h,r)=>Object.fromEntries(h.map((v,i)=>[v,r[i]])),formatCellDate:String,forcePlainTextDate:(s,r,c,v)=>s.rows[r-1][c-1]=v,logAudit(){}});
  vm.runInContext(fs.readFileSync('bus-version3.6/apps-script/Salaries.gs','utf8'),ctx);
  return {ctx,sheets,failDelete:()=>failDelete=true,failCopy:()=>failSalaryAppend=true};
}
test('preview finds only actual salaries and preserves expenses',()=>{
  const {ctx,sheets}=app(),p=ctx.migrateSalaryExpenses(admin,true);
  assert.equal(p.count,3);assert.equal(p.total,1040000);assert.equal(sheets.get('Expenses').rows.length,6);
});
test('migration archives originals, preserves allowances and excavation, and is repeatable',()=>{
  const {ctx,sheets}=app(),p=ctx.migrateSalaryExpenses(admin,true);
  assert.equal(ctx.migrateSalaryExpenses(admin,false,p.signature).moved,3);
  assert.equal(ctx.getSalaries(admin).total,1040000);
  assert.equal(sheets.get('SalaryExpenseArchive').rows.length,4);
  assert.equal(sheets.get('Expenses').rows.length,3);
  assert.equal(sheets.get('Expenses').rows[1][3],'Salary / Allowance');
  const again=ctx.migrateSalaryExpenses(admin,true);assert.equal(ctx.migrateSalaryExpenses(admin,false,again.signature).moved,0);
});
test('interrupted deletion retries without copying salaries twice',()=>{
  const a=app(),p=a.ctx.migrateSalaryExpenses(admin,true);a.failDelete();
  assert.throws(()=>a.ctx.migrateSalaryExpenses(admin,false,p.signature),/interrupted/);
  const retry=a.ctx.migrateSalaryExpenses(admin,true);a.ctx.migrateSalaryExpenses(admin,false,retry.signature);
  assert.equal(a.ctx.getSalaries(admin).total,1040000);assert.equal(a.sheets.get('SalaryExpenseArchive').rows.length,4);
});
test('copy failure never deletes salary source rows',()=>{
  const a=app(),p=a.ctx.migrateSalaryExpenses(admin,true);a.failCopy();
  assert.throws(()=>a.ctx.migrateSalaryExpenses(admin,false,p.signature),/copy failed/);assert.equal(a.sheets.get('Expenses').rows.length,6);
});
test('stale preview refuses migration',()=>{
  const a=app(),p=a.ctx.migrateSalaryExpenses(admin,true);a.sheets.get('Expenses').rows[1][5]=191000;
  assert.throws(()=>a.ctx.migrateSalaryExpenses(admin,false,p.signature),/Preview again/);
});
test('Admin writes only; manager reads only assigned site; imports skip exact repeats',()=>{
  const {ctx}=app();const row={date:'2026-09-28',site:'MB2',staffName:'PM',salaryMonth:'2026-09',amount:350000};
  assert.throws(()=>ctx.addSalariesBulk({role:'Boss'},[row]),/Access denied/);
  assert.throws(()=>ctx.migrateSalaryExpenses({role:'Site Manager'},true),/Access denied/);
  assert.equal(ctx.addSalariesBulk(admin,[row]).added,1);assert.equal(ctx.addSalariesBulk(admin,[row]).skipped,1);
  assert.equal(ctx.getSalaries({role:'Site Manager',site:'OTHER'}).entries.length,0);
  assert.equal(ctx.getSalaries({role:'Boss'}).total,350000);
});
test('invalid batch fails before writing',()=>{
  const {ctx}=app();assert.throws(()=>ctx.addSalariesBulk(admin,[{date:'2026-09-28',site:'MB2',staffName:'PM',amount:-1}]),/positive amount/);
  assert.equal(ctx.getSalaries(admin).total,0);
});
