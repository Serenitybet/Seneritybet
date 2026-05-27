FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.15.4

# Copy workspace manifest files (layer cache: only reinstall if these change)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./

# Copy all package.json files so pnpm can resolve the workspace graph
COPY packages/api/package.json ./packages/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
COPY apps/backoffice/package.json ./apps/backoffice/

# Install ALL deps (including devDeps — needed for tsx, prisma CLI, etc.)
# Do NOT set NODE_ENV=production here or pnpm will skip devDependencies
RUN pnpm install --frozen-lockfile

# Copy all source files
COPY packages/ ./packages/
COPY apps/ ./apps/

# Generate Prisma client for the target platform (Linux)
RUN pnpm --filter @serenitybet/db db:generate

EXPOSE 4000

# Start the API (tsx is available because devDeps were installed above)
CMD ["pnpm", "--filter", "@serenitybet/api", "start:prod"]
