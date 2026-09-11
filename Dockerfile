FROM node:22-alpine
WORKDIR /app
COPY --chown=node:node package.json server.mjs host-core.mjs room-store.mjs ./
COPY --chown=node:node dist ./dist
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]
