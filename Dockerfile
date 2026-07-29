FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @jawad/web build

FROM node:22-alpine AS runtime
RUN apk add --no-cache postgresql-client
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /app/runtime/uploads && chown -R node:node /app/runtime
USER node
EXPOSE 3000 3101 3200
CMD ["node","apps/web/node_modules/next/dist/bin/next","start","apps/web","--port","3000"]
