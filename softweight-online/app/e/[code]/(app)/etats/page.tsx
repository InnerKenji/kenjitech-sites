import Link from "next/link";
import { requireUser } from "@/lib/tenant";
import { chercherPesees, lireFiltres, valeursDistinctes, vuePesees, where } from "@/lib/pesees";
import { sql } from "@/lib/db";
import UserTop from "@/components/UserTop";
import FiltresPesees from "@/components/FiltresPesees";
import PrintButton from "@/components/PrintButton";
import Foot from "@/components/Foot";
import { kg } from "@/lib/fmt";

export const dynamic = "force-dynamic";
const MAX = 2000;

export default async function Etats({ params, searchParams }: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { e, s } = await requireUser((await params).code);
  const sp = await searchParams;
  const f = lireFiltres(sp);
  f.statut = f.statut || "complete";
  const [{ rows, total, poids }, listes] = await Promise.all([chercherPesees(e.schema, f, MAX, 0), valeursDistinctes(e.schema)]);
  const v = await vuePesees(e.schema);
  const w = where(f);
  const parProduit = v ? await sql().unsafe(`select p.produit_nom k, count(*)::int n, coalesce(sum(p.poids_net),0)::float8 t from ${v} ${w.sql} group by 1 order by 3 desc limit 15`, w.args as never[]) : [];
  const parClient = v ? await sql().unsafe(`select p.client_nom k, count(*)::int n, coalesce(sum(p.poids_net),0)::float8 t from ${v} ${w.sql} group by 1 order by 3 desc limit 15`, w.args as never[]) : [];
  const u = new URLSearchParams();
  for (const [k, val] of Object.entries(f)) if (val) u.set(k, val);
  const periode = [f.du && `du ${f.du.split("-").reverse().join("/")}`, f.au && `au ${f.au.split("-").reverse().join("/")}`].filter(Boolean).join(" ") || "toutes dates";
  return (
    <>
      <UserTop code={e.code} nom={e.nom} user={s.k === "user" ? s.nom : ""} on="etats" />
      <main className="wrap">
        <div className="row noprint" style={{ alignItems: "center", marginBottom: 8 }}>
          <h1 style={{ margin: 0 }}>États des pesées</h1>
          <div className="nogrow row" style={{ gap: 6 }}>
            <a className="btn sm" href={`/e/${e.code}/etats/export?${u.toString()}`}>Exporter en Excel</a>
            <PrintButton label="Imprimer / PDF" />
          </div>
        </div>
        <FiltresPesees f={f} listes={listes} />
        <div className="card wm">
          <h2 style={{ marginBottom: 2 }}>{e.nom} — État des pesées {f.statut === "attente" ? "en attente" : f.statut === "supprimee" ? "supprimées" : f.statut === "toutes" ? "" : "complétées"}</h2>
          <p className="muted small" style={{ marginTop: 0 }}>Période : {periode}{f.client ? ` · client : ${f.client}` : ""}{f.produit ? ` · produit : ${f.produit}` : ""}{f.magasin ? ` · site : ${f.magasin}` : ""}</p>
          <div className="grid g4" style={{ marginBottom: 14 }}>
            <div className="kpi"><b>{total.toLocaleString("fr-FR")}</b><span>pesées</span></div>
            <div className="kpi a"><b>{kg(poids)} kg</b><span>poids net total ({kg(poids / 1000)} t)</span></div>
            <div className="kpi g"><b>{total ? kg(Math.round(poids / total)) : 0} kg</b><span>poids net moyen</span></div>
          </div>
          <div className="grid g2">
            <div>
              <h3>Par produit</h3>
              <table className="t"><thead><tr><th>Produit</th><th>Pesées</th><th>Net (kg)</th></tr></thead>
                <tbody>{parProduit.map((r, i) => <tr key={i}><td>{r.k || "—"}</td><td className="num">{r.n}</td><td className="num">{kg(r.t)}</td></tr>)}</tbody></table>
            </div>
            <div>
              <h3>Par client</h3>
              <table className="t"><thead><tr><th>Client</th><th>Pesées</th><th>Net (kg)</th></tr></thead>
                <tbody>{parClient.map((r, i) => <tr key={i}><td>{r.k || "—"}</td><td className="num">{r.n}</td><td className="num">{kg(r.t)}</td></tr>)}</tbody></table>
            </div>
          </div>
          <h3 style={{ marginTop: 18 }}>Détail {total > MAX && <span className="muted small">(les {MAX} plus récentes affichées ; l&apos;export Excel contient tout)</span>}</h3>
          <div className="scroll" style={{ maxHeight: "none" }}>
            <table className="t">
              <thead><tr><th>N°</th><th>Date</th><th>Immat.</th><th>Client</th><th>Produit</th><th>Transporteur</th><th>Poids 1</th><th>Poids 2</th><th>Net (kg)</th><th>Site</th><th className="noprint"></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.tbl + r.code_pesee + r.site}>
                    <td>{r.code_pesee}</td><td>{r.date_2 || r.date_1}</td><td>{r.num_imma}</td><td>{r.client_nom}</td><td>{r.produit_nom}</td><td>{r.transporteur_nom}</td>
                    <td className="num">{kg(r.poids_1)}</td><td className="num">{kg(r.poids_2)}</td><td className="num"><b>{kg(r.poids_net)}</b></td><td>{r.magasin}</td>
                    <td className="noprint"><Link href={`/e/${e.code}/pesees/${encodeURIComponent(r.tbl)}/${encodeURIComponent(String(r.code_pesee))}?s=${r.site}`}>Ticket</Link></td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={8}><b>TOTAL</b></td><td className="num"><b>{kg(poids)}</b></td><td colSpan={2}></td></tr></tfoot>
            </table>
          </div>
        </div>
      </main>
      <Foot />
    </>
  );
}
