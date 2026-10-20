# Deploying on Vercel with a free Turso database

Right now the site runs on the `parlamentum_market.db` file bundled with each deploy. Every Vercel server
instance works on its own copy in `/tmp`, so trades and deposits made on one instance vanish when it
restarts, and the Vercel Blob sync that was meant to fix this can overwrite newer data (and can get
suspended). A real database fixes all of that.

[Turso](https://turso.tech) is hosted SQLite, which this app already speaks. Its free plan is plenty for
this exchange: 100 databases, 5 GB, 500 million row reads and 10 million row writes a month. Vercel's
free Hobby plan is fine for the site itself.

Takes about 15 minutes. You need the [Turso CLI](https://docs.turso.tech/cli/installation) and `sqlite3`.

## 1. Freeze the exchange

In the Operator panel, set the market schedule to **Closed** and turn the watcher off, so nothing
changes while you copy the data.

## 2. Make a copy of your current data

Your newest data is the `parlamentum_market.db` you last committed (that's what the site loads after a
restart). If your Blob store still works and holds a newer copy, download that one from Vercel →
Storage → your Blob store instead.

```bash
cp parlamentum_market.db gug.db
sqlite3 gug.db "PRAGMA journal_mode='wal'; PRAGMA wal_checkpoint(truncate);"
```

Turso's importer needs the file in WAL mode; the second line switches it.

## 3. Create the database from that copy

```bash
brew install tursodatabase/tap/turso              # macOS
curl -sSfL https://get.tur.so/install.sh | bash   # Linux, or Windows inside WSL

turso auth login               # opens the browser; sign up with GitHub if you're new
turso db import gug.db         # creates a database called "gug" with all your tables and data
turso db show gug --url        # prints libsql://gug-<you>.turso.io
turso db tokens create gug     # prints the access token
```

## 4. Point Vercel at it

Vercel → your project → Settings → Environment Variables. Add these for **Production only**:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | the `libsql://…` URL from step 3 |
| `DATABASE_AUTH_TOKEN` | the token from step 3 |
| `SESSION_SECRET` | any long random string, e.g. the output of `openssl rand -hex 32` |
| `ADMIN_SIGNUP_CODE` | optional: a code that lets new operators sign up (leave it out to turn that off) |
| `CRON_SECRET` | optional: 32+ random characters. Vercel's daily cron sends it, so the watcher looks at the game even on a day nobody opens the exchange |

- Keep `BLOB_READ_WRITE_TOKEN`. It's ignored while a database URL is set, and deleting `DATABASE_URL`
  takes you back to the old setup if you ever need to.
- Don't give Preview or Development the production database, or every preview deploy writes to your real
  exchange. Leave them out, or make a second free database for them: `turso db create gug-dev`.
- Speed: every page makes several database calls, so put the two close together. `turso db show gug`
  shows the database's location; pick the nearest Vercel region under Settings → Functions.

Using Vercel's Marketplace instead (Storage → Create Database → Turso) also works: it adds
`TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`, which the app reads too. That database starts empty,
though, so the CLI route above is the one that keeps your users and balances.

## 5. Deploy and check

Merge and let Vercel deploy (or redeploy). Then:

1. Log in. Everyone has to log in once more, because sessions are now signed.
2. Check a few purses and the BCKRM, GUG and EI holders against what you expect.
3. Place a small order, reload, and make sure it's still there.
4. Set the market schedule back to **Auto** and turn the watcher back on (see below).

## 6. Lock it down (right after deploying)

**Change the operator password.** The current JosephArora password (also CardinalSanjay's) is in this
repo's history, so anyone can log in as the operator until you change it. Make a password hash in the
project folder:

```bash
node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 10))" 'your-new-password'
```

Then open the database with `turso db shell gug` and paste:

```sql
UPDATE users SET password_hash = '<the hash>' WHERE username = 'JosephArora';
```

Do the same for CardinalSanjay if that account is still used.

**Turn on the watcher.** It's the only automatic way deposits get credited. Operator panel → Watcher: paste
the House's game login (on parlamentum.org, logged in as the House: F12 → Console → `localStorage.token`,
copy it without the quotes). A login lasts about a week, and the panel warns two days before it runs out.
While the watcher is off or failing, credit deposits by hand: **Approve & Credit** on the player's
announcement, or **Load Citizen Purse from Game Sale**.

**Stop committing `parlamentum_market.db`.** From now on the live data lives in Turso. Make changes through
the Operator panel or `turso db shell gug`; the file only seeds brand-new installs.

## Day to day

- `turso db shell gug` runs SQL directly.
- `turso db shell gug .dump > backup.sql` takes a backup.
- The Turso dashboard shows usage against the free limits.
