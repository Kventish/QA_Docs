#!/bin/sh
set -e

echo "Waiting for database..."
until pg_isready -h db -p 5432 -U postgres >/dev/null 2>&1; do
  sleep 1
done

echo "Database is ready; deploying Prisma migrations..."
npx prisma migrate deploy

exec npm run start
