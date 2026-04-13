# ── Stage 1: Builder ─────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY services/vote-service/package.json ./services/vote-service/
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY services/vote-service ./services/vote-service

RUN npm ci

RUN npm run build -w packages/shared
RUN npm run build -w services/vote-service

# ── Stage 2: Runtime ─────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/services/vote-service/dist ./services/vote-service/dist
COPY --from=builder /app/services/vote-service/package.json ./services/vote-service/package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

WORKDIR /app/services/vote-service
EXPOSE 3003

CMD ["node", "dist/index.js"]
