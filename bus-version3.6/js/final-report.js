/**
 * ONE-TIME HISTORICAL CONCRETE FIX
 *
 * Fixes historical descriptions that were not classified correctly:
 *
 *   "Cating trenches"   -> Trenches Casting
 *   "Trenches concrete" -> Trenches Casting
 *
 * It changes ONLY the Category column.
 * It does NOT change Amount, Date, Description, Expense ID, etc.
 */

function previewConcreteHistoricalFix() {
  const sheet = getSheet(SHEET_EXPENSES);
  const data = sheet.getDataRange().getValues();

  if (!data || data.length < 2) {
    Logger.log('No Expenses data found.');
    return;
  }

  const headers = data[0];

  const idCol = headers.indexOf('Expense ID');
  const dateCol = headers.indexOf('Date');
  const catCol = headers.indexOf('Category');
  const descCol = headers.indexOf('Description');
  const amountCol = headers.indexOf('Amount');

  if (catCol === -1 || descCol === -1) {
    throw new Error(
      'Expenses sheet must contain Category and Description columns.'
    );
  }

  Logger.log('===== CONCRETE HISTORICAL FIX PREVIEW =====');

  let matches = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    const description = String(row[descCol] || '').trim();
    const lower = description.toLowerCase();
    const currentCategory = String(row[catCol] || '').trim();

    let newCategory = '';

    if (
      lower === 'cating trenches' ||
      lower === 'cating trench'
    ) {
      newCategory = 'Trenches Casting';
    }

    if (
      lower === 'trenches concrete' ||
      lower === 'concrete trenches'
    ) {
      newCategory = 'Trenches Casting';
    }

    if (!newCategory || currentCategory === newCategory) {
      continue;
    }

    matches++;

    Logger.log(
      'ROW ' + (i + 1) +
      ' | ID: ' + (idCol >= 0 ? row[idCol] : '') +
      ' | Date: ' + (dateCol >= 0 ? row[dateCol] : '') +
      ' | OLD: ' + currentCategory +
      ' | NEW: ' + newCategory +
      ' | AMOUNT: ₦' + Number(row[amountCol] || 0).toLocaleString() +
      ' | DESCRIPTION: ' + description
    );
  }

  Logger.log('===== SUMMARY =====');
  Logger.log('Potential fixes: ' + matches);
}


/**
 * APPLY the historical concrete correction.
 *
 * Only the Category column is modified.
 */
function applyConcreteHistoricalFix() {
  const sheet = getSheet(SHEET_EXPENSES);
  const data = sheet.getDataRange().getValues();

  if (!data || data.length < 2) {
    Logger.log('No Expenses data found.');
    return;
  }

  const headers = data[0];

  const idCol = headers.indexOf('Expense ID');
  const catCol = headers.indexOf('Category');
  const descCol = headers.indexOf('Description');

  if (catCol === -1 || descCol === -1) {
    throw new Error(
      'Expenses sheet must contain Category and Description columns.'
    );
  }

  let updated = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    const description = String(row[descCol] || '').trim();
    const lower = description.toLowerCase();
    const currentCategory = String(row[catCol] || '').trim();

    let newCategory = '';

    if (
      lower === 'cating trenches' ||
      lower === 'cating trench'
    ) {
      newCategory = 'Trenches Casting';
    }

    if (
      lower === 'trenches concrete' ||
      lower === 'concrete trenches'
    ) {
      newCategory = 'Trenches Casting';
    }

    if (!newCategory || currentCategory === newCategory) {
      continue;
    }

    sheet
      .getRange(i + 1, catCol + 1)
      .setValue(newCategory);

    updated++;

    Logger.log(
      'UPDATED | ' +
      (idCol >= 0 ? row[idCol] : 'ROW ' + (i + 1)) +
      ' | ' +
      currentCategory +
      ' -> ' +
      newCategory +
      ' | ' +
      description
    );
  }

  Logger.log('===== CONCRETE HISTORICAL FIX APPLIED =====');
  Logger.log('Updated: ' + updated);
}
