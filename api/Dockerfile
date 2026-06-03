FROM node:22-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@11.5.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# ---

FROM node:22-alpine AS production

WORKDIR /app

RUN npm install -g pnpm@11.5.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist

CMD ["node", "dist/main"]
