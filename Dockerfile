# syntax=docker/dockerfile:1
# Tip: pin the base image by digest for fully reproducible builds, e.g.
#   FROM node:22-alpine@sha256:<digest>
# Dependabot (.github/dependabot.yml) will then raise PRs when it changes.

# ---- Stage 1: install production dependencies only -------------------------
FROM node:26-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# ---- Stage 2: minimal runtime ----------------------------------------------
FROM node:26-alpine AS runtime
ARG GIT_SHA=local
ARG APP_VERSION=1.0.0
LABEL org.opencontainers.image.title="student-task-manager" \
      org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.source="https://github.com/ravinadh777/devsecops-capstone-app"
ENV NODE_ENV=production PORT=3000 GIT_SHA=${GIT_SHA} APP_VERSION=${APP_VERSION}

# Patch OS packages, then remove npm/corepack: they are not needed at runtime
# and are a frequent source of Trivy findings.
RUN apk upgrade --no-cache \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

WORKDIR /app
# Files stay owned by root: the non-root runtime user can read but not modify the code.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY public ./public

# 1000 = the "node" user in the official image; numeric so Kubernetes runAsNonRoot can verify it.
USER 1000:1000
EXPOSE 3000
HEALTHCHECK --interval=20s --timeout=3s --start-period=5s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "src/server.js"]
