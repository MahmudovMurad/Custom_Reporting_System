@AGENTS.md

# SR Reporting System

İstifadəçi ilə yazışma dili: **Azərbaycan dili**.

Tam layihə xülasəsi (məqsəd, qərarlar, data qaydaları, funksional spesifikasiya, qəbul testləri, mərhələlər, açıq suallar): [docs/SR-Reporting-Handoff.md](docs/SR-Reporting-Handoff.md). Köhnə panelin mənbə faylları (spesifikasiya): [docs/legacy/](docs/legacy/) — `sr_dashboard_template.html` UI/hesablama üçün əsas istinaddır.

## Stack
- Next.js 16 (App Router, `src/`), TypeScript. Next 16-da `middleware.ts` → `src/proxy.ts`. Kod yazmazdan əvvəl `node_modules/next/dist/docs/`-a bax.
- Drizzle ORM. `DATABASE_URL` varsa postgres-js (Neon), yoxdursa lokal PGlite (`.data/pglite`, avtomatik miqrasiya) — [src/db/index.ts](src/db/index.ts).
- Parollar: `@node-rs/argon2` (argon2id). Session: DB-də (`sessions`, token-in sha256-sı), cookie `sr_session` (httpOnly, 14 gün).

## Data körpüsü (2-ci mərhələ)
- Şirkətin Google təşkilatında servis hesabı açarı yaratmaq qadağandır (`iam.disableServiceAccountKeyCreation`) — server Sheet-i özü oxumur.
- Sheet-in öz Apps Script-i ([apps-script/Code.gs](apps-script/Code.gs)) hər 15 dəq Main Data + Real Stock-u `getDisplayValues()` ilə oxuyur → `/api/ingest`-ə göndərir (`Authorization: Bearer SYNC_SECRET`). Əvvəl kiçik `check` (hash) sorğusu; dəyişiklik varsa data 60k sətirlik gzip hissələrlə (Vercel 4.5 MB limiti).
- Paneldə admin "Yenilə" → server action Apps Script web app-ını (`APPS_SCRIPT_URL`) çağırır.
- ETL: [src/lib/etl/](src/lib/etl/) (template + build.py qaydaları), sync: [src/lib/sync.ts](src/lib/sync.ts). Lokal sync CSV-dən: `npm run sync -- --main X.csv --stock Y.csv` (defolt `.data/import/`), sonra `npm run verify` (handoff §6).
- Lokal gizli fayllar `.secrets/`-dədir (gitignore): `sync-secret.txt` = Vercel-dəki `SYNC_SECRET`.

## Əmrlər
- `npm run dev` — lokal server (PGlite ilə DB quraşdırmadan işləyir)
- `npm run db:generate` — `src/db/schema.ts` dəyişəndə miqrasiya SQL-i yarat (`drizzle/`)
- `npm run db:migrate` — miqrasiyaları `DATABASE_URL`-dəki DB-yə tətbiq et
- `npm run user:create -- --email a@b.az --name "Ad" --role admin [--password X]` — istifadəçi yarat (şifrə verilməsə yaradılıb ekrana çıxarılır). PGlite rejimində dev server dayandırılmalıdır (PGlite tək prosesli işləyir).
- `npm run lint`, `npx tsc --noEmit`, `npm run build`

## Qaydalar
- Auth yoxlaması həmişə [src/lib/dal.ts](src/lib/dal.ts)-də (`requireUser` / `requireAdmin`) — proxy yalnız cookie-nin varlığına baxır. Hər server action/route handler özü yoxlayır.
- UI mətnləri Azərbaycan dilində; başlıqlar literal böyük hərflə (CSS `uppercase` yox — türk "İ" problemi).
- Dizayn tokenləri köhnə template-in `:root` blokundan götürülüb ([src/app/globals.css](src/app/globals.css)).
