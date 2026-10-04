# Salary ledger setup

The Salaries page stores salary payments in a separate Google Sheets tab. Salary records are not posted to Expenses, so dashboards and expense reports exclude migrated salaries automatically. Allowances stay in Expenses. Admin can add/import/migrate salaries. Boss can view all salaries, while Site Managers can view salaries for their assigned site only.

## Deploy

1. In the existing Apps Script project, add `Salaries.gs` using `apps-script/Salaries.gs` from this repository.
2. Update the existing `Code.gs` with this repository version. Preserve any additional live customizations. It adds salary routes and support for the frontend's existing `payload` request format.
3. Run `setupSalarySheet()` once from the Apps Script editor. It creates the `Salaries` tab without resetting existing data.
4. Use Deploy → Manage deployments → Edit → New version → Deploy. Keep the same deployment URL and access settings.
5. Deploy the frontend changes: `salaries.html`, `js/salaries.js`, and `js/layout.js`.
6. Sign in as Admin and open Salaries. Click “Preview existing salaries”, inspect every row and site, then click “Move previewed salaries”.

Migration saves complete originals in `SalaryExpenseArchive` and stores each original Expense ID in Salaries before removing that record from Expenses. It does not erase source history. A failed/interrupted migration can be previewed and retried without copying the same salary twice. Do not manually delete migrated salary rows or their source IDs during a retry.

## Import and totals

Download the empty salary template from Salaries. Columns are `Date`, `Site`, `Staff Name`, `Role`, `Salary Month`, `Amount`, `Payment Method`, `Description`. Use dates like `2026-09-28`, salary months like `2026-09`, and numeric amounts. The importer previews the count and amount before saving; exact repeated salary records are skipped. Use a distinct description for genuinely separate identical payments.

July and August salary source records are aggregated totals without staff names. Migration preserves the original description and labels the staff name “Staff (aggregated)” rather than inventing individual allocations. Salary month defaults to the payment month. Review the month for payments covering a different period.

In the checked 4 October export, the three existing salaries total NGN 1,040,000. Moving all three would change the expense total from NGN 54,731,200 to NGN 53,691,200. If any records have already been removed, use the preview's actual total rather than importing them again solely to force a balance.

September salaries of NGN 840,000 have not been automatically imported. Add them to Salaries only when required.

## Validation

Run `node --test tests/salaries.test.cjs` from the repository root. Tests cover salary/allowance separation, access permissions, archive-before-removal, interrupted migration retries, stale previews, duplicate imports and input validation. Apps Script deployment and authenticated browser behavior require verification after deployment.
