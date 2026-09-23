FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm install --no-audit --no-fund

# Copy the rest of the app
COPY . .

# Port is injected by the host via env PORT (Koyeb/Render/Railway).
ENV NODE_ENV=production

CMD ["node", "server.js"]