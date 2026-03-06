FROM node:18-slim

# isolated-vm needs build tools for native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production

COPY src/ ./src/

ENV NODE_ENV=prod
ENV PORT=7000

EXPOSE 7000

CMD ["node", "src/index.js"]
