# ─── Stage 1: Build ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# openssl + libc6-compat: requisitos do Prisma engine no Alpine
RUN apk add --no-cache openssl libc6-compat

COPY package*.json ./
RUN npm ci

COPY . .

# Gera o Prisma Client antes do build TS pra ter os tipos disponíveis
RUN npx prisma generate
RUN npm run build

# ─── Stage 2: Production ───────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# wget é usado pelo healthcheck do EasyPanel (HTTP probe contra /api/health)
RUN apk add --no-cache openssl libc6-compat wget

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma

# Volume montado pelo EasyPanel pra arquivos de upload (logos, anexos de pedido).
# Sem esse mkdir, o primeiro upload falha porque o backend tenta escrever num path
# que não existe em containers efêmeros.
RUN mkdir -p /app/uploads

EXPOSE 3000

# Aplica migrations pendentes ANTES de subir a app. Se uma migration falhar, o
# container sobe e morre — fail-fast intencional pra não rodar contra schema errado.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
