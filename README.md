# Full-stack Bug Tracker

A React tracker with a Cloudflare Worker backend and D1 database. Includes four fictional examples only. No original project findings, accounts, production database records, or credentials are included.

## Requirements

Node.js 22.13 or newer and npm. Internet access is required to install dependencies. Local development does not require a Cloudflare account. Deployment requires your own Cloudflare account and D1 database.

## Run after downloading or cloning

Open a terminal in the folder containing package.json. Copy tracker.config.example.json to tracker.config.json (PowerShell: `Copy-Item tracker.config.example.json tracker.config.json`; macOS/Linux: `cp tracker.config.example.json tracker.config.json`). Set ownerEmail to the email you want to use for the administrator. The other settings are only needed for deployment.

```sh
npm ci
npm run build
npm run db:init
npm start
```

Open http://127.0.0.1:8787. Leave the terminal running; Ctrl+C stops it. Rebuild and restart after source or ownerEmail changes. The initialization command is safe to repeat: it creates missing tables without clearing records.

## Create your first local editor/owner

After building and initializing the database, run this in a second terminal, replacing the example email with the ownerEmail you configured:

```sh
node scripts/editor-access.mjs owner@example.com
```

Open the generated outputs/setup-...html file and follow its link while the app is running. Choose a password of 15–128 characters. The link expires after 24 hours and is single-use. Keep setup files private and delete them after use. Future sign-ins use /login. Local accounts and data are separate from production.

## Use the app

- Anyone who can reach the website can view active issues. This app is not a private-data portal.
- Use All issues to browse bugs, improvements, and testing tasks. Deliverables are listed separately.
- Search and filter by status, type, and priority. The status cards select Pending, In progress, or Completed.
- Signed-in editors can add items, edit details, assign owners, update remarks/status, and delete items.
- Recently deleted lets editors restore records. Deletion hides records rather than permanently erasing them.
- Visitors can request edit access at /request-access. The configured owner signs in and reviews requests at /admin/requests.
- Approval creates a password-setup link. Share it privately with the intended person; the app does not send email automatically.
- To reset an editor password, generate a new setup link with the same command. To disable a local editor:

```sh
node scripts/editor-access.mjs person@example.com --disable
```

All authenticated editors can modify tracker items. Only the configured owner manages requests. If ownerEmail is missing, owner-only operations are denied. Changing ownerEmail does not disable the previous editor account; disable it separately if needed.

## Deploy to your own Cloudflare account

1. Authenticate and create a D1 database:

```sh
npx wrangler login
npx wrangler d1 create my-bug-tracker-db
```

2. Fill in tracker.config.json:

| Setting | Value |
| --- | --- |
| ownerEmail | Your administrator email, used for owner-only authorization |
| workerName | Your Worker name, such as my-bug-tracker |
| accountId | Your Cloudflare account ID |
| databaseName | The D1 database name you created |
| databaseId | The database UUID returned by the create command |
| publicUrl | Your final HTTPS website URL, used for production setup links |

3. Build, generate configuration, initialize production tables, and deploy:

```sh
npm run build
npm run deploy:prepare
npm run db:init -- --remote
npx wrangler deploy --config cloudflare/wrangler.json
```

4. Wrangler prints the deployed URL. Set publicUrl to that URL, then create the production owner account:

```sh
node scripts/editor-access.mjs owner@example.com --remote
```

Open the generated setup HTML and set the production password. Use the same email as ownerEmail. Add `--remote` to editor-management commands when targeting production, including `--disable`. Without it, commands target the local database.

For later code updates, rebuild, prepare configuration, and deploy again. Run database initialization if new schema files have been added. GitHub uploads alone do not deploy the app; no automatic deployment workflow is included. Never use the placeholder database in dist/server/wrangler.json for remote operations.

## Data and backups

The sample records are in data/findings.json; replace these with your own seed data or use Add issue. Keep seed IDs unique and stable once edits exist. Runtime edits and new items live in D1. Local D1 state is in .wrangler/state. Source archives do not back up those databases.

To back up your production database after preparing configuration:

```sh
npx wrangler d1 export DB --remote --config cloudflare/wrangler.json --output outputs/database-backup.sql
```

Create the outputs folder first if needed. Database exports can contain account/session information; keep them private. Never upload them to a public repository.

## Repository files and public upload

Extract the PUBLIC ZIP and upload its contents so package.json and this README are at the repository root. Include .hosting/hosting.json, .gitignore, and .npmrc. The .hosting file only declares the DB binding used by the build; it contains no API key or original project ID. .npmrc only contains npm preferences.

The public ZIP omits tracker.config.json, generated cloudflare/wrangler.json, environment files, dependencies, builds, database state, account setup files, and Git history. Keep those excluded. Git's .gitignore does not protect browser drag-and-drop uploads: upload the clean ZIP contents before creating personal configuration or running the app, or use Git afterward.

To clone an uploaded repository:

```sh
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
cd YOUR_REPOSITORY
```

Then follow Run after downloading or cloning above. Cloudflare credentials must be authorized separately and are never included in the source ZIP.

## Project layout

- app/: frontend pages and backend API routes
- lib/, components/, hooks/: shared logic and UI
- data/findings.json: fictional seed records
- cloudflare/: database schemas; generated deployment configuration is ignored
- scripts/: build, database initialization, and account-management helpers
- tracker.config.example.json: public configuration template
- worker/, vite.config.ts: Cloudflare/Vinext integration

## Checks and troubleshooting

With the local app running, `node scripts/test-items.mjs` checks item validation, authorization, creation, editing, conflicts, deletion, and restoration. It creates temporary local fixtures and removes them afterward. Do not run it against a shared local development session where someone else is editing the same records.

If you see missing-table errors, run npm run db:init after building. If owner access is denied, verify ownerEmail, rebuild/restart, and sign in using that exact email. If dependencies fail to install, verify your Node version and run npm ci again. Local setup links require the local server to be running at the documented address.

Third-party license notices remain in vendor/ and scripts/vite/. No new license for the project's own code has been selected; choose one before advertising reuse permissions.

Cloudflare command reference: https://developers.cloudflare.com/d1/wrangler-commands/
