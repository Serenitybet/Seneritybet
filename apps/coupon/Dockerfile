# Se construit depuis la racine du monorepo : docker build -f apps/coupon/Dockerfile .
FROM node:20-alpine AS base
RUN npm install -g pnpm@9.15.4
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/coupon/package.json ./apps/coupon/
RUN pnpm install --no-frozen-lockfile

FROM deps AS builder
COPY packages/shared ./packages/shared/
COPY apps/coupon ./apps/coupon/
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN pnpm --filter @serenitybet/coupon build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/coupon/.next/standalone ./
COPY --from=builder /app/apps/coupon/.next/static ./apps/coupon/.next/static
COPY --from=builder /app/apps/coupon/public ./apps/coupon/public
EXPOSE 3003
CMD ["node", "apps/coupon/server.js"]
