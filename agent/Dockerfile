FROM node:22-alpine AS builder

WORKDIR /app

# Copy workspace root
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy agent and shared packages
COPY agent/package.json agent/
COPY shared/package.json shared/

# Install pnpm and dependencies
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile

# Copy source
COPY shared/ shared/
COPY agent/ agent/

# Build shared first, then agent
RUN pnpm --filter=@chariot/shared build
RUN pnpm --filter=@chariot/agent build

# Production stage
FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/agent/dist ./agent/dist
COPY --from=builder /app/agent/node_modules ./agent/node_modules
COPY --from=builder /app/agent/package.json ./agent/
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/package.json ./shared/

WORKDIR /app/agent

# Health check -- verify heartbeat file was updated within 120s
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "const fs=require('fs');const t=Number(fs.readFileSync('/tmp/chariot-heartbeat','utf8'));process.exit(Date.now()-t>120000?1:0)"

CMD ["node", "dist/index.js"]
