import { NextRequest, NextResponse } from "next/server";
import { authSite, err } from "@/lib/syncauth";
import { sql, audit } from "@/lib/db";
import { applySchema, ensureSchema, TableDef } from "@/lib/mirror";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Le poste envoie la description de ses tables ; la plateforme crée ou complète les tables miroir. */
export async function POST(req: NextRequest) {
  const ctx = await authSite(req);
  if (ctx instanceof NextResponse) return ctx;
  let tables: TableDef[];
  try {
    tables = JSON.parse(ctx.body.toString("utf8")).tables;
    if (!Array.isArray(tables) || tables.length > 500) throw new Error();
  } catch {
    return err(400, "schema_invalide");
  }
  try {
    await sql().begin(async (t) => {
      await t`select pg_advisory_xact_lock(hashtext(${ctx.schema}))`;
      await ensureSchema(t, ctx.schema);
      await applySchema(t, ctx.schema, tables);
    });
  } catch (e) {
    return err(400, "schema_refuse", { detail: String((e as Error).message) });
  }
  await audit(`poste:${ctx.siteId}`, "schema", ctx.exploitantId, { tables: tables.map((t) => t.name) });
  return NextResponse.json({ ok: true, tables: tables.length });
}
