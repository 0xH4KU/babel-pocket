# Railway Deployment

Railway is the easiest hosted self-deploy path for Babel. It keeps the project aligned with the original model: every server owner runs their own bot instance, brings their own Discord token and AI provider credentials, and pays Railway/API usage directly instead of paying Babel for a hosted subscription.

> Railway template links may support Babel maintenance through Railway's template kickback program. Babel remains free and open source; sponsorship or affiliate attribution does not unlock private features.

## One-Click Template Status

The repository is Railway-ready:

- `railway.json` defines the `/livez` healthcheck and restart policy.
- Babel reads Railway's `PORT` before `DASHBOARD_PORT`.
- Babel binds the dashboard to `DASHBOARD_HOST`, which defaults to `0.0.0.0`.
- The Docker image stores SQLite data under `/app/data` when `BABEL_DB_PATH=/app/data/babel.sqlite`.

After publishing the Railway template, replace this placeholder with the real template URL:

```md
[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/new/template/YOUR_TEMPLATE_ID?utm_medium=integration&utm_source=button&utm_campaign=babel)
```

## Required Variables

Set these in the Railway template or service variables:

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

Do not put provider API keys in the template defaults. Configure Vertex AI or OpenAI-compatible provider settings from the dashboard after first login.

## Persistent SQLite

Create a Railway volume and mount it at:

```text
/app/data
```

Railway's build system uses `/app` as the application directory, so mounting the volume at `/app/data` persists `babel.sqlite` across restarts and redeploys.

If you use the Docker image on Railway, volumes are mounted as root. Babel's Docker image runs as the non-root `babel` user, so set this Railway variable if the volume is not writable:

```text
RAILWAY_RUN_UID=0
```

## First Boot

1. Deploy the template or connect the GitHub repo.
2. Add the required variables.
3. Attach the volume at `/app/data`.
4. Generate a Railway public domain for the service.
5. Open the public URL and log in with `DASHBOARD_PASSWORD`.
6. Complete the setup wizard and configure the translation provider.

Check the public health endpoint:

```bash
curl -fsS https://YOUR_RAILWAY_DOMAIN/livez
```

`/readyz` may return `503` until setup is complete and the configured provider passes its readiness check.

## Register Discord Commands

Register commands from a local checkout:

```bash
DISCORD_APP_ID=your_app_id DISCORD_BOT_TOKEN=your_token npm run register
```

Or run the same command in a Railway shell with `DISCORD_APP_ID` and `DISCORD_BOT_TOKEN` set. This registers the `Babel` context menu plus `/translate`, `/setlang`, `/mylang`, and `/help`.

## Template Publishing Checklist

Before publishing the marketplace template:

- Use the GitHub repository as the template source.
- Confirm Railway detects the root `Dockerfile`.
- Add required variables with clear descriptions and no secret defaults.
- Add a volume mounted at `/app/data`.
- Generate a public domain.
- Verify `/livez` returns `200`.
- Log in to the dashboard and confirm the setup wizard loads.
- Add a short disclosure that Railway may charge hosting usage and that template attribution may support upstream maintenance.

Railway's template kickback program currently requires marketplace publication. Their docs describe a 15% usage kickback for deployed public templates, with a possible support bonus bringing it to 25% when template questions are handled through the Template Queue.
