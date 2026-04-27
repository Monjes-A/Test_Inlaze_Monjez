FROM node:20-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm@10.18.3
ARG DATABASE_URL=postgresql://app:app@postgres:5432/app?schema=public
ENV DATABASE_URL=${DATABASE_URL}
COPY package.json pnpm-lock.yaml ./
COPY prisma.config.ts ./
COPY prisma ./prisma/
RUN pnpm install --frozen-lockfile

FROM node:20-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@10.18.3
ARG DATABASE_URL=postgresql://app:app@postgres:5432/app?schema=public
ENV DATABASE_URL=${DATABASE_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml ./
COPY prisma.config.ts ./
COPY prisma ./prisma/
COPY tsconfig.json ./
COPY src ./src/
RUN pnpm prisma generate && pnpm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g pnpm@10.18.3
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY package.json pnpm-lock.yaml ./
EXPOSE 3000
CMD ["sh", "-c", "pnpm prisma db push && node dist/server.js"]
