FROM node:22-bookworm-slim

# Install system deps for Playwright Chromium (must run as root)
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Create target dirs owned by the node user (uid 1000) before switching user.
# This avoids an expensive chown -R over the full Chromium installation later.
RUN mkdir -p /app /ms-playwright && chown node:node /app /ms-playwright

# Switch to non-root for all subsequent steps
USER node
WORKDIR /app

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Install dependencies
COPY --chown=node:node package.json package-lock.json* ./
RUN npm install

# Install Playwright Chromium — runs as node so files are node-owned from creation
RUN npx playwright install chromium

# Build
COPY --chown=node:node tsconfig.json ./
COPY --chown=node:node src ./src
RUN npm run build

# Copy SQL migrations (tsc doesn't copy non-TS files)
RUN cp -r src/db/migrations dist/db/migrations

# Prune dev deps after build
RUN npm prune --omit=dev

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD curl -sf http://localhost:3001/health || exit 1

EXPOSE 3001
CMD ["node", "dist/api/server.js"]
