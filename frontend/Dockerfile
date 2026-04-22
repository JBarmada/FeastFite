# ── Stage 1: Build ───────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json          ./packages/shared/
COPY frontend/package.json                 ./frontend/

RUN npm ci

# Copy source
COPY packages/shared  ./packages/shared
COPY frontend         ./frontend

# Build shared first (frontend imports @feastfite/shared)
RUN npm run build -w packages/shared
RUN npm run build -w frontend

# ── Stage 2: Serve ───────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
