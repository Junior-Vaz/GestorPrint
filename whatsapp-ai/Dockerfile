# ────────────────────────────────
# WhatsApp AI Agent
# ────────────────────────────────
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci

# Copia todo o source (tsx compila on-the-fly)
COPY . .

EXPOSE 3005

CMD ["npm", "run", "start"]
