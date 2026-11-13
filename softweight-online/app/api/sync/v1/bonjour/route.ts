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
  // Signe de vie du poste (toutes les 15 min) : réponse minimale, la liste des tables seulement si demandée.
  // compression "zlib-signe" : corps zlib, en-tête X-SW-Zip: 1, signature calculée sur les octets compressés envoyés.
  const rep: Record<string, unknown> = { ok: true, active: true, heure_serveur: Math.floor(Date.now() / 1000), compression: "zlib-signe" };
  if (!body.battement) {
    const tables = await sql().unsafe(`select nom from ${q(ctx.schema)}._tables order by nom`);
    rep.exploitant = ctx.code;
    rep.tables = tables.map((t) => t.nom);
  }
  return NextResponse.json(rep);
}
