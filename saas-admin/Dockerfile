# ─── Stage 1: Build (Vite + Vue 3) ─────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Vite injeta VITE_API_URL no bundle em build-time (import.meta.env). Em prod
# o EasyPanel passa via build arg.
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ─── Stage 2: Servir com Nginx ─────────────────────────────────────────────
FROM nginx:alpine AS production

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
