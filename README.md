# Full-stack Bug Tracker

A bug tracker that anyone with the link can view and only approved accounts can edit. It runs as a Next.js app in Docker and stores its data in one SQLite file. This branch is set up for Dokploy; the `main` branch is the Cloudflare version.

**Keep real data out of this repository.** `data/findings.json` contains fictional demo items only. Real items, database files and exports belong on the server's private volume or in the ignored `private/` folder.

## Settings

| Variable | Example | Purpose |
| --- | --- | --- |
| `PUBLIC_URL` | `https://tracker.example.com` | Required. Must be the exact HTTPS address; sign-in fails with 403 if it is wrong |
| `OWNER_EMAIL` | `owner@example.com` | The only account that can approve access requests |
| `DATABASE_PATH` | `/data/tracker.db` | Database file, created automatically |
| `SEED_PATH` | `/data/findings.json` | Private file of original items. Leave unset to show the demo items |

## Deploy on Dokploy

1. Point a DNS A record at the server, and open ports 80 and 443.
2. Create an Application from this GitHub repository and the `dokploy` branch.
3. Choose the Dockerfile build type, with Dockerfile path `Dockerfile` and context path `.`
4. In Environment, set `PUBLIC_URL`, `OWNER_EMAIL` and `DATABASE_PATH`.
5. In Advanced, add a Volume Mount named `bug-tracker-data` at `/data`. Without it, every deployment loses the data. Use a Volume Mount rather than a Bind Mount, and keep one replica.
6. In Domains, add the domain with container port `3000`, HTTPS on, and Let's Encrypt.
7. Deploy, then check that `/api/health` returns `{"ok":true}`.

In the commands below, replace `CONTAINER` with the name shown by `docker ps`.

## Move data from the Cloudflare version

The data is in two places, and both are needed:

- the D1 database, which holds edits, added items, accounts and requests;
- the `data/findings.json` that the live site was built with, which holds the original items.

1. Ask everyone to stop editing the old site, and write down its item counts.
2. Export the database from the Cloudflare account that owns it:

   ```sh
   npx wrangler login
   npx wrangler d1 export DATABASE_NAME --remote --output export.sql
   ```

3. Get `data/findings.json` from the folder the live site was deployed from. If it is lost, sign in to the old site, save the pages `/api/items` and `/api/items?deleted=1` as `items.json` and `deleted.json`, then run:

   ```sh
   node scripts/recover-findings.mjs findings.json items.json deleted.json
   ```

4. Copy both files to the server privately, then import them:

   ```sh
   docker cp export.sql CONTAINER:/tmp/export.sql
   docker cp findings.json CONTAINER:/tmp/findings.json
   docker exec CONTAINER node scripts/import-d1.mjs /tmp/export.sql /tmp/findings.json /data
   ```

   The import stops if an original item is missing, and never overwrites existing files. Compare the counts it prints with the old site.

5. Set `DATABASE_PATH=/data/live.db` and `SEED_PATH=/data/findings.json`, then redeploy.
6. Check the site, then delete every copy of `export.sql`. It contains emails and password hashes.

Existing passwords keep working. Everyone has to sign in again.

## Accounts

Create or reset an account, which prints a private 24-hour link for choosing a password:

```sh
docker exec CONTAINER node scripts/editor-access.mjs person@example.com
```

Disable an account and end its sessions:

```sh
docker exec CONTAINER node scripts/editor-access.mjs person@example.com --disable
```

Anyone who can reach the site can view active items, so do not store confidential information in them. Account emails and deleted items are shown only to signed-in users. Visitors can request edit access at `/request-access`. The owner approves requests at `/admin/requests` and shares the setup link privately; no email is sent. Every account can edit all items.

Sign-in attempts are limited by visitor address, which comes from Traefik's `X-Forwarded-For` header. Do not publish port 3000 directly.

## Backups

Set up a Volume Backup for `bug-tracker-data` in Dokploy, with "Turn off Container" on so the copy is consistent. Backups contain account data, so keep them private.

## Run locally

Requires Node.js 24 or newer.

```sh
npm ci
npm run dev
```

In a second terminal, create an account and open the printed link:

```sh
PUBLIC_URL=http://localhost:3000 node scripts/editor-access.mjs you@example.com
```

In PowerShell, set `$env:PUBLIC_URL='http://localhost:3000'` first. Open the site once before this step so the database exists.

With the local server running, `npm test` checks authorization, validation, editing, conflicts, deletion and restoration. If you open the site at `localhost`, set `TEST_BASE_URL=http://localhost:3000` for the tests as well.

No license has been selected for this project's code.
