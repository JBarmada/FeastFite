# FeastFite

Food-themed territorial webapp. Cute food monsters claim restaurant territories, compete in timed votes, and hold land for points.

---

## Start everything (full stack)

After cloning once, these 3 commands start the entire app.

```bash
npm run setup        # copies .env.example to .env for every service (safe to re-run)
npm run dev:infra    # starts all databases + Redis + RabbitMQ + MinIO in Docker background
npm run dev          # starts all 5 services + frontend in one terminal
```

Open **http://localhost:5173** — register an account and you are in.

That is it. Three commands, one terminal for services, Docker handles the rest in the background.

---

## One-time first install

Run these once right after cloning.

**Mac / Linux**
```bash
git clone https://github.com/JBarmada/FeastFite.git
cd FeastFite
npm install
npm run build -w packages/shared
```

**Windows (PowerShell)**
```powershell
git clone https://github.com/JBarmada/FeastFite.git
cd FeastFite
npm install
npm run build -w packages/shared
```

Then follow the "Start everything" section above.

---

## All npm scripts

| Script | What it does |
|--------|-------------|
| `npm run setup` | Copies `.env.example` to `.env` for every service. Safe to re-run. |
| `npm run dev:infra` | Starts all Docker infra (Postgres x5, Redis, RabbitMQ, MinIO) in background. |
| `npm run dev` | Starts all 5 services + frontend together in one terminal via concurrently. |
| `npm run build:shared` | Compiles the shared package. Run this after pulling changes to packages/shared. |
| `npm run typecheck` | Type-checks the entire monorepo. Run before pushing. |

---

## Start only your service (for focused dev work)

You only need to start the infra and service you own.

**Dev A — Auth**
```bash
npm run setup
docker-compose up postgres-auth redis -d
npm run dev -w services/auth-service   # Terminal 1
npm run dev -w frontend                # Terminal 2
```

**Dev B — Territory**
```bash
npm run setup
docker-compose up postgres-territory -d
npm run dev -w services/territory-service   # Terminal 1
npm run dev -w frontend                     # Terminal 2
```

**Dev C — Voting**
```bash
npm run setup
docker-compose up postgres-vote rabbitmq minio -d
npm run dev -w services/vote-service   # Terminal 1
npm run dev -w frontend                # Terminal 2
```

**Dev D — Economy + Profiles**
```bash
npm run setup
docker-compose up postgres-economy postgres-profile redis -d
npm run dev -w services/economy-service   # Terminal 1 (or split into 2)
npm run dev -w services/profile-service   # Terminal 2
npm run dev -w frontend                   # Terminal 3
```

---

## Port reference

| Service | Port |
|---------|------|
| Frontend | 5173 |
| auth-service | 3001 |
| territory-service | 3002 |
| vote-service | 3003 |
| economy-service | 3004 |
| profile-service | 3005 |
| Postgres (auth) | 5432 |
| Postgres (territory) | 5433 |
| Postgres (vote) | 5434 |
| Postgres (economy) | 5435 |
| Postgres (profile) | 5436 |
| Redis | 6379 |
| RabbitMQ | 5672 (AMQP) / 15672 (UI) |
| MinIO | 9000 (API) / 9001 (UI) |

---

## Quick health check

```bash
curl http://localhost:3001/health
# {"status":"ok","service":"auth-service"}

curl http://localhost:3002/health
# {"status":"ok","service":"territory-service"}
```

**Windows PowerShell:**
```powershell
curl.exe http://localhost:3001/health
```

---

## Adding or editing territory locations on the map

Territories are real restaurant polygons traced in Google My Maps and exported as GeoJSON. Follow these steps to add a new restaurant or adjust an existing one.

### Step 1 — Edit the map in Google My Maps

Open the shared map:
[https://www.google.com/maps/d/u/0/edit?mid=1Vh3itYPP609qoCCK6L4NsNN68X5b6nE](https://www.google.com/maps/d/u/0/edit?mid=1Vh3itYPP609qoCCK6L4NsNN68X5b6nE)

**To move or reshape an existing polygon:**
Click on the shape, then click it again until the corner handles appear. Drag the corners or edges to adjust. It sometimes takes a couple of clicks before the edit handles show up.

**To add a new location:**
Click the **Draw a line** icon in the toolbar below the search bar (looks like a graph/line icon). Then click on the map to place points one at a time — a triangle is fine to start, you can reshape it after. When you close the shape (click back on the first point) it will prompt you to name it. **Name it after the actual restaurant** (e.g. `Shake Shack`).

Once you have the shape placed, drag it into the correct spot and adjust any neighbouring polygons so nothing overlaps.

### Step 2 — Export as KML

Click the **three dots (⋮)** to the right of the "FeastFite USC Village" layer name in the left panel and choose **Export to KML/KMZ**. In the dialog, **check the box to export as KML** (not KMZ) and click Download. This saves a `.kml` file to your computer.

### Step 3 — Convert KML to GeoJSON

Go to [https://geojson.io](https://geojson.io/#map=17.17/34.025556/-118.284724) and click **Open → File** in the top menu. Select the `.kml` file you just downloaded. The polygons will appear on the map preview. Switch to the **JSON** tab on the right side and copy the entire JSON.

### Step 4 — Update the seed file

Paste the copied GeoJSON into a chat with Claude or ChatGPT and say:

> Update `services/territory-service/src/db.ts` (the `SEED_TERRITORIES` array) and `services/territory-service/scripts/seedTerritories.ts` to match this GeoJSON. Keep the fun alliterative in-game names for existing territories (e.g. Dulce Dream Den, Chickpea Citadel). Add new ones with a matching alliterative food name.

Apply the changes, then the new territories will appear automatically next time the territory service starts on a fresh database. To force an immediate update on an already-running database, run:

```bash
cd services/territory-service && npx tsx scripts/seedTerritories.ts
```

---

## Common problems

| Symptom | Fix |
|---------|-----|
| `Cannot find module @feastfite/shared` | Run `npm run build -w packages/shared` |
| Service crashes on start with missing env vars | Run `npm run setup` to generate `.env` files |
| `EADDRINUSE` port already in use | Another process owns that port — restart Docker or kill it |
| Map loads but is blank | territory-service is not running (Dev B service) |
| Login or register returns 500 | Check the auth-service terminal for the actual error |
| `docker-compose` command not found | Install Docker Desktop and make sure it is running |

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Backend | Node.js + TypeScript (Express 5) |
| Frontend | React 18 + TypeScript (Vite) |
| Map | Leaflet + React-Leaflet |
| Real-time | Socket.io (vote-service only) |
| API Gateway | Kong 3.6 (declarative, DB-less) |
| Database | PostgreSQL 16 (one per service) |
| Geospatial | PostGIS on territory-service |
| Cache | Redis 7 |
| Events | RabbitMQ 3.13 |
| Object storage | MinIO (S3-compatible, self-hosted) |

---

## Repo structure

```
FeastFite/
├── scripts/setup.js          cross-platform env setup script
├── packages/shared/          shared types, JWT helpers, AMQP factory
├── services/
│   ├── api-gateway/          kong.yml + Dockerfile
│   ├── auth-service/         Dev A  (port 3001)
│   ├── territory-service/    Dev B  (port 3002)
│   ├── vote-service/         Dev C  (port 3003)
│   ├── economy-service/      Dev D  (port 3004)
│   └── profile-service/      Dev D  (port 3005)
├── frontend/                 React + Vite  (port 5173)
│   └── src/
│       ├── components/
│       │   ├── layout/       Navbar - shared by all pages
│       │   ├── map/          Dev B
│       │   ├── voting/       Dev C
│       │   └── economy/      Dev D
│       ├── pages/
│       └── api/              typed axios clients per service
└── k8s/                      Kubernetes manifests
```
