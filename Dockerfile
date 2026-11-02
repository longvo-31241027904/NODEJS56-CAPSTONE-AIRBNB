FROM node:24.14.0-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig*.json nest-cli.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src
RUN npm run prisma:generate && npm run build

# Explicit migration target retains the Prisma CLI and its dependencies.
FROM build AS migrate
USER node
CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]

FROM build AS production-dependencies
RUN npm prune --omit=dev

FROM node:24.14.0-bookworm-slim AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json
RUN mkdir -p /app/uploads/avatars && chown -R node:node /app/uploads
USER node
EXPOSE 3069
CMD ["node", "dist/main.js"]
