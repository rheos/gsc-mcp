# gsc-mcp on Coolify (Dockerfile build pack). Replaced Nixpacks on 2026-10-18: Coolify's
# Nixpacks 1.41.0 builds from a January 2025 nixpkgs snapshot with no Node 24. Keep the
# major here in step with .nvmrc.
#
# Coolify supplies PORT, HOST, GSC_MCP_API_KEY and GSC_TOKEN, and bind-mounts the token
# file at /run/secrets/gsc-token.json.
FROM node:24-bookworm-slim

# curl: Coolify's health check runs inside the container (GET /health).
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY . .

ENV NODE_ENV=production
EXPOSE 3120
CMD ["node", "server-http.mjs"]
