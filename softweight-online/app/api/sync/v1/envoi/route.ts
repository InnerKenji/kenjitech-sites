import { NextRequest, NextResponse } from "next/server";
import { authSite, err } from "@/lib/syncauth";
import { sql } from "@/lib/db";
import { applyChanges, Change } from "@/lib/mirror";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GEN = 1_000_000_000_000; // n° effectif = génération de la file x 10^12 + n° local

/**
 * Lot de modifications du poste. Tout le lot est appliqué dans UNE transaction :
 * soit tout est enregistré et acquitté, soit rien (le poste renverra le lot).
 */
export async function POST(req: NextRequest) {
  const ctx = await authSite(req);
  if (ctx instanceof NextResponse) return ctx;
  let body: { gen?: number; changes?: Change[]; file_attente?: number };
  try {
    body = JSON.parse(ctx.body.toString("utf8"));
  } catch {
    return err(400, "json_invalide");
  }
  const gen = Number.isInteger(body.gen) && body.gen! >= 0 && body.gen! < 9000 ? body.gen! : 0;
  const changes = Array.isArray(body.changes) ? body.changes : [];
  if (changes.length > 2000) return err(413, "lot_trop_gros");
  for (const c of changes) {
    if (!Number.isInteger(c.seq) || c.seq <= 0 || c.seq >= GEN || typeof c.table !== "string" || !c.pk || (c.op !== "upsert" && c.op !== "delete"))
      return err(400, "modification_invalide", { seq: c?.seq });
  }
  const mapped = changes.map((c) => ({ ...c, seq: gen * GEN + c.seq, orig: c.seq }));
  let res: { ok: number[]; unknownTables: string[] };
  try {
    res = await sql().begin(async (t) => {
      await t`select pg_advisory_xact_lock(hashtext(${ctx.siteId}))`;
      return applyChanges(t, ctx.schema, ctx.siteId, mapped);
    });
  } catch (e) {
    console.error("envoi", ctx.siteId, e);
    return err(500, "erreur_enregistrement");
  }
  const okSet = new Set(res.ok);
  const acquittes = mapped.filter((c) => okSet.has(c.seq)).map((c) => c.orig);
  await sql()`update plateforme.sites set derniere_synchro = now(),
      file_attente = ${typeof body.file_attente === "number" ? Math.max(0, body.file_attente - acquittes.length) : null}
    where id = ${ctx.siteId}`;
  return NextResponse.json({ ok: true, acquittes, tables_inconnues: res.unknownTables });
}
