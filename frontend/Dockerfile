# ─── Verifair Frontend ───
FROM node:20-alpine

WORKDIR /app

# Install dependencies first (cached layer)
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source code
COPY . .

# Next.js collects anonymous telemetry — disable it
ENV NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

# Bind to 0.0.0.0 so it's reachable from outside the container
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]
