import { NextRequest, NextResponse } from "next/server";
import { authSite, err } from "@/lib/syncauth";
import { sql } from "@/lib/db";
import { q, tableName } from "@/lib/mirror";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Contrôle de cohérence : le poste envoie, par table et par mois, le nombre de lignes
 * (et la somme d'une colonne, ex. poids net). La plateforme répond les périodes en écart,
 * que le poste renvoie alors en entier.
 * Corps : { controles: [{ table, colonne_date, colonne_somme?, periodes: [{ periode:"2026-11", nb, somme? }] }] }
 */
export async function POST(req: NextRequest) {
  const ctx = await authSite(req);
  if (ctx instanceof NextResponse) return ctx;
  type P = { periode: string; nb: number; somme?: string | number | null };
  type C = { table: string; colonne_date?: string; colonne_somme?: string; periodes: P[] };
  let controles: C[];
  try {
    controles = JSON.parse(ctx.body.toString("utf8")).controles;
    if (!Array.isArray(controles)) throw new Error();
  } catch {
    return err(400, "json_invalide");
  }
  const ecarts: { table: string; periode: string; poste: P; enLigne: { nb: number; somme: string | null } }[] = [];
  for (const c of controles) {
    let tn: string, cd: string | null, cs: string | null;
    try {
      tn = tableName(c.table);
      cd = c.colonne_date ? c.colonne_date.toLowerCase() : null; // sans colonne de date : un seul total
      cs = c.colonne_somme ? c.colonne_somme.toLowerCase() : null;
      if ((cd && !/^[a-z_][a-z0-9_]*$/.test(cd)) || (cs && !/^[a-z_][a-z0-9_]*$/.test(cs))) throw new Error();
    } catch {
      continue;
    }
    let rows;
    try {
      rows = await sql().unsafe(
        `select ${cd ? `to_char(${q(cd)}, 'YYYY-MM')` : "'total'"} as periode, count(*)::bigint as nb${cs ? `, coalesce(sum(${q(cs)}),0)::text as somme` : ""}
         from ${q(ctx.schema)}.${q(tn)} where _site = $1 and not _deleted group by 1`,
        [ctx.siteId]
      );
    } catch {
      ecarts.push(...c.periodes.map((p) => ({ table: c.table, periode: p.periode, poste: p, enLigne: { nb: 0, somme: null } })));
      continue;
    }
    const m = new Map(rows.map((r) => [String(r.periode), r]));
    for (const p of c.periodes) {
      const r = m.get(p.periode);
      const nb = r ? Number(r.nb) : 0;
      const somme = r?.somme ?? null;
      const sommeOk = !cs || p.somme === undefined || p.somme === null || Math.abs(Number(somme ?? 0) - Number(p.somme)) < 0.001;
      if (nb !== Number(p.nb) || !sommeOk) ecarts.push({ table: c.table, periode: p.periode, poste: p, enLigne: { nb, somme } });
      await sql().unsafe(
        `insert into ${q(ctx.schema)}._controle (site, nom, periode, nb, somme) values ($1,$2,$3,$4,$5)
         on conflict (site, nom, periode) do update set nb = excluded.nb, somme = excluded.somme, maj = now()`,
        [ctx.siteId, c.table.toLowerCase(), p.periode, Number(p.nb), p.somme == null ? null : String(p.somme)]
      );
    }
  }
  return NextResponse.json({ ok: true, ecarts });
}
