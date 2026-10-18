# Se construit depuis la racine du monorepo : docker build -f apps/pos/Dockerfile .
FROM node:20-alpine AS base
RUN npm install -g pnpm@9.15.4
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/pos/package.json ./apps/pos/
RUN pnpm install --no-frozen-lockfile

FROM deps AS builder
COPY packages/shared ./packages/shared/
COPY apps/pos ./apps/pos/
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN pnpm --filter @serenitybet/pos build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/pos/.next/standalone ./
COPY --from=builder /app/apps/pos/.next/static ./apps/pos/.next/static
COPY --from=builder /app/apps/pos/public ./apps/pos/public
EXPOSE 3002
CMD ["node", "apps/pos/server.js"]
