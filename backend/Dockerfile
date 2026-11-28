FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PORT=3000 \
    EVIDENCE_DIR=/data/evidence \
    TESSERACT_PATH=/usr/bin/tesseract

RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY prisma ./prisma
RUN ./node_modules/.bin/prisma generate
COPY src ./src
RUN mkdir -p /data/evidence \
    && chown -R node:node /app /data/evidence

USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
