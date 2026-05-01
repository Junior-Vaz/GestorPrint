# ─── Stage 1: Build (Vite + Vue 3) ─────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Vite injeta VITE_API_URL no bundle em build-time (import.meta.env). Default
# aponta pra localhost só pra não quebrar dev — em prod o EasyPanel passa via
# build arg ou .env.
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm ci

COPY . .
# build-only pula o type-check (já roda no CI). Mais rápido em prod.
RUN npm run build-only

# ─── Stage 2: Servir com Nginx ─────────────────────────────────────────────
FROM nginx:alpine AS production

# nginx.conf custom roteia SPA (todas rotas → index.html) + proxy /api → backend
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
