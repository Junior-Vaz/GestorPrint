# ────────────────────────────────
# Stage 1: Build
# ────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# Gera prisma client para termos os tipos durante o build
# Fornecemos uma URL dummy para que o comando não falhe por falta da env
RUN DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres" npx prisma generate

RUN npm run build

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
