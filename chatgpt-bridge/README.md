# BSU reports in ChatGPT

Status: code prepared; not a live connection. This bridge exposes only five reads
(expenses, cashbook, production, progress and sites). It does not call OpenAI APIs,
and needs no OpenAI API key. It reads the current Apps Script data, not Excel
files uploaded elsewhere. A source failure is an error, never a zero balance.

## Deployment

1. Update the existing Apps Script project with this branch's `Code.gs` and
   update its Web App deployment to a new version. The sole backend change allows
   the existing Boss role to READ cashbook. Cashbook writes remain Admin-only.
2. Create a dedicated Boss account in the app with a unique password. Do not use
   an Admin account or starter password. The bridge refuses non-Boss logins.
3. Deploy this directory as a Node 22+ service or Docker service. Build with
   `npm ci`, run `npm start`, health check `/health`. Configure all variables in
   `.env.example` as host environment/secrets. Never commit filled credentials.
4. Set up an established OAuth provider following OpenAI's MCP authentication
   guide below. It must support authorization-code + PKCE S256, OAuth discovery,
   and either a predefined ChatGPT client, CIMD or DCR. Configure its resource
   parameter handling so issued access tokens have audience exactly
   `https://YOUR-BRIDGE-HOST/mcp`. Grant scope `bsu:read` only to your owner user.
   Use RS256 or ES256 JWT access tokens with expiry. Set `ALLOWED_SUBJECT` to that
   user's subject identifier. The bridge validates signature, issuer, audience,
   expiry, subject and scope on every MCP request. Provider configuration is
   required; merely setting an issuer URL does not configure OAuth.
5. In ChatGPT's custom MCP/plugin connection screen, enter the public HTTPS
   `/mcp` URL and select OAuth. Use the exact callback URI shown by that screen
   in your provider's allowlist. Install/enable the connection, sign in as the
   owner, then select it in a chat. Availability and labels depend on your
   account/workspace. If custom MCP is unavailable, this bridge cannot bypass
   that restriction. Do not deploy with authentication disabled.

Official setup: https://developers.openai.com/plugins/build/app-quickstart
Official OAuth guide: https://developers.openai.com/plugins/build/auth

The source API URL is already in `bus-version3.6/js/api.js`; copy it into the host
secret configuration. The repository's Apps Script code may differ from the live
version; deploy and test it deliberately. Apps Script fetches are POST requests,
so source credentials and sessions do not appear in query strings. Login creates
its normal audit record; business records are never changed by bridge tools.

## Validation

Run `npm ci` and `npm test`. Use MCP Inspector against the deployed endpoint with
a valid owner token to check initialize, tools/list and all five reads. Check that
no token, another user's token, wrong audience and missing scope all return
an MCP authentication error with `mcp/www_authenticate`, without any records.
Protocol initialization and tool descriptions are public so ChatGPT can discover
the OAuth requirements; every data-reading handler still requires verified owner
credentials. Tool declarations include both top-level and compatibility metadata
for OAuth, including with SDK versions that drop unknown registration fields.
Confirm the cashbook read succeeds after the Apps Script update. Compare returned
records with the app before relying on a report. Local unit checks alone do not
prove live connectivity. Only deploy this service with HTTPS and normal host
request limits. Tool responses include complete source datasets and timestamps;
large datasets may need pagination before practical use at scale.

## Report prompt

“Read the latest BSU MB2 records. Reconcile expenses and cashbook without double
counting. Show money received, money spent, balances, possible duplicates and
missing receipt references. Keep block production separate from excavation and
concrete work: block setting belongs to excavation/concrete. Apply my stated
inclusion/exclusion rules and flag ambiguous records. Distinguish missing receipt
references from receipts confirmed absent. Prepare a professional report for my
boss, with source records and retrieval time.”

Tools return raw data; they do not silently exclude salaries, apply historical
corrections, combine source totals, or establish that a receipt exists. State the
rules used for each report. Review uncertain classifications before finalizing.

## Vercel settings

Create a SEPARATE Vercel project by importing `kingd-lab/bsuversion1`.
Select branch `feat/chatgpt-read-only-bridge` (or main after merging this PR).
Set Root Directory to `chatgpt-bridge`, Node.js to 22.x or later and keep framework
and build settings auto-detected. `server.js` exports Express for Vercel's native
Express support; no rewrites or static output directory are needed. Keep the
existing BSU frontend project's root directory as it is.

Add every required `.env.example` variable to this project's environment settings.
`PUBLIC_URL` must be the stable production domain, without a trailing `/mcp`.
Set OAuth token audience to that same domain plus `/mcp`. Configure the stable
production URL rather than a changing preview hostname. Redeploy after changing
variables. Check `/health`, then configure ChatGPT with `/mcp`. OAuth and Boss
credentials must be configured before deployment will start successfully.

You remain Admin in the BSU app. Only the bridge uses the separate Boss account.
