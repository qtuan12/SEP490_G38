# Production Deployment

## Server

Recommended for thesis/demo usage under 50 users:

- Ubuntu 22.04 LTS
- 2 CPU cores
- 8 GB RAM
- 80 GB SSD

Open only ports `22`, `80`, and `443` in the cloud firewall. Do not expose SQL Server, Redis, Seq, or the backend port directly to the internet.

## Environment

Create the production env file on the server:

```bash
cp .env.production.example .env.production
nano .env.production
```

Set `FRONTEND_ORIGIN` to the public origin users will open in the browser:

```env
FRONTEND_ORIGIN=http://your-domain-or-server-ip
VITE_API_URL=/api
```

If HTTPS is enabled, use `https://...` for `FRONTEND_ORIGIN`.

## Run

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

Check backend health through Nginx:

```bash
curl http://your-domain-or-server-ip/health
```

## Seed Demo Data

For a clean thesis demo database, run seed once after containers are healthy:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec backend dotnet BPG.Api.dll --seed
```

Change the seeded admin/demo passwords immediately after the first login if the server is public.

## Backup SQL Server

Create a backup before the defense demo:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec db /bin/bash -c '/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -Q "BACKUP DATABASE [BPGDB] TO DISK = N'\''/var/opt/mssql/data/BPGDB.bak'\'' WITH INIT"'
```

Copy the backup out of the container:

```bash
docker cp bpg-db:/var/opt/mssql/data/BPGDB.bak ./BPGDB.bak
```
