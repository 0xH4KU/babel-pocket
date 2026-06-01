# Babel Pocket Deployment Guide

Babel Pocket is a self-hosted Discord translator for user-installed apps. You provide the Discord application, bot token, dashboard password, hosting, and AI provider credentials. Users install your app to their own Discord account and use **Babel Pocket** from the message right-click Apps menu.

This fork keeps the original Babel deployment shape, but access and budget decisions are user-scoped: user whitelist, default user budget, custom user budgets, and a global instance safety cap.

## Before You Deploy

You need:

- A Discord application with **User Install** enabled
- Node.js `22.5+` for local/VPS installs, or Docker for container installs
- A dashboard password that is not `admin`
- At least one configured translation provider in the dashboard after startup

Babel Pocket does not require privileged Discord intents.

## Discord Setup

1. Open the [Discord Developer Portal](https://discord.com/developers/applications).
2. Create an application.
3. Open **Installation** and enable **User Install**.
4. In default User Install settings, include the `applications.commands` scope.
5. Open **Bot** and copy the bot token.
6. Register commands:

```bash
DISCORD_APP_ID=your_app_id DISCORD_BOT_TOKEN=your_token npm run register
```

This registers the `Babel Pocket` message context menu plus `/setlang`, `/mylang`, and `/help`. It intentionally does not register `/translate`.

The command payload uses `integration_types: [1]` for User Install and `contexts: [0, 1, 2]` for guild channels, bot DMs, and private channels. See Discord's application command context docs for the exact API fields.

## Railway

Railway is a good fit for a small self-hosted instance shared with trusted users. Babel Pocket supports Railway's `PORT` variable, binds the dashboard on `0.0.0.0` by default, and includes `railway.json` for the `/livez` healthcheck.

Recommended environment variables:

| Variable | Value |
| --- | --- |
| `DISCORD_TOKEN` | Your Discord bot token |
| `DASHBOARD_PASSWORD` | A strong random password |
| `BABEL_DB_PATH` | `/app/data/babel.sqlite` |
| `NODE_ENV` | `production` |

Use a persistent volume mounted at `/app/data` so SQLite survives restarts and redeploys. If the Railway volume is not writable by the Docker image's non-root user, set `RAILWAY_RUN_UID=0` on the service.

After deployment:

1. Generate a Railway public domain.
2. Open the Railway public URL.
3. Log in with `DASHBOARD_PASSWORD`.
4. Complete the setup wizard and configure the provider.
5. Register Discord commands from a local checkout or Railway shell with `npm run register`.
6. Add allowed Discord user IDs in the Access tab.
7. Set the default user daily budget and any custom user budgets.
8. Check `/livez`, `/readyz`, and the dashboard Operations panel.

For persistent volume notes and the Railway checklist, see [Railway deployment](railway.md).

## Docker / VPS

Build and run:

```bash
docker build -t babel-pocket .
docker run -d \
  --name babel-pocket \
  --env-file .env \
  -p 3000:3000 \
  -v babel-pocket-data:/app/data \
  babel-pocket
```

Example `.env`:

```env
DISCORD_TOKEN=your_bot_token_here
DASHBOARD_PORT=3000
DASHBOARD_HOST=0.0.0.0
DASHBOARD_PASSWORD=replace_with_a_strong_password
BABEL_DB_PATH=/app/data/babel.sqlite
NODE_ENV=production
```

Verify:

```bash
curl -fsS http://localhost:3000/livez
curl -fsS http://localhost:3000/readyz
```

For Docker Compose, update, cleanup, backup, and host migration commands, see [Docker deployment and operations](docker.md).

## PM2

For a direct Node.js install:

```bash
npm install
npm run build
pm2 start ecosystem.config.cjs
pm2 save
```

Keep `data/babel.sqlite` backed up. See [SQLite backup and restore](sqlite-backup-restore.md).

## Static Dashboard Demo

The public dashboard demo is generated from the real dashboard assets with mock data:

```bash
npm run demo:build
```

The generated site lives in `docs/demo/`, so GitHub Pages can publish it from the `docs` folder. The demo is read-only, uses fixture JSON, and does not connect to Discord or any AI provider.

When the dashboard UI changes, run `npm run demo:build` before committing to refresh the mirrored demo.

## Operations Checks

After any deploy:

```bash
curl -fsS http://localhost:3000/livez
curl -fsS http://localhost:3000/readyz
curl -fsS http://localhost:3000/metrics | head
```

In the dashboard, check:

- Operations provider cards
- Runtime queue pressure
- Budget risk
- Translation test
- User whitelist
- Default and custom user budgets

## Support

Babel Pocket is free and self-hosted. If it saves setup time or helps you share a private translator with friends, you can support upstream maintenance on Ko-fi:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/0xh4ku)
