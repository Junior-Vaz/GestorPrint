# ────────────────────────────────
# Stage 1: Build
# ────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Gera prisma client para produção
RUN npx prisma generate

# ────────────────────────────────
# Stage 2: Production
# ────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma

# Cria pasta de uploads
RUN mkdir -p /app/uploads

EXPOSE 3000

# Roda migrate e inicia o servidor
CMD sh -c "npx prisma migrate deploy && node dist/main"
