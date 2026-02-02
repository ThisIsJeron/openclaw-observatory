# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY web/package*.json ./web/

# Install dependencies
RUN npm ci
RUN cd web && npm ci

# Copy source
COPY . .

# Build
RUN npm run build

# Production stage
FROM node:20-slim AS runner

WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/web/dist ./web/dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/src/db/schema.sql ./src/db/schema.sql

# Install production dependencies only
RUN npm ci --omit=dev

# Create non-root user
RUN addgroup --system --gid 1001 observatory && \
    adduser --system --uid 1001 --gid 1001 observatory

USER observatory

EXPOSE 3200

ENV NODE_ENV=production
ENV PORT=3200
ENV HOST=0.0.0.0

CMD ["node", "dist/index.js"]
