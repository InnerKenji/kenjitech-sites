import { requireUser } from "@/lib/tenant";
import { sql } from "@/lib/db";
import UserTop from "@/components/UserTop";
import Foot from "@/components/Foot";
import { ago, kg } from "@/lib/fmt";
import Link from "next/link";
import { vuePesees, type Pesee } from "@/lib/pesees";

export const dynamic = "force-dynamic";

export default async function Tableau({ params }: { params: Promise<{ code: string }> }) {
  const { e, s } = await requireUser((await params).code);
  const sites = await sql()`select magasin, pont_numero, pont_nom, derniere_connexion, derniere_synchro, file_attente, statut
                            from plateforme.sites where exploitant_id = ${e.id} order by created_at`;
  const v = await vuePesees(e.schema);
  const jour = new Date().toLocaleDateString("fr-CA", { timeZone: "Africa/Douala" }); // AAAA-MM-JJ
  const mois = jour.slice(0, 7) + "-01";
  type K = { n: number; t: number };
  const k = async (cond: string, args: unknown[]): Promise<K> => {
    if (!v) return { n: 0, t: 0 };
    const [r] = await sql().unsafe(`select count(*)::int n, coalesce(sum(p.poids_net),0)::float8 t from ${v} where ${cond}`, args as never[]);
    return { n: r.n, t: Number(r.t) };
  };
  const [auj, ceMois, attente, dernieres] = await Promise.all([
    k(`p.statut = 'complete' and p.d2 >= $1::date and p.d2 < $1::date + 1`, [jour]),
    k(`p.statut = 'complete' and p.d2 >= $1::date`, [mois]),
    k(`p.statut = 'attente'`, []),
    v ? sql().unsafe(`select p.* from ${v} where p.statut <> 'supprimee' order by coalesce(p.d2, p.d1) desc nulls last limit 10`) : Promise.resolve([]),
  ]);
  return (
    <>
      <UserTop code={e.code} nom={e.nom} user={s.k === "user" ? s.nom : ""} on="tableau" />
      <main className="wrap">
        <h1>Tableau de bord</h1>
        <div className="grid g4" style={{ marginBottom: 16 }}>
          <div className="kpi"><b>{auj.n}</b><span>pesées complétées aujourd&apos;hui · {kg(auj.t)} kg</span></div>
          <div className="kpi a"><b>{kg(ceMois.t / 1000)} t</b><span>tonnage net du mois ({ceMois.n} pesées)</span></div>
          <div className="kpi g"><b>{attente.n}</b><span>camions en attente de 2e pesée</span></div>
          <div className="kpi"><b>{sites.reduce((a, x) => a + (x.file_attente ?? 0), 0)}</b><span>modifications non encore synchronisées</span></div>
        </div>
        <div className="card">
          <div className="row" style={{ alignItems: "center" }}><h2 style={{ margin: 0 }}>Dernières pesées</h2><Link className="btn sm ghost nogrow" href={`/e/${e.code}/pesees`}>Toutes les pesées →</Link></div>
          <div className="scroll" style={{ marginTop: 10 }}><table className="t">
            <thead><tr><th>N°</th><th>Immat.</th><th>Client</th><th>Produit</th><th>Date</th><th>Net (kg)</th><th>État</th><th></th></tr></thead>
            <tbody>{(dernieres as unknown as Pesee[]).map((r) => (
              <tr key={r.tbl + r.code_pesee + r.site}>
                <td>{r.code_pesee}</td><td>{r.num_imma}</td><td>{r.client_nom}</td><td>{r.produit_nom}</td>
                <td>{r.statut === "complete" ? `${r.date_2 ?? ""} ${r.heure_2 ?? ""}` : `${r.date_1 ?? ""} ${r.heure_1 ?? ""}`}</td>
                <td className="num"><b>{kg(r.poids_net)}</b></td>
                <td>{r.statut === "complete" ? <span className="badge ok">complétée</span> : <span className="badge wait">en attente</span>}</td>
                <td><Link href={`/e/${e.code}/pesees/${encodeURIComponent(r.tbl)}/${encodeURIComponent(String(r.code_pesee))}?s=${r.site}`}>Ticket</Link></td>
              </tr>))}
              {dernieres.length === 0 && <tr><td colSpan={8} className="muted">Aucune pesée synchronisée pour l&apos;instant.</td></tr>}
            </tbody></table></div>
        </div>
        <div className="card">
          <h2>Ponts-bascules</h2>
          <table className="t">
            <thead>
              <tr><th>Magasin</th><th>Pont-bascule</th><th>Dernier contact</th><th>Dernière synchro</th><th>En attente d&apos;envoi</th><th>État</th></tr>
            </thead>
            <tbody>
              {sites.map((x, i) => {
                const online = x.derniere_connexion && Date.now() - new Date(x.derniere_connexion).getTime() < 10 * 60_000;
                return (
                  <tr key={i}>
                    <td>{x.magasin}</td>
                    <td>{[x.pont_numero, x.pont_nom].filter(Boolean).join(" — ")}</td>
                    <td>{ago(x.derniere_connexion)}</td>
                    <td>{ago(x.derniere_synchro)}</td>
                    <td className="num">{x.file_attente ?? "—"}</td>
                    <td>
                      {x.statut !== "actif" ? <span className="badge del">révoqué</span>
                        : online ? (x.file_attente ? <span className="badge wait">synchro en cours</span> : <span className="badge ok">à jour</span>)
                        : <span className="badge off">hors ligne</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
      <Foot />
    </>
  );
}
