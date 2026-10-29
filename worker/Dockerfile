FROM node:22-bookworm-slim

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium ca-certificates fonts-liberation \
    && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install --omit=dev
COPY . ./

ENV NODE_ENV=production PORT=3000 DATA_FILE=/data/schedules.json CHROMIUM_PATH=/usr/bin/chromium
VOLUME ["/data"]
EXPOSE 3000
CMD ["node", "server.mjs"]
