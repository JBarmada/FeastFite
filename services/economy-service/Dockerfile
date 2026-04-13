# ── Stage 1: Builder ─────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY services/economy-service/package.json ./services/economy-service/
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY services/economy-service ./services/economy-service

RUN npm ci

RUN npm run build -w packages/shared
RUN npm run build -w services/economy-service

# ── Stage 2: Runtime ─────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/services/economy-service/dist ./services/economy-service/dist
COPY --from=builder /app/services/economy-service/package.json ./services/economy-service/package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

WORKDIR /app/services/economy-service
EXPOSE 3004

CMD ["node", "dist/index.js"]
