# AU Forex Academy — production image (Railway, VPS, any Docker host)
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# OpenSSL is required by the Prisma schema engine (migrations)
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
COPY scripts ./scripts
RUN mkdir -p public && npm ci

FROM base AS build
# NEXT_PUBLIC_* values are compiled into the app. Railway passes service variables to the build
# only when they are declared with ARG. Without NEXT_PUBLIC_APP_URL the generated Railway domain is used.
ARG NEXT_PUBLIC_APP_URL
ARG RAILWAY_PUBLIC_DOMAIN
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The build needs no database and no secrets (all pages render per request).
RUN export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-${RAILWAY_PUBLIC_DOMAIN:+https://$RAILWAY_PUBLIC_DOMAIN}}" \
 && export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:3000}" \
 && echo "Building for $NEXT_PUBLIC_APP_URL" \
 && npx prisma generate && npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app ./
# Private uploads (videos, books, submissions) live in /app/storage.
# Attach persistent storage there: a Railway Volume (mount path /app/storage) or a Docker volume.
# (Do not declare volumes in this file: Railway rejects that and fails the build.)
RUN mkdir -p /app/storage
EXPOSE 3000
# Checks settings → migrations → seed (idempotent) → next start on $PORT
CMD ["node", "scripts/start-prod.mjs"]
