/**
 * final-report.js — powers final-report.html (Admin & Boss only).
 *
 * Updated for the current category taxonomy:
 * - Block Setting -> Concrete Works
 * - Hollow Filling -> Concrete Works
 * - Sharp Sand and Plaster Sand are kept as Block Production leaf categories
 * - Sand reporting separates Block Production sand from standalone / other sand
 * - Financial totals are calculated from Expenses only; normalized sand data
 *   is used for sand-specific reporting and is never added to grand totals again
 *
 * The Excel export mirrors the in-app report and includes separate sand detail
 * sheets for Block Production and Other/Standalone Sand.
 */
(function () {
  // The report normally reads the shared taxonomy from js/categories.js.
  // This fallback prevents the Final Report from crashing when an older or
  // malformed categories.js is cached/deployed. The client categories.js
  // supplied with this update remains the primary source.
  const REPORT_CATEGORY_GROUPS = (typeof CATEGORY_GROUPS !== 'undefined')
    ? CATEGORY_GROUPS
    : {
        'Accommodation': ['Hotel Accommodation', 'House Rent', 'House Cleaning', 'House Setup Materials'],
        'Block Production': ['Store Construction', 'Cement', 'Burnt Bricks', 'Water Supply', 'Sharp Sand', 'Plaster Sand', 'Block Moulding Labour', 'Block Production'],
        'Main Work': ['Chemical', 'Setting Out Materials', 'Security', 'PPE & Safety Equipment', 'Granite', 'Site Office'],
        'Excavation of Trenches': ['Excavation of Trenches', 'Excavation Equipment Hire'],
        'Concrete Works': [
          'Column Blinding', 'Column Base', 'Trenches Casting', 'Columns Before Slab',
          'Slab', 'Kickers', 'Column on Slab', 'Lintel', 'Beams & First Floor Slab',
          'First Floor Columns', 'First Floor Lintel', 'Roof Beam', 'Mason/Poker Labour',
          'Poker Rental', 'Bentonite', 'Block Setting', 'Hollow Filling'
        ],
        'Transportation of Tools': ['Transportation of Tools', 'Fuel for Transportation'],
        'Ach Shittu Materials': ['Ach Shittu Materials (Bulk Purchase)'],
        'Workmanship': ['Mason', 'Carpenter', 'Electrician', 'Plumber', 'Welder', 'Painter', 'General Labour', 'Workmanship (Other)'],
        'Other Expenses': [
          'Iron Rods', 'Timber', 'Roofing Materials', 'Paint', 'Tiles', 'Plumbing Materials',
          'Electrical Materials', 'Doors & Windows', 'Glass & Aluminium', 'Blocks', 'Bricks',
          'Generator Fuel', 'Diesel', 'Petrol', 'Internet & Communication', 'Equipment Hire',
          'Machinery Repair', 'Tool Purchase', 'Haulage', 'Loading & Offloading', 'Site Cleaning',
          'Office Supplies', 'Waste Disposal', 'Miscellaneous'
        ]
      };
  const REPORT_CATEGORY_FLAT = Object.values(REPORT_CATEGORY_GROUPS).flat();
  const REPORT_CATEGORY_GROUP_OF = {};
  Object.keys(REPORT_CATEGORY_GROUPS).forEach(group => {
    REPORT_CATEGORY_GROUPS[group].forEach(category => {
      REPORT_CATEGORY_GROUP_OF[category] = group;
    });
  });
  const REPORT_CATEGORY_GROUP_ORDER = Object.keys(REPORT_CATEGORY_GROUPS);

  let currentUser = null;
  let allExpenses = [];
  let bpEntries = [];
  let byGroup = {};
  let sandEntries = [];
  let sandLoaded = false;

  function showToast(msg, type) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show' + (type ? ' ' + type : '');
    setTimeout(() => t.classList.remove('show'), 3200);
  }

  function money(n) {
    return '\u20a6' + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  function fmtDate(v) {
    const d = parseLocalDate(v);
    if (isNaN(d)) return String(v || '\u2014');
    return d.toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  }

  function periodKey(v) {
    const d = parseLocalDate(v);
    if (isNaN(d)) return 'Unknown';
    return d.toLocaleDateString(undefined, {
      month: 'short', year: 'numeric'
    });
  }

  async function init() {
    currentUser = await Auth.requireRole(['Boss', 'Admin']);
    if (!currentUser) return;

    Layout.build('final-report.html', currentUser);
    Layout.mainMount().innerHTML = document.getElementById('pageContent').innerHTML;
    document.getElementById('menuBtn')?.addEventListener('click', Layout.toggleSidebar);

    try {
      const [expData, bpData, sandData] = await Promise.all([
        Api.getExpenses(),
        Api.getBlockProduction(),
        Api.getSandEntries().catch(() => null)
      ]);

      allExpenses = expData.expenses || [];
      bpEntries = bpData.entries || [];
      sandLoaded = !!sandData;
      sandEntries = sandData ? (sandData.entries || []) : [];

      groupExpenses();
      renderSummary();
      renderByPeriod();
      renderBlockProductionBreakdown();
      renderConcreteBreakdown();
      renderSandBreakdown();
      populateDetailSelect();
      wireDetailSelect();
      wireDownload();

      if (currentUser.role === 'Admin') initRecategorizeCard();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function groupExpenses() {
    byGroup = {};

    allExpenses.forEach(e => {
      const g = REPORT_CATEGORY_GROUP_OF[e.Category] || 'Other Expenses';
      (byGroup[g] = byGroup[g] || []).push(e);
    });

    Object.values(byGroup).forEach(rows => {
      rows.sort((a, b) => parseLocalDate(a.Date) - parseLocalDate(b.Date));
    });
  }

  function blockProductionSplit() {
    const rows = byGroup['Block Production'] || [];
    const autoLog = rows.filter(e => e['Payment Method'] === 'Auto (Production Log)');
    const manual = rows.filter(e => e['Payment Method'] !== 'Auto (Production Log)');
    return { autoLog, manual };
  }

  function renderSummary() {
    let grandTotal = 0;
    let grandCount = 0;

    REPORT_CATEGORY_GROUP_ORDER.forEach(g => {
      const rows = byGroup[g] || [];
      grandTotal += rows.reduce((s, e) => s + (Number(e.Amount) || 0), 0);
      grandCount += rows.length;
    });

    const excavationTotal = (byGroup['Excavation of Trenches'] || [])
      .reduce((s, e) => s + (Number(e.Amount) || 0), 0);

    const concreteTotal = (byGroup['Concrete Works'] || [])
      .reduce((s, e) => s + (Number(e.Amount) || 0), 0);

    document.getElementById('summaryRows').innerHTML = REPORT_CATEGORY_GROUP_ORDER.map(g => {
      const rows = byGroup[g] || [];
      const total = rows.reduce((s, e) => s + (Number(e.Amount) || 0), 0);
      const pct = grandTotal > 0 ? (total / grandTotal * 100) : 0;
      return `<tr><td>${g}</td><td><strong>${money(total)}</strong></td><td>${pct.toFixed(1)}%</td></tr>`;
    }).join('');

    document.getElementById('foundationSubtotal').textContent =
      `${money(excavationTotal + concreteTotal)} (Excavation of Trenches + Concrete Works)`;

    document.getElementById('grandTotal').textContent = money(grandTotal);

    let latestDate = null;
    allExpenses.forEach(e => {
      const d = parseLocalDate(e.Date);
      if (!isNaN(d) && (!latestDate || d > latestDate)) latestDate = d;
    });

    document.getElementById('reportMeta').textContent =
      `${grandCount} transactions · data through ${latestDate ? fmtDate(latestDate) : '—'} · generated ${new Date().toLocaleDateString()}`;
  }

  function renderByPeriod() {
    const periods = {};

    REPORT_CATEGORY_GROUP_ORDER.forEach(g => {
      (byGroup[g] || []).forEach(e => {
        const key = periodKey(e.Date);
        periods[key] = periods[key] || {};
        periods[key][g] = (periods[key][g] || 0) + (Number(e.Amount) || 0);
      });
    });

    const sortedKeys = Object.keys(periods)
      .sort((a, b) => new Date('1 ' + a) - new Date('1 ' + b));

    document.getElementById('byPeriodHead').innerHTML =
      ['Period', ...REPORT_CATEGORY_GROUP_ORDER, 'Total']
        .map(h => `<th>${h}</th>`).join('');

    const totals = {};
    let grand = 0;

    const rowsHtml = sortedKeys.map(key => {
      let rowTotal = 0;

      const cells = REPORT_CATEGORY_GROUP_ORDER.map(g => {
        const v = (periods[key] && periods[key][g]) || 0;
        rowTotal += v;
        totals[g] = (totals[g] || 0) + v;
        return `<td>${money(v)}</td>`;
      }).join('');

      grand += rowTotal;
      return `<tr><td><strong>${key}</strong></td>${cells}<td><strong>${money(rowTotal)}</strong></td></tr>`;
    }).join('');

    const totalRow = `<tr style="font-weight:700;border-top:2px solid var(--color-border);">
      <td>TOTAL</td>
      ${REPORT_CATEGORY_GROUP_ORDER.map(g => `<td>${money(totals[g] || 0)}</td>`).join('')}
      <td>${money(grand)}</td>
    </tr>`;

    document.getElementById('byPeriodRows').innerHTML = rowsHtml + totalRow;
  }

  function renderBlockProductionBreakdown() {
    const { autoLog, manual } = blockProductionSplit();
    const autoTotal = autoLog.reduce((s, e) => s + (Number(e.Amount) || 0), 0);
    const manualTotal = manual.reduce((s, e) => s + (Number(e.Amount) || 0), 0);

    document.getElementById('blockProdRows').innerHTML = `
      <tr><td>Production of Blocks (auto-logged)</td><td>${autoLog.length}</td><td>${money(autoTotal)}</td></tr>
      <tr><td>Block Production Expenses (manual)</td><td>${manual.length}</td><td>${money(manualTotal)}</td></tr>
      <tr style="font-weight:700;border-top:2px solid var(--color-border);"><td>TOTAL</td><td>${autoLog.length + manual.length}</td><td>${money(autoTotal + manualTotal)}</td></tr>
    `;
  }

  // ---------------- Concrete Works ----------------
  // The updated Categories.gs places Block Setting and Hollow Filling
  // inside REPORT_CATEGORY_GROUPS['Concrete Works']. This report therefore picks
  // them up automatically through CATEGORY_GROUP_OF and CATEGORY_GROUPS.
  function concreteBreakdown() {
    const rows = byGroup['Concrete Works'] || [];
    const by = {};

    REPORT_CATEGORY_GROUPS['Concrete Works'].forEach(c => {
      by[c] = { count: 0, total: 0 };
    });

    rows.forEach(e => {
      const k = e.Category;
      by[k] = by[k] || { count: 0, total: 0 };
      by[k].count += 1;
      by[k].total += Number(e.Amount) || 0;
    });

    const total = rows.reduce((s, e) => s + (Number(e.Amount) || 0), 0);

    const list = Object.keys(by)
      .filter(k => by[k].count > 0)
      .sort((a, b) => by[b].total - by[a].total)
      .map(k => ({
        name: k,
        count: by[k].count,
        total: by[k].total,
        pct: total > 0 ? by[k].total / total : 0
      }));

    return { list, total, count: rows.length };
  }

  function renderConcreteBreakdown() {
    const { list, total, count } = concreteBreakdown();

    const body = list.map(r =>
      `<tr><td>${r.name}</td><td>${r.count}</td><td>${money(r.total)}</td><td>${(r.pct * 100).toFixed(1)}%</td></tr>`
    ).join('') || '<tr><td colspan="4">No Concrete Works transactions yet.</td></tr>';

    document.getElementById('concreteRows').innerHTML = body +
      `<tr style="font-weight:700;border-top:2px solid var(--color-border);"><td>TOTAL CONCRETE WORKS</td><td>${count}</td><td>${money(total)}</td><td>${total > 0 ? '100.0%' : '—'}</td></tr>`;
  }

  // ---------------- Sand ----------------
  // IMPORTANT: normalized sand entries are reporting/index rows only.
  // Financial totals are calculated from Expenses and are not increased here.
  function sandTypeOf(e) {
    const category = String(e['Sand Type'] || e.Category || '').trim().toLowerCase();
    const desc = String(e.Description || '').trim().toLowerCase();
    const combined = category + ' ' + desc;

    if (combined.indexOf('plaster') !== -1) return 'Plaster Sand';
    if (combined.indexOf('sharp') !== -1) return 'Sharp Sand';
    return 'Other Sand';
  }

  function sandOriginOf(e) {
    const origin = String(e.Origin || '').trim().toLowerCase();
    if (origin.indexOf('block production') !== -1) return 'Block Production';
    return 'Standalone / Other Sand';
  }

  function sandRowsByOrigin(origin) {
    return sandEntries.filter(e => sandOriginOf(e) === origin);
  }

  function sandBreakdown() {
    const total = sandEntries.reduce((s, e) => s + (Number(e.Amount) || 0), 0);

    const group = (keyFn) => {
      const m = {};

      sandEntries.forEach(e => {
        const k = keyFn(e);
        m[k] = m[k] || { count: 0, qty: 0, total: 0 };
        m[k].count += 1;
        m[k].qty += Number(e.Quantity) || 0;
        m[k].total += Number(e.Amount) || 0;
      });

      return Object.keys(m)
        .sort((a, b) => m[b].total - m[a].total)
        .map(k => ({
          name: k,
          count: m[k].count,
          qty: m[k].qty,
          total: m[k].total,
          pct: total > 0 ? m[k].total / total : 0
        }));
    };

    return {
      total,
      count: sandEntries.length,
      byType: group(sandTypeOf),
      bySource: group(sandOriginOf)
    };
  }

  function renderSandBreakdown() {
    const b = sandBreakdown();

    document.getElementById('sandNote').textContent = sandLoaded
      ? `${b.count} sand transactions · ${sandRowsByOrigin('Block Production').length} block-production · ${sandRowsByOrigin('Standalone / Other Sand').length} other/standalone`
      : 'Sand data unavailable — redeploy the updated backend (Code.gs)';

    const empty = (cols) => `<tr><td colspan="${cols}">No sand transactions yet.</td></tr>`;

    document.getElementById('sandTypeRows').innerHTML = b.byType.length
      ? b.byType.map(r =>
          `<tr><td>${r.name}</td><td>${r.count}</td><td>${r.qty || '—'}</td><td>${money(r.total)}</td><td>${(r.pct * 100).toFixed(1)}%</td></tr>`
        ).join('') +
        `<tr style="font-weight:700;border-top:2px solid var(--color-border);"><td>TOTAL SAND</td><td>${b.count}</td><td>${b.byType.reduce((s, r) => s + r.qty, 0) || '—'}</td><td>${money(b.total)}</td><td>100.0%</td></tr>`
      : empty(5);

    document.getElementById('sandSourceRows').innerHTML = b.bySource.length
      ? b.bySource.map(r => `<tr><td>${r.name}</td><td>${r.count}</td><td>${money(r.total)}</td></tr>`).join('')
      : empty(3);

    document.getElementById('sandDetailRows').innerHTML = sandEntries.length
      ? sandEntries.map(e =>
          `<tr><td>${fmtDate(e.Date)}</td><td>${sandTypeOf(e)}</td><td>${e.Description || '—'}</td><td>${sandOriginOf(e)}</td><td>${e.Quantity || '—'}</td><td><strong>${money(e.Amount)}</strong></td></tr>`
        ).join('')
      : empty(6);
  }

  function populateDetailSelect() {
    const sel = document.getElementById('detailGroupSelect');
    sel.innerHTML = REPORT_CATEGORY_GROUP_ORDER
      .map(g => `<option value="${g}">${g}</option>`).join('');
    renderDetail(sel.value);
  }

  function renderDetail(group) {
    const rows = byGroup[group] || [];
    const tbody = document.getElementById('detailRows');
    const empty = document.getElementById('detailEmpty');

    if (!rows.length) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      return;
    }

    empty.style.display = 'none';

    tbody.innerHTML = rows.map(e => `
      <tr>
        <td>${fmtDate(e.Date)}</td>
        <td><span class="badge">${e.Category}</span></td>
        <td>${e.Description || ''}</td>
        <td>${e.Vendor || '—'}</td>
        <td><strong>${money(e.Amount)}</strong></td>
        <td>${e['Payment Method'] || '—'}</td>
      </tr>
    `).join('') + `
      <tr style="font-weight:700;border-top:2px solid var(--color-border);">
        <td colspan="4">TOTAL</td>
        <td>${money(rows.reduce((s, e) => s + (Number(e.Amount) || 0), 0))}</td>
        <td></td>
      </tr>
    `;
  }

  function wireDetailSelect() {
    document.getElementById('detailGroupSelect')
      .addEventListener('change', e => renderDetail(e.target.value));
  }

  // ---------------------------------------------------------------
  // Excel export
  // ---------------------------------------------------------------
  function wireDownload() {
    document.getElementById('downloadExcelBtn').addEventListener('click', () => {
      try {
        buildAndDownloadWorkbook();
        showToast('Report downloaded', 'success');
      } catch (err) {
        showToast('Export failed: ' + err.message, 'error');
      }
    });
  }

  function sheetSafeName(name) {
    return name.replace(/[:\\/?*\[\]]/g, '').slice(0, 31);
  }

  const NGN = '"\u20a6"#,##0';

  function setCurrency(ws, refs) {
    refs.forEach(([r, c]) => {
      const ref = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 });
      if (ws[ref]) ws[ref].z = NGN;
    });
  }

  function buildDetailSheetAoa(title, subtitle, rows) {
    const aoa = [];
    const currency = [];

    aoa.push([title]);
    aoa.push([subtitle]);
    aoa.push([]);
    aoa.push(['Date', 'Detail Category', 'Description', 'Vendor', 'Amount (\u20a6)', 'Payment Method']);

    rows.forEach(e => {
      aoa.push([
        fmtDate(e.Date),
        e.Category,
        e.Description || '',
        e.Vendor || '',
        Number(e.Amount) || 0,
        e['Payment Method'] || ''
      ]);
      currency.push([aoa.length, 5]);
    });

    const total = rows.reduce((s, e) => s + (Number(e.Amount) || 0), 0);
    aoa.push(['', '', '', 'TOTAL', total, '']);
    currency.push([aoa.length, 5]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
      { wch: 16 }, { wch: 24 }, { wch: 55 },
      { wch: 24 }, { wch: 16 }, { wch: 18 }
    ];
    setCurrency(ws, currency);
    return ws;
  }

  function buildSandDetailSheetAoa(title, subtitle, rows) {
    const aoa = [
      [title],
      [subtitle],
      [],
      ['Date', 'Sand Type', 'Description', 'Source', 'Quantity', 'Unit', 'Vendor', 'Amount (\u20a6)', 'Payment Method']
    ];
    const currency = [];

    rows.slice().sort((a, b) => parseLocalDate(a.Date) - parseLocalDate(b.Date)).forEach(e => {
      aoa.push([
        fmtDate(e.Date),
        sandTypeOf(e),
        e.Description || '',
        sandOriginOf(e),
        Number(e.Quantity) || '',
        e.Unit || '',
        e.Vendor || '',
        Number(e.Amount) || 0,
        e['Payment Method'] || ''
      ]);
      currency.push([aoa.length, 8]);
    });

    const total = rows.reduce((s, e) => s + (Number(e.Amount) || 0), 0);
    aoa.push(['', '', '', '', '', '', 'TOTAL', total, '']);
    currency.push([aoa.length, 8]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
      { wch: 16 }, { wch: 16 }, { wch: 40 }, { wch: 28 },
      { wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 16 }, { wch: 16 }
    ];
    setCurrency(ws, currency);
    return ws;
  }

  function buildAndDownloadWorkbook() {
    const wb = XLSX.utils.book_new();
    const reportDate = new Date().toLocaleDateString(undefined, {
      day: 'numeric', month: 'long', year: 'numeric'
    });

    let latestDate = null;
    allExpenses.forEach(e => {
      const d = parseLocalDate(e.Date);
      if (!isNaN(d) && (!latestDate || d > latestDate)) latestDate = d;
    });
    const latestStr = latestDate ? fmtDate(latestDate) : 'unknown';

    let grandTotal = 0;
    let grandCount = 0;

    REPORT_CATEGORY_GROUP_ORDER.forEach(g => {
      const rows = byGroup[g] || [];
      grandTotal += rows.reduce((s, e) => s + (Number(e.Amount) || 0), 0);
      grandCount += rows.length;
    });

    const excavationTotal = (byGroup['Excavation of Trenches'] || [])
      .reduce((s, e) => s + (Number(e.Amount) || 0), 0);

    const concreteTotal = (byGroup['Concrete Works'] || [])
      .reduce((s, e) => s + (Number(e.Amount) || 0), 0);

    // ---- Summary ----
    const sumAoa = [];
    const sumCur = [];

    sumAoa.push(['SITE EXPENSE REPORT — SUMMARY']);
    sumAoa.push([`Site Expense Manager | Report date: ${reportDate} | ${grandCount} transactions | Data recorded through ${latestStr}`]);
    sumAoa.push(['Controlling source: live app Expenses ledger. Sand detail sheets use normalized sand records only for classification/detail and do not add to financial totals again.']);
    sumAoa.push([]);
    sumAoa.push(['Category', 'Total Amount (\u20a6)', '% of Total']);

    REPORT_CATEGORY_GROUP_ORDER.forEach(g => {
      const total = (byGroup[g] || []).reduce((s, e) => s + (Number(e.Amount) || 0), 0);
      sumAoa.push([g, total, grandTotal > 0 ? total / grandTotal : 0]);
      sumCur.push([sumAoa.length, 2]);
    });

    sumAoa.push([]);
    sumAoa.push(['EXCAVATION / FOUNDATION SUBTOTAL (CONTROL)']);
    sumAoa.push(['Excavation of Trenches + Concrete Works (includes column base work & materials)', '', excavationTotal + concreteTotal]);
    sumCur.push([sumAoa.length, 3]);

    sumAoa.push([]);
    sumAoa.push(['GRAND TOTAL', grandTotal]);
    sumCur.push([sumAoa.length, 2]);

    const sumWs = XLSX.utils.aoa_to_sheet(sumAoa);
    sumWs['!cols'] = [{ wch: 50 }, { wch: 18 }, { wch: 12 }];
    setCurrency(sumWs, sumCur);

    for (let i = 5; i <= 4 + REPORT_CATEGORY_GROUP_ORDER.length; i++) {
      const ref = XLSX.utils.encode_cell({ r: i - 1, c: 2 });
      if (sumWs[ref]) sumWs[ref].z = '0.0%';
    }

    XLSX.utils.book_append_sheet(wb, sumWs, 'Summary');

    // ---- By Period ----
    const periods = {};

    REPORT_CATEGORY_GROUP_ORDER.forEach(g => {
      (byGroup[g] || []).forEach(e => {
        const key = periodKey(e.Date);
        periods[key] = periods[key] || {};
        periods[key][g] = (periods[key][g] || 0) + (Number(e.Amount) || 0);
      });
    });

    const sortedKeys = Object.keys(periods)
      .sort((a, b) => new Date('1 ' + a) - new Date('1 ' + b));

    const bpAoa = [];
    const bpCur = [];

    bpAoa.push(['SITE EXPENSES — BY PERIOD']);
    bpAoa.push([]);
    bpAoa.push(['Period', ...REPORT_CATEGORY_GROUP_ORDER, 'Total']);

    const periodTotals = {};
    let grand = 0;

    sortedKeys.forEach(key => {
      let rowTotal = 0;
      const row = [key];

      REPORT_CATEGORY_GROUP_ORDER.forEach(g => {
        const v = (periods[key] && periods[key][g]) || 0;
        row.push(v);
        rowTotal += v;
        periodTotals[g] = (periodTotals[g] || 0) + v;
      });

      row.push(rowTotal);
      grand += rowTotal;
      bpAoa.push(row);

      for (let c = 2; c <= REPORT_CATEGORY_GROUP_ORDER.length + 2; c++) {
        bpCur.push([bpAoa.length, c]);
      }
    });

    const totalRow = [
      'TOTAL',
      ...REPORT_CATEGORY_GROUP_ORDER.map(g => periodTotals[g] || 0),
      grand
    ];
    bpAoa.push(totalRow);

    for (let c = 2; c <= REPORT_CATEGORY_GROUP_ORDER.length + 2; c++) {
      bpCur.push([bpAoa.length, c]);
    }

    const bpWs = XLSX.utils.aoa_to_sheet(bpAoa);
    bpWs['!cols'] = [
      { wch: 15 },
      ...REPORT_CATEGORY_GROUP_ORDER.map(() => ({ wch: 19 })),
      { wch: 19 }
    ];
    setCurrency(bpWs, bpCur);
    XLSX.utils.book_append_sheet(wb, bpWs, 'By Period');

    // ---- Block Production Log ----
    const logAoa = [];
    logAoa.push(['BLOCK PRODUCTION LOG']);
    logAoa.push([`Production records in source ledger | Report date: ${reportDate}`]);
    logAoa.push(['S/N', 'Date', 'Cement Bags', 'Blocks Produced']);

    bpEntries.slice()
      .sort((a, b) => parseLocalDate(a.Date) - parseLocalDate(b.Date))
      .forEach((e, i) => {
        logAoa.push([
          i + 1,
          fmtDate(e.Date),
          Number(e['Cement (Bags)']) || 0,
          Number(e['Blocks Produced']) || 0
        ]);
      });

    const logWs = XLSX.utils.aoa_to_sheet(logAoa);
    logWs['!cols'] = [{ wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, logWs, 'Block Production Log');

    // ---- Block Production Summary ----
    const totalBags = bpEntries.reduce((s, e) => s + (Number(e['Cement (Bags)']) || 0), 0);
    const totalBlocks = bpEntries.reduce((s, e) => s + (Number(e['Blocks Produced']) || 0), 0);
    const avgPerBag = totalBags > 0 ? totalBlocks / totalBags : 0;

    const bpsAoa = [
      ['BLOCK PRODUCTION SUMMARY'],
      [`Production analysis from recorded Block Production transactions | Report date: ${reportDate}`],
      ['Metric', 'Value', 'Unit', 'Remarks'],
      ['Production Batches', bpEntries.length, 'Batches', 'Recorded production entries'],
      ['Total Cement Used', totalBags, 'Bags', 'From production log'],
      ['Total Blocks Produced', totalBlocks, 'Blocks', 'From production log'],
      ['Average Blocks per Bag', Math.round(avgPerBag * 100) / 100, 'Blocks/Bag', 'Weighted average']
    ];

    const bpsWs = XLSX.utils.aoa_to_sheet(bpsAoa);
    bpsWs['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, bpsWs, 'Block Production Summary');

    // ---- Sand Purchase Detail — Block Production ----
    // Categories are case-sensitive in the stored ledger. Use the exact
    // updated taxonomy name: "Plaster Sand", not the old "plaster Sand".
    const blockSandEntries = sandRowsByOrigin('Block Production');
    const spAoa = [
      ['SAND PURCHASE DETAIL — BLOCK PRODUCTION'],
      ['Block-production sand from the normalized BlockProductionSand ledger.'],
      ['Date', 'Sand Type', 'Quantity / Trips', 'Original Description', 'Amount (\u20a6)', 'Payment Method']
    ];
    const spCur = [];

    blockSandEntries.forEach(e => {
      const desc = e.Description || '';
      const tripMatch = desc.match(/(\d+)\s*trip/i);
      const trips = Number(e.Quantity) || (tripMatch ? Number(tripMatch[1]) : 1);

      spAoa.push([
        fmtDate(e.Date),
        sandTypeOf(e),
        trips,
        desc,
        Number(e.Amount) || 0,
        e['Payment Method'] || ''
      ]);
      spCur.push([spAoa.length, 5]);
    });

    spAoa.push(['', '', '', 'TOTAL', blockSandEntries.reduce((s, e) => s + (Number(e.Amount) || 0), 0), '']);
    spCur.push([spAoa.length, 5]);

    const spWs = XLSX.utils.aoa_to_sheet(spAoa);
    spWs['!cols'] = [
      { wch: 14 }, { wch: 16 }, { wch: 16 },
      { wch: 40 }, { wch: 16 }, { wch: 18 }
    ];
    setCurrency(spWs, spCur);
    XLSX.utils.book_append_sheet(wb, spWs, 'Sand Purchase Detail');

    // ---- Other / Standalone Sand Detail ----
    const otherSandEntries = sandRowsByOrigin('Standalone / Other Sand');
    const otherSandWs = buildSandDetailSheetAoa(
      'OTHER / STANDALONE SAND DETAIL',
      'Standalone/non-block-production sand mirrored from the Expenses ledger into OtherSandImports.',
      otherSandEntries
    );
    XLSX.utils.book_append_sheet(wb, otherSandWs, 'Other Sand Detail');

    // ---- One detail sheet per category group ----
    REPORT_CATEGORY_GROUP_ORDER.forEach(g => {
      const rows = byGroup[g] || [];
      const subtitle = `Site Expense Manager | Detailed expense record | Report date: ${reportDate} | Data through ${latestStr}`;
      const ws = buildDetailSheetAoa(g.toUpperCase(), subtitle, rows);
      XLSX.utils.book_append_sheet(wb, ws, sheetSafeName(g));
    });

    // ---- Production of Blocks / Block Production Expenses split ----
    const { autoLog, manual } = blockProductionSplit();

    const pobWs = buildDetailSheetAoa(
      'PRODUCTION OF BLOCKS',
      'Actual block production records, including Block Moulding Labour. This is one component of the total Block Production cost.',
      autoLog
    );
    XLSX.utils.book_append_sheet(wb, pobWs, 'Production of Blocks');

    const bpeWs = buildDetailSheetAoa(
      'BLOCK PRODUCTION EXPENSES',
      'Supporting block-production expenses from the app export. This is the second component of the total Block Production cost.',
      manual
    );
    XLSX.utils.book_append_sheet(wb, bpeWs, 'Block Production Expenses');

    // ---- Concrete Works Breakdown ----
    const cb = concreteBreakdown();
    const cbAoa = [
      ['CONCRETE WORKS BREAKDOWN'],
      ['What makes up the Concrete Works total, by component. Block Setting and Hollow Filling are included here by the updated taxonomy.'],
      [],
      ['Component', 'Transactions', 'Amount (\u20a6)', '% of Concrete Works']
    ];
    const cbCur = [];

    cb.list.forEach(r => {
      cbAoa.push([r.name, r.count, r.total, r.pct]);
      cbCur.push([cbAoa.length, 3]);
    });

    cbAoa.push(['TOTAL CONCRETE WORKS', cb.count, cb.total, cb.total > 0 ? 1 : 0]);
    cbCur.push([cbAoa.length, 3]);

    const cbWs = XLSX.utils.aoa_to_sheet(cbAoa);
    cbWs['!cols'] = [{ wch: 34 }, { wch: 14 }, { wch: 18 }, { wch: 20 }];
    setCurrency(cbWs, cbCur);

    for (let r = 5; r <= cbAoa.length; r++) {
      const ref = XLSX.utils.encode_cell({ r: r - 1, c: 3 });
      if (cbWs[ref]) cbWs[ref].z = '0.0%';
    }

    XLSX.utils.book_append_sheet(wb, cbWs, 'Concrete Works Breakdown');

    // ---- Sand Breakdown ----
    const sb = sandBreakdown();
    const sbAoa = [
      ['SAND BREAKDOWN'],
      ['Sources: standalone/other sand plus block-production sand. Sand rows are reporting/index records; financial totals remain controlled by Expenses.'],
      [],
      ['Sand Type', 'Transactions', 'Quantity (trips)', 'Amount (\u20a6)', '% of Sand']
    ];
    const sbCur = [];

    sb.byType.forEach(r => {
      sbAoa.push([r.name, r.count, r.qty, r.total, r.pct]);
      sbCur.push([sbAoa.length, 4]);
    });

    sbAoa.push([
      'TOTAL SAND',
      sb.count,
      sb.byType.reduce((s, r) => s + r.qty, 0),
      sb.total,
      sb.total > 0 ? 1 : 0
    ]);
    sbCur.push([sbAoa.length, 4]);

    const pctFrom = 5;
    const pctTo = sbAoa.length;

    sbAoa.push([]);
    sbAoa.push(['By Source', 'Transactions', '', 'Amount (\u20a6)']);

    sb.bySource.forEach(r => {
      sbAoa.push([r.name, r.count, '', r.total]);
      sbCur.push([sbAoa.length, 4]);
    });

    const sbWs = XLSX.utils.aoa_to_sheet(sbAoa);
    sbWs['!cols'] = [
      { wch: 30 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 12 }
    ];
    setCurrency(sbWs, sbCur);

    for (let r = pctFrom; r <= pctTo; r++) {
      const ref = XLSX.utils.encode_cell({ r: r - 1, c: 4 });
      if (sbWs[ref]) sbWs[ref].z = '0.0%';
    }

    XLSX.utils.book_append_sheet(wb, sbWs, 'Sand Breakdown');

    // ---- Combined Sand Detail ----
    const sdAoa = [
      ['SAND DETAIL'],
      ['Combined sand detail for reference. See Sand Purchase Detail and Other Sand Detail for separated views.'],
      [],
      ['Date', 'Sand Type', 'Description', 'Source', 'Quantity', 'Unit', 'Vendor', 'Amount (\u20a6)', 'Payment Method']
    ];
    const sdCur = [];

    sandEntries.slice()
      .sort((a, b) => parseLocalDate(a.Date) - parseLocalDate(b.Date))
      .forEach(e => {
        sdAoa.push([
          fmtDate(e.Date),
          sandTypeOf(e),
          e.Description || '',
          sandOriginOf(e),
          Number(e.Quantity) || '',
          e.Unit || '',
          e.Vendor || '',
          Number(e.Amount) || 0,
          e['Payment Method'] || ''
        ]);
        sdCur.push([sdAoa.length, 8]);
      });

    sdAoa.push(['', '', '', '', '', '', 'TOTAL', sb.total, '']);
    sdCur.push([sdAoa.length, 8]);

    const sdWs = XLSX.utils.aoa_to_sheet(sdAoa);
    sdWs['!cols'] = [
      { wch: 16 }, { wch: 16 }, { wch: 40 }, { wch: 28 },
      { wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 16 }, { wch: 16 }
    ];
    setCurrency(sdWs, sdCur);
    XLSX.utils.book_append_sheet(wb, sdWs, 'Sand Detail');

    // ---- Excavation Breakdown Summary ----
    const excCount = (byGroup['Excavation of Trenches'] || []).length;
    const concCount = (byGroup['Concrete Works'] || []).length;

    const ebsAoa = [
      ['EXCAVATION / FOUNDATION WORK BREAKDOWN SUMMARY'],
      [],
      ['Detailed Sheet', 'Transactions', 'Amount (\u20a6)'],
      ['Excavation of Trenches', excCount, excavationTotal],
      ['Concrete Works (incl. Block Setting, Hollow Filling, column base work & materials)', concCount, concreteTotal],
      ['TOTAL', excCount + concCount, excavationTotal + concreteTotal]
    ];

    const ebsWs = XLSX.utils.aoa_to_sheet(ebsAoa);
    ebsWs['!cols'] = [{ wch: 65 }, { wch: 14 }, { wch: 16 }];
    setCurrency(ebsWs, [[4, 3], [5, 3], [6, 3]]);
    XLSX.utils.book_append_sheet(wb, ebsWs, 'Excavation Breakdown Summary');

    XLSX.writeFile(
      wb,
      'Site_Expense_Final_Report_' + new Date().toISOString().slice(0, 10) + '.xlsx'
    );
  }

  // ---------------------------------------------------------------
  // Fix Historical Categories (Admin only)
  // ---------------------------------------------------------------
  function initRecategorizeCard() {
    const card = document.getElementById('recategorizeCard');
    card.style.display = 'block';

    const sel = document.getElementById('recatFromCategory');
    const candidateCategories = REPORT_CATEGORY_FLAT.filter(c =>
      allExpenses.some(e => e.Category === c)
    );

    sel.innerHTML = candidateCategories
      .map(c => `<option value="${c}">${c}</option>`).join('');

    if (candidateCategories.includes('Excavation of Trenches')) {
      sel.value = 'Excavation of Trenches';
    }

    let lastPreview = null;

    document.getElementById('recatPreviewBtn').addEventListener('click', async () => {
      const btn = document.getElementById('recatPreviewBtn');
      const applyBtn = document.getElementById('recatApplyBtn');
      const box = document.getElementById('recatPreviewBox');

      btn.disabled = true;
      btn.textContent = 'Checking…';
      applyBtn.style.display = 'none';

      try {
        const result = await Api.autoRecategorize(sel.value, true);
        lastPreview = result;

        if (!result.totalMatches) {
          box.innerHTML = `<p style="color:var(--color-ink-muted);">No expenses under "${result.fromCategory}" matched a more specific category. Nothing to change.</p>`;
        } else {
          const rows = Object.entries(result.byNewCategory).map(([cat, info]) =>
            `<tr><td>${cat}</td><td>${info.count}</td><td>${money(info.total)}</td></tr>`
          ).join('');

          box.innerHTML = `
            <p style="margin-bottom:10px;"><strong>${result.totalMatches}</strong> expense(s) under "${result.fromCategory}" would move:</p>
            <div class="table-wrap">
              <table><thead><tr><th>New Category</th><th>Count</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
            </div>
            <details style="margin-top:12px;">
              <summary style="cursor:pointer;font-size:12.5px;color:var(--color-ink-muted);">Show individual line items</summary>
              <div class="table-wrap" style="margin-top:8px;">
                <table><thead><tr><th>Description</th><th>Amount</th><th>New Category</th></tr></thead><tbody>
                  ${result.matches.map(m => `<tr><td>${m.description}</td><td>${money(m.amount)}</td><td>${m.newCategory}</td></tr>`).join('')}
                </tbody></table>
              </div>
            </details>
          `;
          applyBtn.style.display = 'inline-flex';
        }
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Preview Changes';
      }
    });

    document.getElementById('recatApplyBtn').addEventListener('click', async () => {
      if (!lastPreview || !lastPreview.totalMatches) return;

      const ok = confirm(
        `This will update the Category on ${lastPreview.totalMatches} expense(s). This can't be undone automatically. Continue?`
      );
      if (!ok) return;

      const applyBtn = document.getElementById('recatApplyBtn');
      applyBtn.disabled = true;
      applyBtn.textContent = 'Applying…';

      try {
        const result = await Api.autoRecategorize(lastPreview.fromCategory, false);
        showToast(`${result.totalMatches} expense(s) re-categorized`, 'success');

        document.getElementById('recatPreviewBox').innerHTML =
          '<p style="color:var(--color-accent);">Changes applied. Reloading report…</p>';
        applyBtn.style.display = 'none';

        const [expData] = await Promise.all([Api.getExpenses()]);
        allExpenses = expData.expenses || [];

        groupExpenses();
        renderSummary();
        renderByPeriod();
        renderBlockProductionBreakdown();
        renderConcreteBreakdown();
        renderSandBreakdown();
        populateDetailSelect();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        applyBtn.disabled = false;
        applyBtn.textContent = 'Apply Changes';
      }
    });
  }

  init();
})();
