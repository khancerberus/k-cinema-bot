FROM node:22-alpine

WORKDIR /app

RUN npm install -g pnpm@11.5.1

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY . .

CMD ["node", "index.js"]
