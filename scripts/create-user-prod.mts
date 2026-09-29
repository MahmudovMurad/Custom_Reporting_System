// Production (Vercel/Neon) bazasında istifadəçi yaradır:
//   npm run user:create:prod -- --email a@b.az --name "Ad Soyad" --role admin
// DATABASE_URL Vercel-dən müvəqqəti fayla çəkilir, yalnız bu prosesdə istifadə olunur və dərhal silinir.
// Tələb: `npx vercel login` və `npx vercel link` edilmiş olmalıdır.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";

const dir = mkdtempSync(join(tmpdir(), "sr-env-"));
const file = join(dir, "prod.env");
try {
  const r = spawnSync("npx", ["vercel", "env", "pull", file, "--environment=production", "--yes"], { stdio: ["ignore", "ignore", "inherit"], shell: true });
  if (r.status !== 0) throw new Error("vercel env pull alınmadı (vercel login / vercel link edilibmi?)");
  const env = parseEnv(readFileSync(file, "utf8"));
  const url = env.DATABASE_URL || env.neon_DATABASE_URL;
  if (!url) throw new Error("Production mühitində DATABASE_URL tapılmadı");
  process.env.DATABASE_URL = url;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
await import("./create-user.mts");
