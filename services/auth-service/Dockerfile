# ── Stage 1: Builder ─────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY services/auth-service/package.json ./services/auth-service/
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY services/auth-service ./services/auth-service

RUN npm ci --workspace=packages/shared --workspace=services/auth-service

RUN npm run build -w packages/shared
RUN npm run build -w services/auth-service

# ── Stage 2: Runtime ─────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/services/auth-service/dist ./services/auth-service/dist
COPY --from=builder /app/services/auth-service/package.json ./services/auth-service/package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

WORKDIR /app/services/auth-service
EXPOSE 3001

CMD ["node", "dist/index.js"]
