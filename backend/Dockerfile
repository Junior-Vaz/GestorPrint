# ────────────────────────────────
# Stage 1: Build
# ────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
# Instalamos dependências do sistema necessárias para o Prisma no Alpine
RUN apk add --no-cache openssl libc6-compat
ENV CACHE_BUST=1
RUN npm ci

COPY . .


# Gera prisma client para termos os tipos durante o build
RUN npx prisma generate

RUN npm run build || (echo "Build failed" && exit 1)
RUN ls -la || true
RUN ls -la dist || (echo "Dist folder not generated!" && exit 1)

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

CMD sh -c " \
  npx prisma migrate resolve --rolled-back 20260318180614_add_saleperson_fields 2>/dev/null || true && \
  npx prisma migrate resolve --rolled-back 20260319000000_fix_salesperson_columns 2>/dev/null || true && \
  npx prisma migrate resolve --rolled-back 20260319010000_fix_customer_address_fields 2>/dev/null || true && \
  npx prisma migrate deploy && node dist/main"
