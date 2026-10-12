# Imagem de publicação do frontend (spec 0007). A mesma imagem serve qualquer ambiente:
# nada de ARG/ENV de ambiente; o config.js de runtime vem montado do ConfigMap.

# --- build ---------------------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Inclui scripts/ e sources.json: o `prebuild` (quando existir) baixa o contrato fixado da API
# e gera os tipos, por isso este estágio precisa de rede. Sem `prebuild`, nada muda.
COPY . .
RUN npm run build
# O manifest do Vite (dist/.vite) não é público; só index.html e assets/ são servidos.
RUN rm -rf dist/.vite

# --- runtime -------------------------------------------------------------------------------
FROM nginxinc/nginx-unprivileged:1.30.5-alpine

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html

# UID 101 (nginx), porta 8080; pid e temporários do nginx ficam em /tmp (rootfs somente leitura).
USER 101
EXPOSE 8080
