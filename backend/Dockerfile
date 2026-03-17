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

CMD sh -c "node -e \"const{Client}=require('pg');const c=new Client({connectionString:process.env.DATABASE_URL});c.connect().then(()=>c.query(\\\"UPDATE _prisma_migrations SET rolled_back_at=NOW() WHERE finished_at IS NULL AND rolled_back_at IS NULL\\\")).catch(()=>{}).finally(()=>c.end())\" && npx prisma migrate deploy && node dist/main"
