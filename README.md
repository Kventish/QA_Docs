# QA Docs

QA Docs — внутренний web-инструмент для управления QA-документацией и выполнения тестовых прогонов. В нём можно хранить Test Cases и Checklists, собирать Test Plans, фиксировать результаты выполнения и возвращаться к истории Run.

## Возможности

- Projects с разграничением доступа для viewer.
- Test Cases с предусловиями, шагами, ожидаемыми и фактическими результатами.
- Checklists и Test Plans из Test Cases и Checklists.
- Run для Test Case, Checklist и Test Plan: Start, Resume, Complete и Cancel.
- Последовательная работа с элементами Test Plan и действие Complete & Next.
- Результаты executable-шагов, Severity, комментарии и приватные вложения.
- Таймер и длительность Run, автоматический итог и manual override с причиной и audit history.
- Immutable definition snapshot на момент Start. До numbered versioning он отображается как **Snapshot at start**.
- Run History с датой, исполнителем, результатом и длительностью; старые TestCaseRun отображаются как Legacy.
- Русский и английский интерфейс.
- Индикаторы autosave, async-действий и переходов между страницами.

## Основной сценарий работы

1. Откройте существующий Project или создайте новый.
2. Создайте Test Case либо Checklist.
3. Добавьте документы в Test Plan, если нужен общий прогон.
4. Нажмите Start, чтобы создать Run и зафиксировать snapshot документа.
5. Выполняйте шаги и указывайте их результаты.
6. Для Failed обязательно выберите Severity.
7. При необходимости заполните Actual Result, добавьте комментарий или attachment.
8. Завершите Run либо отмените его с указанием причины.
9. Откройте Run History для просмотра результата.
10. В Test Plan используйте Complete & Next, чтобы перейти к следующему доступному item.

## Результаты шагов

| Статус | Значение |
| --- | --- |
| Passed / Пройден | Шаг выполнен с ожидаемым результатом. |
| Failed / Не пройден | Шаг завершился ошибкой. Severity обязательна. |
| Questionable / Под вопросом | Результат требует дополнительной проверки. Severity необязательна. |
| Blocked / Заблокирован | Шаг невозможно выполнить из-за блокирующего условия. Это обработанный результат, а не незавершённый шаг. |

Blocked подходит, например, когда упал предыдущий обязательный шаг, нужное состояние недоступно или функциональность заблокирована. После Failed действие **Заблокировать оставшиеся шаги** отмечает как Blocked только последующие незаполненные executable-шаги и не перезаписывает сохранённые результаты.

### Severity

Доступные значения: `low`, `medium`, `high`, `critical`.

- Passed и Blocked всегда сохраняются без Severity.
- Failed требует Severity.
- Для Questionable Severity необязательна.

### Автоматический результат Run

Приоритет автоматического итога:

1. Есть Failed → Run Failed.
2. Иначе есть Questionable или Blocked → Run Questionable.
3. Иначе все executable leaf steps Passed → Run Passed.
4. Иначе Run остаётся незавершённым.

При manual override сохраняются автоматический итог, выбранный итог, причина, пользователь и время изменения. После завершения корректировать итог может admin.

## Test Plans

Test Plan содержит упорядоченный набор Test Cases и Checklists. Для каждого item создаётся отдельный child Run. Незавершённый child Run можно открыть через Resume; после Complete доступен переход Complete & Next или возврат к родительскому Test Plan.

В родительском Run отображаются общий progress, количество Passed, Failed, Questionable, Cancelled и оставшихся items. Полноценный business reporting относится к Roadmap.

## Run History

История показывает сохранённые Run с датой, исполнителем, итогом, lifecycle и длительностью. Каждый новый Run использует definition snapshot, созданный при Start, поэтому последующее редактирование документа не меняет уже начатый прогон.

Существующие legacy TestCaseRun остаются доступными в отдельном блоке Legacy. Для них не создаются недостоверные executor, duration или version.

## Комментарии и вложения

Комментарии и attachments можно добавлять к результату конкретного шага; поддерживаются также вложения уровня Run. Файлы хранятся в Private Vercel Blob и скачиваются через endpoint с проверкой доступа к Project.

Ограничение одного файла — **3 MiB**. Поддерживаются:

- PNG, JPEG, WebP;
- PDF;
- UTF-8 TXT и LOG.

## Роли

| Роль | Текущие права |
| --- | --- |
| `admin` | Управление пользователями, доступ ко всем Projects и Run, удаление Projects, post-completion override. |
| `editor` | Создание и изменение QA-документов, запуск и выполнение собственных Run. |
| `viewer` | Просмотр назначенных Projects, документов и доступных Run без выполнения mutations. |

Проверки выполняются на сервере; ограничения интерфейса не являются единственной защитой.

## Языки

Интерфейс поддерживает RU и EN. Выбранный язык сохраняется в cookie.

## Для разработчиков

### Технологии

- Next.js 13 App Router, React 18, TypeScript;
- Prisma 5 и PostgreSQL/Neon;
- Vercel, Private Vercel Blob;
- Tailwind CSS;
- Vercel Web Analytics и Speed Insights.

### Локальный запуск

Рекомендуется Node.js 20.

```powershell
Copy-Item .env.example .env.dev.local
# Заполните .env.dev.local локальными dev/test значениями.
.\scripts\sync-env.ps1
npm install
npx prisma generate
npm run dev
```

Перед первым запуском на новой локальной БД примените подготовленные migrations и выполните seed только после проверки target database:

```powershell
npx prisma migrate status
npx prisma migrate deploy
npm run db:seed
```

Приложение доступно по адресу `http://localhost:3000`.

### Environment variables

| Variable | Назначение |
| --- | --- |
| `DATABASE_URL` | Runtime PostgreSQL connection. |
| `DIRECT_URL` | Direct PostgreSQL connection для Prisma CLI и migrations. |
| `AUTH_SECRET` | Подпись session JWT. |
| `BLOB_READ_WRITE_TOKEN` | Server-side доступ к Private Vercel Blob. Не передаётся клиенту. |
| `ADMIN_EMAIL` | Email admin, создаваемого командой seed. |
| `ADMIN_PASSWORD` | Пароль seed-admin. |

Локальные `.env*` содержат secrets и не должны попадать в Git. В репозитории хранится только `.env.example` без рабочих credentials.

### Выбор локального environment

Скрипт [scripts/sync-env.ps1](scripts/sync-env.ps1) выбирает набор переменных по текущей Git-ветке и копирует его в `.env` и `.env.local`:

- `dev` и feature/fix branches → `.env.dev.local`;
- `main` → `.env.prod.local`.

```powershell
.\scripts\sync-env.ps1
```

Перед любой Prisma migration обязательно проверьте активную ветку, `DATABASE_URL`, `DIRECT_URL` и target host. Запуск скрипта на `main` выбирает production environment.

### Dev и Production

| Контекст | Git | Vercel | Database | Blob |
| --- | --- | --- | --- | --- |
| Production | `main` | Production deployment | Production Neon | Production Blob store |
| Development | `dev` | Preview deployment | Neon `phase-a-test` | Отдельный dev Blob store |
| Feature/fix | отдельная ветка | Preview при настройке Vercel | Dev/test environment | Dev Blob store |

Preview deployment может быть защищён Vercel Deployment Protection. Analytics и Speed Insights используются для технического мониторинга deployments.

### Prisma migrations

Безопасные команды проверки:

```powershell
npx prisma validate
npx prisma generate
npx prisma migrate status
```

Применение уже созданных migrations на подтверждённом dev/test environment:

```powershell
npx prisma migrate deploy
```

Перед `migrate deploy` сверяйте оба database URL и host в выводе Prisma. Production migration не является обычным локальным workflow и выполняется отдельно по согласованной процедуре.

### Docker Compose

Compose запускает приложение и локальный PostgreSQL. Для обоих Prisma URL используется сервис `db` внутри compose network.

```powershell
.\scripts\sync-env.ps1
docker compose up -d --build
docker compose exec app npm run db:seed
```

Container entrypoint ожидает PostgreSQL и применяет уже созданные migrations перед запуском приложения.

### Проверки

В проекте доступны следующие scripts:

```powershell
npm run lint
npm run build
```

Отдельных `test` и `typecheck` scripts сейчас нет. TypeScript проверяется во время `npm run build`.

## Roadmap — planned, ещё не реализовано

- numbered document versioning;
- Drag & Drop;
- authoring substeps;
- folders;
- duplicate documents;
- managed tags;
- расширенные filters;
- search by raw document ID;
- business reporting improvements.
