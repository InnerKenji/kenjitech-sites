import { NextRequest, NextResponse } from "next/server";
import { authSite } from "@/lib/syncauth";
import { sql } from "@/lib/db";
import { q } from "@/lib/mirror";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Le poste se présente : réponse = activé ou non, heure du serveur, tables déjà connues. */
export async function POST(req: NextRequest) {
  const ctx = await authSite(req);
  if (ctx instanceof NextResponse) return ctx;
  const body = JSON.parse(ctx.body.toString("utf8") || "{}");
  if (typeof body.file_attente === "number" || body.version) {
    await sql()`update plateforme.sites set
      file_attente = ${typeof body.file_attente === "number" ? body.file_attente : null},
      version_logiciel = coalesce(${body.version ?? null}, version_logiciel)
      where id = ${ctx.siteId}`;
  }
  const tables = await sql().unsafe(`select nom from ${q(ctx.schema)}._tables order by nom`);
  return NextResponse.json({
    ok: true,
    active: true,
    heure_serveur: Math.floor(Date.now() / 1000),
    exploitant: ctx.code,
    tables: tables.map((t) => t.nom),
  });
}
