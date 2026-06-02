# Railway Deployment

Railway is a simple hosted self-deploy path for Babel Pocket. Each project owner runs their own instance, brings their own Discord token and AI provider credentials, and pays Railway/API usage directly. Babel Pocket is designed for account-level User Install sharing with a small whitelist, not a public hosted bot.

> Railway template links may support maintenance through Railway's template kickback program. Babel Pocket remains free and open source; sponsorship or affiliate attribution does not unlock private features.

## Railway-Ready Files

The repository is Railway-ready:

- `railway.json` defines the `/livez` healthcheck and restart policy.
- Babel Pocket reads Railway's `PORT` before `DASHBOARD_PORT`.
- Babel Pocket binds the dashboard to `DASHBOARD_HOST`, which defaults to `0.0.0.0`.
- The Docker image stores SQLite data under `/app/data` when `BABEL_DB_PATH=/app/data/babel.sqlite`.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/babel-pocket?referralCode=euhy-o&utm_medium=integration&utm_source=template&utm_campaign=generic)

## Required Variables

Set these in Railway service variables:

| Variable | Value |
| --- | --- |
| `DISCORD_TOKEN` | Discord bot token |
| `DASHBOARD_PASSWORD` | Strong random password |
| `NODE_ENV` | `production` |
| `BABEL_DB_PATH` | `/app/data/babel.sqlite` |

Optional variables:

| Variable | Value |
| --- | --- |
| `DASHBOARD_HOST` | `0.0.0.0` |
| `DASHBOARD_PORT` | `3000` for non-Railway deploys; Railway's `PORT` takes precedence |

Do not put provider API keys in template defaults. Configure Vertex AI or OpenAI-compatible provider settings from the dashboard after first login.

## Persistent SQLite

Create a Railway volume and mount it at:

```text
/app/data
```

Railway's build system uses `/app` as the application directory, so mounting the volume at `/app/data` persists `babel.sqlite` across restarts and redeploys.

If you use the Docker image on Railway, volumes are mounted as root. Babel Pocket's Docker image runs as the non-root `babel` user, so set this Railway variable if the volume is not writable:

```text
RAILWAY_RUN_UID=0
```

## First Boot

1. Deploy from the Babel Pocket GitHub repository or your own fork.
2. Add the required variables.
3. Attach the volume at `/app/data`.
4. Generate a Railway public domain for the service.
5. Open the public URL and log in with `DASHBOARD_PASSWORD`.
6. Complete the setup wizard and configure the translation provider.
7. Add allowed Discord user IDs in Access.
8. Set `Default User Daily Budget` and any custom user budgets.

Check the public health endpoint:

```bash
curl -fsS https://YOUR_RAILWAY_DOMAIN/livez
```

`/readyz` may return `503` until setup is complete and the configured provider passes its readiness check.

## Updates And Autodeploys

Railway can autodeploy services connected directly to a GitHub repository and branch. For a self-hosted Babel Pocket instance, review changes before rollout, especially migrations, budget behavior, command registration, and provider config.

Recommended update flow:

1. Back up `BABEL_DB_PATH` or the Railway volume before major upgrades.
2. Review the changelog or commit diff.
3. Redeploy the latest source from your fork.
4. Check `/livez`, `/readyz`, `/metrics`, and the dashboard after deployment.

The dashboard version badge checks the latest GitHub release periodically and caches that result for one hour. Use the refresh button beside the version badge to force a fresh check when you are preparing an update.

## Register Discord Commands

Register commands from a local checkout:

```bash
DISCORD_APP_ID=your_app_id DISCORD_BOT_TOKEN=your_token npm run register
```

Or run the same command in a Railway shell with `DISCORD_APP_ID` and `DISCORD_BOT_TOKEN` set. This registers the `Babel Pocket` context menu plus `/setlang`, `/mylang`, and `/help`.

## Template Publishing Checklist

Before publishing a Railway template:

- Use the GitHub repository as the template source.
- Confirm Railway detects the root `Dockerfile`.
- Add required variables with clear descriptions and no secret defaults.
- Add a volume mounted at `/app/data`.
- Generate a public domain.
- Verify `/livez` returns `200`.
- Log in to the dashboard and confirm the setup wizard loads.
- Add a short disclosure that Railway may charge hosting usage and that template attribution may support maintenance.

Railway's template kickback program currently requires marketplace publication. Their docs describe a usage kickback for deployed public templates, with possible support bonuses when template questions are handled through the Template Queue.
