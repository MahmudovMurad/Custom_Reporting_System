@AGENTS.md

# SR Reporting System

İstifadəçi ilə yazışma dili: **Azərbaycan dili**.

Tam layihə xülasəsi (məqsəd, qərarlar, data qaydaları, funksional spesifikasiya, qəbul testləri, mərhələlər, açıq suallar): [docs/SR-Reporting-Handoff.md](docs/SR-Reporting-Handoff.md). Köhnə panelin mənbə faylları (spesifikasiya): [docs/legacy/](docs/legacy/) — `sr_dashboard_template.html` UI/hesablama üçün əsas istinaddır.

## Stack
- Next.js 16 (App Router, `src/`), TypeScript. Next 16-da `middleware.ts` → `src/proxy.ts`. Kod yazmazdan əvvəl `node_modules/next/dist/docs/`-a bax.
- Drizzle ORM. `DATABASE_URL` varsa postgres-js (Neon), yoxdursa lokal PGlite (`.data/pglite`, avtomatik miqrasiya) — [src/db/index.ts](src/db/index.ts).
- Parollar: `@node-rs/argon2` (argon2id). Session: DB-də (`sessions`, token-in sha256-sı), cookie `sr_session` (httpOnly, 14 gün).

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
