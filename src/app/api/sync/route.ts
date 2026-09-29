import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/db";
import { runSync } from "@/lib/sync";

// Avtomatik sync: GitHub Actions (POST) və ya Vercel Cron (GET) — hər ikisi "Authorization: Bearer <CRON_SECRET>" göndərir.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") || "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

async function handle(req: Request) {
  if (!authorized(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const result = await runSync(await getDb(), { trigger: "cron" });
  return Response.json(result, { status: result.status === "error" ? 500 : 200 });
}

export const GET = handle;
export const POST = handle;
