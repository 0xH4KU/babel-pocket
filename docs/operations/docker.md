# Docker Deployment And Operations

This guide is for running Babel Pocket as your own self-hosted Discord user-install translator. You provide the Discord bot token, dashboard password, hosting, and AI provider key. Whitelisted Discord users can install the app to their own account and use the **Babel Pocket** right-click command.

## Install Docker On Ubuntu 24.04 ARM

Update the host and install curl:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install curl -y
```

Install Docker:

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

Allow your user to run Docker without sudo:

```bash
sudo usermod -aG docker $USER
```

Log out and back in so the group change takes effect.

## First Deployment

Prepare the environment file:

```bash
cp .env.example .env
nano .env
```

Set at least:

```env
DISCORD_TOKEN=your_bot_token_here
DASHBOARD_PASSWORD=replace_with_a_strong_password
DASHBOARD_PORT=3000
DASHBOARD_HOST=0.0.0.0
BABEL_DB_PATH=/app/data/babel.sqlite
NODE_ENV=production
```

Start with Docker Compose:

```bash
docker compose up -d --build
```

Or build and run manually:

```bash
docker build -t babel-pocket .
docker run -d \
  --name babel-pocket \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env \
  -v babel_pocket_data:/app/data \
  babel-pocket
```

Verify the container:

```bash
curl -fsS http://localhost:3000/livez
curl -fsS http://localhost:3000/readyz
```

Open `http://localhost:3000`, log in with `DASHBOARD_PASSWORD`, complete the setup wizard, add allowed Discord user IDs, and configure default/custom user budgets.

## Updating Babel Pocket

Back up the SQLite database first:

```bash
mkdir -p backups
docker exec babel-pocket sh -lc "sqlite3 /app/data/babel.sqlite \".backup '/app/data/babel-pocket-backup.sqlite'\"" || true
docker cp babel-pocket:/app/data/babel-pocket-backup.sqlite ./backups/babel-pocket-$(date +%Y%m%d-%H%M%S).sqlite || true
```

Then update:

```bash
git pull
docker compose up -d --build
docker image prune -f
```

For manual Docker runs:

```bash
git pull
docker build -t babel-pocket .
docker stop babel-pocket
docker rm babel-pocket
docker run -d \
  --name babel-pocket \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env \
  -v babel_pocket_data:/app/data \
  babel-pocket
docker image prune -f
```

Verify after updating:

```bash
curl -fsS http://localhost:3000/livez
curl -fsS http://localhost:3000/readyz
docker logs --tail 100 babel-pocket
```

## Common Operations

View logs:

```bash
docker logs -f babel-pocket
```

Restart:

```bash
docker restart babel-pocket
```

Open a shell:

```bash
docker exec -it babel-pocket sh
```

Stop and remove the container:

```bash
docker stop babel-pocket
docker rm babel-pocket
```

Remove the image:

```bash
docker rmi babel-pocket
```

Remove the data volume only when you intentionally want to delete all persisted config, user whitelist, budgets, and usage data:

```bash
docker volume rm babel_pocket_data
```

## Migrating Hosts

Back up `.env` securely. It contains your Discord token and dashboard settings.

Create a SQLite backup from the old host:

```bash
mkdir -p backups
docker exec babel-pocket sh -lc "sqlite3 /app/data/babel.sqlite \".backup '/app/data/babel-pocket-backup.sqlite'\""
docker cp babel-pocket:/app/data/babel-pocket-backup.sqlite ./backups/babel-pocket.sqlite
```

Copy these files to the new host:

- `.env`
- `backups/babel-pocket.sqlite`

On the new host, restore into a bind mount:

```bash
mkdir -p babel_pocket_data_backup
cp backups/babel-pocket.sqlite babel_pocket_data_backup/babel.sqlite
docker build -t babel-pocket .
docker run -d \
  --name babel-pocket \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env \
  -v $(pwd)/babel_pocket_data_backup:/app/data \
  babel-pocket
```

Then verify:

```bash
curl -fsS http://localhost:3000/livez
curl -fsS http://localhost:3000/readyz
```
