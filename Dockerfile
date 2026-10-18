# MyTask: un solo container con il server (Node, SQLite) e l'app web già compilata.

# Fase 1: compila l'app web (Vite) con tutte le dipendenze.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci
COPY shared shared
COPY web web
RUN npm -w web run build

# Fase 2: immagine finale, solo con il server (dipendenze di produzione), `shared` e l'app già compilata.
# Node 24 esegue direttamente i file TypeScript del server, quindi non c'è un passaggio di compilazione.
FROM node:24-slim
ENV NODE_ENV=production \
    DATA_DIR=/data \
    PORT=8787 \
    WEB_DIR=/app/web/dist
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --omit=dev -w server
COPY shared shared
COPY server server
COPY --from=build /app/web/dist web/dist
RUN mkdir -p /data && chown -R node:node /data
# Il container non gira come root; il database sta nel volume /data.
USER node
VOLUME /data
EXPOSE 8787
# Controllo di salute: chiede /api/health al server stesso.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/src/index.ts"]
