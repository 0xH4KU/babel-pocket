<div align="center">

<img src="assets/babel-pocket-logo-transparent.png" alt="Babel Pocket" width="120">

# Babel Pocket

**Self-hosted user-install Discord translator for you and friends.**

Right-click any message -> Apps -> **Babel Pocket** -> get a private translation only you can see.
You host the app, bring your own AI provider key, whitelist the Discord users who may use it, and set per-user budgets so friend sharing does not turn into an open-ended bill.

[![License: GPL-3.0-only](https://img.shields.io/badge/License-GPL--3.0--only-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-22.12%2B-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![discord.js](https://img.shields.io/badge/discord.js-v14-blue.svg)](https://discord.js.org)
[![Version](https://img.shields.io/badge/version-0.1.0-brightgreen.svg)](package.json)
[![CI](https://github.com/0xH4KU/babel-pocket/actions/workflows/ci.yml/badge.svg)](https://github.com/0xH4KU/babel-pocket/actions)

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/babel-pocket?referralCode=euhy-o&utm_medium=integration&utm_source=template&utm_campaign=generic)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/0xh4ku)

[Live Dashboard Demo](https://0xh4ku.github.io/babel-discord-translator/demo/) ·
[Deployment Guide](docs/operations/deployment.md) ·
[Railway](docs/operations/railway.md) ·
[Docker Ops](docs/operations/docker.md) ·
[Changelog](CHANGELOG.md)

</div>

---

## What This Is

Babel Pocket is a fork of Babel focused on Discord **User Install** apps. It is designed for one self-hosted instance shared with a small set of trusted users, not a public hosted bot.

The original Babel project serves Discord communities and servers. Babel Pocket serves Discord users:

| Babel | Babel Pocket |
|---|---|
| Server/community bot | User-install personal translator |
| `Babel` context menu | `Babel Pocket` context menu |
| Server whitelist | User whitelist |
| Per-server budgets | Per-user budgets |
| Optional public `/translate` workflow | Private right-click translation only |

## Features

- **User-install command** — registers `Babel Pocket` for User Install with Guild, Bot DM, and Private Channel contexts.
- **Private context-menu translation** — right-click a message and receive an ephemeral/private response.
- **User whitelist** — only configured Discord user IDs can use your instance.
- **Per-user budgets** — custom daily USD caps per user, plus a default user budget.
- **Global hard cap** — total instance daily budget remains available as a safety net.
- **Bring your own provider** — Vertex AI Gemini or OpenAI-compatible provider settings from the dashboard.
- **No privileged intents** — uses interactions, not message-content gateway access.
- **Dashboard** — setup wizard, provider config, prompt editing, usage, health checks, logs, sessions, user access, and user language preferences.

Not included in the Babel Pocket product surface:

- Public `/translate` webhook output
- Server-oriented install flow
- Server whitelist as the main access model
- Public hosted-bot billing or subscriptions

## Quick Start

Prerequisites: Node.js `22.12+`, npm, a Discord application with a bot token, and a configured translation provider.

```bash
git clone https://github.com/0xH4KU/babel-pocket.git
cd babel-pocket
npm install
cp .env.example .env
```

Edit `.env`:

```env
DISCORD_TOKEN=your_bot_token_here
DASHBOARD_PORT=3000
DASHBOARD_PASSWORD=your_strong_password
```

Run locally:

```bash
npm run dev
```

For production:

```bash
npm run build
npm start
```

Open `http://localhost:3000`, log in, finish provider setup, then add allowed Discord user IDs in the Access tab.

## Discord Setup

1. Create an application in the [Discord Developer Portal](https://discord.com/developers/applications).
2. On **Installation**, enable **User Install**.
3. In default install settings for **User Install**, add the `applications.commands` scope.
4. On **Bot**, create/copy the bot token. No privileged intents are required.
5. Register commands:

```bash
DISCORD_APP_ID=your_app_id DISCORD_BOT_TOKEN=your_token npm run register
```

This registers:

- `Babel Pocket` message context menu
- `/setlang`
- `/mylang`
- `/help`

It intentionally does not register `/translate`.

## Access And Budgets

Babel Pocket treats the user-install owner as the billing owner.

Rules:

1. The user-install owner must be listed in `allowedUserIds`.
2. If a custom per-user budget exists, it is enforced.
3. Otherwise `defaultUserDailyBudgetUsd` is enforced.
4. The global daily budget still caps the whole instance.
5. Cooldown and runtime queue limits still protect the service from bursts.

The dashboard Access tab manages:

- allowed user IDs
- custom per-user daily budgets
- user language preferences

## Configuration

All runtime configuration is managed through the dashboard. Environment variables are only for bootstrapping and deployment:

| Variable | Description | Default |
|---|---|---|
| `DISCORD_TOKEN` | Discord bot token | required |
| `PORT` | Platform-provided dashboard web server port | unset |
| `DASHBOARD_PORT` | Dashboard web server port | `3000` |
| `DASHBOARD_HOST` | Dashboard bind host | `0.0.0.0` |
| `DASHBOARD_PASSWORD` | Dashboard login password | `admin` in development only |
| `BABEL_DB_PATH` | SQLite database path | `data/babel.sqlite` |

## Commands

| Command | Purpose |
|---|---|
| `Babel Pocket` | Right-click message translation |
| `/setlang` | Set your preferred target language |
| `/mylang` | Show your current target language |
| `/help` | Show usage help |

## Development

```bash
npm run typecheck
npm test
npm run build
```

The test suite covers command registration, user-scoped access and budgets, translation service authorization, SQLite persistence, dashboard APIs, provider orchestration, cache, logs, and health checks.

## Notes For Fork Maintenance

This fork intentionally keeps much of Babel's project shape: provider clients, translation service, dashboard auth, SQLite store, cache, metrics, health checks, and deployment scripts. The major product conversion is the access and budget scope: server concepts become user concepts.

Some server-oriented modules and compatibility tests may remain while the fork stabilizes. They are not part of the Babel Pocket user-facing product surface unless explicitly documented above.
