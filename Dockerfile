FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY api ./api
COPY site ./site

RUN addgroup -S chefsapiens && adduser -S chefsapiens -G chefsapiens \
    && chown -R chefsapiens:chefsapiens /app

USER chefsapiens
EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:8080/readyz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "api/server.mjs"]
