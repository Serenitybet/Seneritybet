# Se construit depuis la racine du monorepo : docker build -f apps/backoffice/Dockerfile .
FROM node:20-alpine AS base
RUN npm install -g pnpm@9.15.4
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backoffice/package.json ./apps/backoffice/
RUN pnpm install --no-frozen-lockfile

FROM deps AS builder
COPY packages/shared ./packages/shared/
COPY apps/backoffice ./apps/backoffice/
ARG NEXT_PUBLIC_BACKOFFICE_API_URL
ENV NEXT_PUBLIC_BACKOFFICE_API_URL=${NEXT_PUBLIC_BACKOFFICE_API_URL}
RUN pnpm --filter @serenitybet/backoffice build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/backoffice/.next/standalone ./
COPY --from=builder /app/apps/backoffice/.next/static ./apps/backoffice/.next/static
COPY --from=builder /app/apps/backoffice/public ./apps/backoffice/public
EXPOSE 3001
CMD ["node", "apps/backoffice/server.js"]
