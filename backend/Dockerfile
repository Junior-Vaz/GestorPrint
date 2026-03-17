# ────────────────────────────────
# Stage 1: Build
# ────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
# Instalamos dependências do sistema necessárias para o Prisma no Alpine
RUN apk add --no-cache openssl libc6-compat
RUN npm ci

COPY . .

# Gera prisma client para termos os tipos durante o build
RUN npx prisma generate

RUN npm run build

# ────────────────────────────────
# Stage 2: Production
# ────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat wget

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma

RUN mkdir -p /app/uploads

EXPOSE 3000

CMD sh -c "npx prisma migrate deploy && node dist/main"
