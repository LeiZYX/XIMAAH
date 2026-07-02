# Verbose Docker build (run on the Ubuntu host for plain, uncompressed BuildKit logs):
#   DOCKER_BUILDKIT=1 \
#   BUILDKIT_PROGRESS=plain \
#   BUILDKIT_STEP_LOG_MAX_SIZE=-1 \
#   BUILDKIT_STEP_LOG_MAX_SPEED=-1 \
#   docker compose build --progress=plain --no-cache app
#
# Or without BuildKit:
#   DOCKER_BUILDKIT=0 docker compose build --no-cache app

FROM node:20-bookworm-slim AS base
RUN sed -i 's|http://deb.debian.org/debian|http://mirrors.aliyun.com/debian|g' /etc/apt/sources.list.d/debian.sources && \
    sed -i 's|http://deb.debian.org/debian-security|http://mirrors.aliyun.com/debian-security|g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update && \
    apt-get install -y openssl && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}
ENV CI=1
ENV NPM_CONFIG_LOGLEVEL=verbose
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PRIVATE_BUILD_VERBOSE=1
ENV NODE_OPTIONS=--max-old-space-size=1024

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN echo "=== [1/4] node version ===" \
  && node --version \
  && echo "=== [1/4] done ==="

RUN echo "=== [2/4] npm version ===" \
  && npm --version \
  && echo "=== [2/4] done ==="

RUN echo "=== [3/4] prisma generate ===" \
  && npm run db:generate \
  && echo "=== [3/4] done ==="

# Line-buffered output so Ubuntu/BuildKit shows logs as they are produced.
# next build --debug (-d) is supported by Next.js 16 for verbose build output.
RUN echo "=== [4/4] next build (debug) starting at $(date -u +%Y-%m-%dT%H:%M:%SZ) ===" \
  && stdbuf -oL -eL npm run build -- --debug \
  && echo "=== [4/4] next build done at $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=1024
WORKDIR /app

RUN apt-get update && \
    apt-get install -y default-mysql-client gosu && \
    rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/src/lib ./src/lib
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER root
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
