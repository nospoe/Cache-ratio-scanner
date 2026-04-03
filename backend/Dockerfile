FROM node:22-bookworm-slim

# Install system deps for Playwright Chromium
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

WORKDIR /app

# Install all deps (including devDeps for tsc)
COPY package.json package-lock.json* ./
RUN npm install

# Install Playwright and Chromium browser
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install chromium

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Copy SQL migrations (tsc doesn't copy non-TS files)
RUN cp -r src/db/migrations dist/db/migrations

# Prune dev deps after build
RUN npm prune --omit=dev

# Health check
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD curl -sf http://localhost:3001/health || exit 1

EXPOSE 3001
CMD ["node", "dist/api/server.js"]
