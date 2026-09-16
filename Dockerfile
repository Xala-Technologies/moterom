FROM node:24-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-slim AS runtime
ENV NODE_ENV=production PORT=4173
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY --from=build /app/config ./config
COPY --from=build /app/assets ./assets
RUN mkdir .data && chown node:node .data
USER node
EXPOSE 4173
CMD ["node", "--import", "tsx", "server/index.ts"]
