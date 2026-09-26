FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN DATABASE_URL="postgresql://postgres:postgres@db:5432/qadocs?schema=public" \
    DIRECT_URL="postgresql://postgres:postgres@db:5432/qadocs?schema=public" \
    npx prisma generate
RUN DATABASE_URL="postgresql://postgres:postgres@db:5432/qadocs?schema=public" \
    DIRECT_URL="postgresql://postgres:postgres@db:5432/qadocs?schema=public" \
    AUTH_SECRET="docker-build-placeholder-not-for-runtime" \
    npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl postgresql-client && addgroup -S app && adduser -S app -G app

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/next.config.js ./next.config.js
COPY --from=build /app/.next ./.next
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/public ./public
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh
RUN mkdir -p /app/public/uploads
# node_modules и прочее от COPY принадлежат root — без chown `app` не может писать в .prisma (migrate dev / prisma generate в exec)
RUN chown -R app:app /app

USER app
EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
