# QA Docs (TestOps-style)

Self-hosted портал для QA‑документации: **тест‑кейсы**, **чек‑листы**, **тест‑планы**. UI сделан в стиле “панель + таблицы”, близко к Allure TestOps.

## Требования

- Node.js (локально): желательно 18+ (у вас сейчас 16 — для локального запуска лучше обновить Node до 18/20)
- Docker Desktop (для PostgreSQL и запуска через compose)

## Переменные окружения

Скопируйте `.env.example` → `.env` и задайте:

- `AUTH_SECRET`: длинная случайная строка
- `ADMIN_EMAIL` / `ADMIN_PASSWORD`: будет создан admin при сидировании

## Запуск через Docker (рекомендуется)

1) Убедитесь, что **Docker daemon запущен** (Docker Desktop открыт).

2) Поднимите сервисы:

```bash
docker compose up -d --build
```

3) Миграции применяются **автоматически** при старте контейнера (`prisma migrate deploy` в `docker-entrypoint.sh`). Дождитесь строки `Ready` в логах: `docker compose logs -f app`.

4) Создайте admin + default project (один раз):

```bash
docker compose exec app npm run db:seed
```

Если нужно вручную применить миграции без перезапуска:

```bash
docker compose exec app npx prisma migrate deploy
```

Для **новой** миграции в контейнере используйте `migrate dev` (после пересборки образа права на `/app` позволяют `prisma generate` без ошибки `EACCES`).

5) Откройте приложение:

- `http://localhost:3000`

Логин по умолчанию (если не меняли): `admin@example.com` / `admin12345`.

## Локальный запуск (без Docker app)

1) Поднимите Postgres через Docker:

```bash
docker compose up -d db
```

2) Установите зависимости и запустите:

```bash
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

## Что уже есть в MVP

- Авторизация (JWT cookie) и роли: `admin / editor / viewer`
- Страницы:
  - `/test-cases` + создание и просмотр
  - `/checklists` + создание и просмотр
  - `/test-plans` + создание (с выбором test cases) и просмотр
  - `/users` (admin) + создание пользователей
- Поиск/фильтры (MVP) для test cases: `q` + `status`

