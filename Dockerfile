# Umbra OS — cloud (always-on) runtime.
#
# Runs the headless core: API server, agent loop, MCP connectors, persistent
# memory, model routing/billing. Desktop control (mouse/keyboard/OCR) still
# requires the Windows machine — see docs/cloud-deploy.md.

FROM node:20-bookworm-slim

WORKDIR /app

# better-sqlite3 ships prebuilt Linux x64 binaries; install deps first to cache.
COPY package*.json ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json jest.config.js ./
COPY src ./src
RUN npm run build

ENV NODE_ENV=production
ENV UMBRA_HEADLESS=1
ENV UMBRA_ROLE=cloud
# Unattended cloud node: tasks already consent-approved on the PC resume
# without re-prompting; new cloud tasks run without an interactive prompt.
ENV UMBRA_CONSENT_AUTOGRANT=1

EXPOSE 8787 8788

CMD ["node", "dist/index.js"]
