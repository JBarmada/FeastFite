Project Theme
Cute little food monsters are the user profiles, imagine them decorating the map that people look at. It should all be sweet and food themed kinda like candy crush. 


Context
Monster grubby guy icons, food-themed territorial webapp built from a blank repo. Users claim restaurant territories by uploading meal photos, compete via timed votes, and hold/defend land for points. The goal of this plan is to define the microservices architecture, tech stack, and how to split work cleanly across 4 developers so nobody is blocked on day 1.

Tech Stack
Layer
Choice
Rationale
Backend
Node.js + TypeScript (Express)
Consistent language across all 5 services; any dev can help any other
Frontend
React + TypeScript (Vite)
Fast DX, strong typing, component-per-developer ownership
Map
Leaflet.js + React-Leaflet
Open-source, no API key friction, polygon/overlay support
Real-time
Socket.io (vote-service only)
WebSocket rooms keyed by voting session ID
API Gateway
Kong 3.6 (declarative, no DB)
JWT validation, rate-limiting, CORS, WebSocket proxy — zero custom code
Primary DB
PostgreSQL 16 (one per service)
ACID, relational, familiar
Geospatial
PostGIS on territory-service Postgres
Polygon boundary and lat/lng queries
Cache / timers
Redis 7
Lock TTL keys, leaderboard sorted sets, token blocklist
Event bus
RabbitMQ 3.13 (topic exchange)
Async fan-out between services; simpler ops than Kafka at this scale
Object storage
MinIO (S3-compatible, self-hosted)
Food photos + avatars; swap for S3 in production
Container
Docker + Kubernetes
Each service is its own container + K8s Deployment


Microservices
auth-service
Register, login, JWT (15min access + 7d refresh httpOnly cookie)
Refresh token rotation with Redis blocklist
Google OAuth2 (stretch)
territory-service
Territory polygon CRUD with PostGIS
Claim state machine: unclaimed → voting → claimed → locked
12-hour lock stored as lockedUntil timestamp (Postgres authoritative) + Redis TTL key for events
Battering-ram unlock: calls economy-service to deduct item, then clears lock
Territory shield: blocks ownership change on vote.winner_declared
Consumes: vote.winner_declared → updates owner, color, name, dish photo
Emits: territory.claimed
vote-service
MinIO presigned URL generation for photo upload (frontend uploads directly to MinIO)
10-minute voting session with Socket.io room per session
Vote tally + winner selection; tie-breaking by random if equal
Emits: vote.winner_declared, vote.participant
economy-service
Append-only points ledger (user_id, delta, reason, created_at)
Shop catalog (seeded): double-points 100pts, shield 200pts, battering-ram 500pts
Item inventory per user
IAP webhook (Stripe test mode → award points)
Consumes: vote.winner_declared, vote.participant, territory.claimed
profile-service
Profile CRUD (avatar via MinIO avatars bucket)
Achievements engine (JSON config, event-driven evaluator)
Streak cron (node-cron inside container, daily check)
Redis leaderboard sorted sets (ZADD leaderboard:global)
Clan CRUD: create, join, leave, clan leaderboard
Consumes: territory.claimed, vote.winner_declared, item.purchased, user.registered

Inter-Service Communication
Synchronous REST (via API Gateway):
Frontend → all services
territory-service → economy-service (synchronous inventory check for battering-ram)
Async RabbitMQ (topic exchange foodwars.events):
vote-service       --[vote.winner_declared]--> territory-service, economy-service, profile-service
vote-service       --[vote.participant]-------> economy-service
territory-service  --[territory.claimed]------> profile-service, economy-service
economy-service    --[item.purchased]----------> territory-service, profile-service
auth-service       --[user.registered]---------> profile-service
WebSocket (internal to vote-service only):
wss://api/ws/vote/{sessionId} proxied by Kong
Used only for live vote count updates during 10-minute windows
All other timers (lock countdown) are frontend-computed from lockedUntil timestamp

4-Developer Delegation
Dev A — "Gatekeeper" (Auth + Infrastructure)
Owns: auth-service, Kong gateway config, base docker-compose, K8s namespace/configmap/secrets-template, k8s/gateway/, k8s/auth/
Backend deliverables:
JWT issuance, refresh rotation, /auth/register, /auth/login, /auth/refresh, /auth/logout
Redis refresh token blocklist
Emits user.registered
Frontend deliverables:
src/contexts/AuthContext.tsx — JWT storage in memory + httpOnly refresh cookie
PrivateRoute wrapper (used by all other devs to gate pages)
LoginPage, RegisterPage, ForgotPasswordPage
Unblocks everyone: AuthContext + PrivateRoute should land by end of day 1.

Dev B — "Mapmaker" (Territory Service)
Owns: territory-service, PostGIS setup, k8s/territory/
Backend deliverables:
GET /territories?bbox=minLng,minLat,maxLng,maxLat (polygon bounding box)
GET /territories/:id
POST /territories/:id/claim (starts vote session via vote-service or directly if uncontested)
POST /territories/:id/battering-ram (checks/deducts from economy-service, clears lock)
RabbitMQ consumer: vote.winner_declared → commit ownership
Territory polygon seed script (~50 territories around a test city)
Frontend deliverables:
MapView (Leaflet + React-Leaflet, colored polygons per owner)
TerritoryPanel (sidebar: owner, dish photo, avatar, lock countdown)
ClaimButton (triggers upload flow owned by Dev C)
LockCountdown (pure frontend timer from lockedUntil)

Dev C — "Referee" (Vote + Upload Service)
Owns: vote-service, MinIO setup, RabbitMQ StatefulSet, k8s/vote/, k8s/infra/minio.yml, k8s/infra/rabbitmq.yml
Backend deliverables:
POST /votes/upload-url → returns MinIO presigned PUT URL
POST /votes/sessions → creates voting session { territoryId, photoKey }
Socket.io server: rooms per session, broadcast live vote counts
10-minute window timer (Redis distributed lock to prevent duplicate on restart)
Tally + emit vote.winner_declared, vote.participant
Frontend deliverables:
UploadModal — camera/file picker, photo preview, submit
VotingRoom — live vote counts, candidate dishes, vote button, countdown (WebSocket-driven)
WinnerAnnouncement — overlay shown to all session participants

Dev D — "Economist" (Economy + Profile Services)
Owns: economy-service, profile-service, Redis StatefulSet, k8s/economy/, k8s/profile/, k8s/infra/redis.yml
Backend deliverables (economy):
Append-only points ledger
GET /economy/balance/:userId, POST /economy/award, POST /economy/spendx`


Shop item catalog + POST /economy/shop/purchase
Item inventory CRUD
Stripe IAP webhook stub
Backend deliverables (profile):
Profile CRUD + avatar upload (MinIO avatars bucket)
Achievement definitions (JSON seed) + event-driven evaluator
Daily streak cron (node-cron)
Redis sorted-set leaderboard
Clan CRUD
Frontend deliverables:
ProfilePage (stats, achievements, streak, cosmetic decor picker)
ShopPage (item catalog, points balance, purchase button)
InventoryWidget (header: active buffs/items)
LeaderboardPage (global + clan tabs)
ClanPage (create/join, member list)

Monorepo Structure
team_j-bert/
├── docker-compose.yml              ← Dev A writes; all infra services + service stubs
├── .env.example                    ← All env vars documented
├── events/schemas/                 ← Shared RabbitMQ event type definitions (agree day 1)
│   ├── vote.winner_declared.ts
│   ├── territory.claimed.ts
│   ├── item.purchased.ts
│   └── user.registered.ts
├── packages/shared/                ← Internal npm package @foodwars/shared
│   ├── types/                      ← Shared TypeScript interfaces
│   └── utils/
│       ├── jwt.ts                  ← JWT verify helper (all services use this)
│       └── amqp.ts                 ← RabbitMQ connection factory
├── services/
│   ├── api-gateway/                ← kong.yml + Dockerfile
│   ├── auth-service/               ← Dev A
│   ├── territory-service/          ← Dev B
│   ├── vote-service/               ← Dev C
│   ├── economy-service/            ← Dev D
│   └── profile-service/            ← Dev D
├── frontend/                       ← React/Vite; components divided by dev
│   └── src/
│       ├── contexts/AuthContext.tsx ← Dev A (unblocks all others)
│       ├── components/
│       │   ├── map/                ← Dev B
│       │   ├── voting/             ← Dev C
│       │   ├── economy/            ← Dev D
│       │   └── profile/            ← Dev D
│       └── api/                    ← Typed API clients per service
└── k8s/
    ├── namespace.yml               ← Dev A
    ├── infra/                      ← postgres, redis (D), rabbitmq (C), minio (C)
    ├── gateway/                    ← Dev A
    ├── auth/                       ← Dev A
    ├── territory/                  ← Dev B
    ├── vote/                       ← Dev C
    ├── economy/                    ← Dev D
    └── profile/                    ← Dev D

Image Upload Flow (no binary traffic through Kong)
Frontend: POST /api/v1/votes/upload-url → vote-service returns MinIO presigned PUT URL
Frontend uploads image directly to MinIO (bypass gateway)
Frontend: POST /api/v1/votes/sessions with { territoryId, photoKey }

Critical Path
Day 1 (team alignment — 30 min meeting)
Agree and commit:
events/schemas/*.ts type definitions
JWT payload shape: { sub: userId, email, iat, exp }
API URL prefix: /api/v1/{service}/{resource}
docker-compose.yml with all infra running
Week 1 — Parallel scaffolding (all 4 devs simultaneously)
A: Auth skeleton + AuthContext + PrivateRoute + docker-compose
B: Territory PostGIS schema + GET /territories?bbox + Leaflet map with seeded data
C: MinIO setup + photo upload + Socket.io hello-world
D: Points ledger endpoints + shop catalog + profile CRUD
Week 2 — Core gameplay loop
Goal: see map → upload photo → vote → territory changes color
A: Full auth flows working
B: Claim submission + RabbitMQ consumer for vote.winner_declared → color change on map
C: 10-min voting window + Socket.io voting room + emit vote.winner_declared
D: RabbitMQ consumer awarding points, balance visible in header
Week 3 — Economy and social
B: Battering-ram unlock, territory shield
C: Tie-breaking, edge cases, photo moderation stub
D: Shop purchase flow, IAP webhook, clan CRUD, achievements, streak cron
Week 4 — K8s and polish
All devs write K8s manifests for their services; Dev A wires CI/CD (GitHub Actions build + push images).

Verification
docker-compose up brings all 5 services + infra online locally
Smoke test: register → login → see map → upload food photo → vote → territory claims
K8s: kubectl apply -f k8s/ deploys to local kind/minikube cluster
Each service has a GET /health endpoint returning { status: "ok", service: "..." }
RabbitMQ management UI (localhost:15672) confirms events are flowing between services

Critical Files to Create First
events/schemas/vote.winner_declared.ts — shared contract; all 3 downstream devs depend on it
packages/shared/utils/amqp.ts — shared RabbitMQ factory prevents divergent connection code
docker-compose.yml — every dev needs Postgres, Redis, RabbitMQ, MinIO running locally
services/auth-service/src/index.ts — JWT middleware; needed by all services
frontend/src/contexts/AuthContext.tsx — needed by all frontend components