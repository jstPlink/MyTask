# MyTask: un solo container con il server (Node, SQLite) e l'app web già compilata.

FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci
COPY shared shared
COPY web web
RUN npm -w web run build

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
USER node
VOLUME /data
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/src/index.ts"]
