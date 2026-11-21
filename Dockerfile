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
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app ./
# Private uploads (videos, books, submissions) — mount a persistent volume here
RUN mkdir -p /app/storage
VOLUME ["/app/storage"]
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start -- -p ${PORT:-3000}"]
