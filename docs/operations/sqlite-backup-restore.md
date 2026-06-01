# SQLite Backup And Restore

Babel Pocket stores config, user whitelist, user budgets, user preferences, usage, dashboard sessions, and compatibility data in SQLite. The default database path is `data/babel.sqlite`, or `BABEL_DB_PATH` when set.

## Backup

Prefer SQLite's online backup command when the service is running:

```bash
mkdir -p backups
sqlite3 data/babel.sqlite ".backup 'backups/babel-pocket-$(date +%Y%m%d-%H%M%S).sqlite'"
```

For Docker named volumes:

```bash
docker exec babel-pocket sh -lc "sqlite3 /app/data/babel.sqlite \".backup '/app/data/babel-pocket-backup.sqlite'\""
docker cp babel-pocket:/app/data/babel-pocket-backup.sqlite ./backups/babel-pocket-$(date +%Y%m%d-%H%M%S).sqlite
```

For PM2 or a direct Node process, you can also stop the app and copy the file:

```bash
pm2 stop babel-pocket
cp data/babel.sqlite backups/babel-pocket-$(date +%Y%m%d-%H%M%S).sqlite
pm2 start babel-pocket
```

## Verify A Backup

```bash
sqlite3 backups/babel-pocket-YYYYMMDD-HHMMSS.sqlite "PRAGMA integrity_check;"
sqlite3 backups/babel-pocket-YYYYMMDD-HHMMSS.sqlite ".tables"
```

`PRAGMA integrity_check;` should print `ok`.

## Restore

Stop the app before restoring so no process writes to the database during replacement.

```bash
pm2 stop babel-pocket
cp data/babel.sqlite data/babel.sqlite.before-restore
cp backups/babel-pocket-YYYYMMDD-HHMMSS.sqlite data/babel.sqlite
pm2 start babel-pocket
```

For Docker:

```bash
docker stop babel-pocket
docker cp ./backups/babel-pocket-YYYYMMDD-HHMMSS.sqlite babel-pocket:/app/data/babel.sqlite
docker start babel-pocket
```

After restore:

```bash
curl -fsS http://localhost:3000/livez
curl -fsS http://localhost:3000/readyz
```

If readiness fails because provider setup was restored to an older state, log in to the dashboard and re-save the provider configuration.

## JSON Export Escape Hatch

Babel Pocket can export the SQLite store to the legacy JSON shape for inspection or rollback workflows:

```bash
npm run db:export:json
```

To import an existing legacy JSON file into SQLite:

```bash
npm run db:migrate
```

Use `npm run db:migrate -- --force` only when you intentionally want to overwrite an existing SQLite database.
