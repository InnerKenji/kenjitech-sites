import Link from "next/link";
import { requireUser } from "@/lib/tenant";
import { chercherPesees, lireFiltres, valeursDistinctes } from "@/lib/pesees";
import { sql } from "@/lib/db";
import UserTop from "@/components/UserTop";
import FiltresPesees from "@/components/FiltresPesees";
import Foot from "@/components/Foot";
import { kg } from "@/lib/fmt";

export const dynamic = "force-dynamic";
const PAGE = 50;

const TITRES: Record<string, string> = {
  complete: "Pesées complétées",
  attente: "Pesées en attente (1re pesée faite)",
  supprimee: "Pesées supprimées sur le poste",
  toutes: "Toutes les pesées",
};

function dt(d: unknown, h: unknown) {
  return [d, h].filter(Boolean).join(" ");
}

export default async function Pesees({ params, searchParams }: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { e, s } = await requireUser((await params).code);
  const sp = await searchParams;
  const f = lireFiltres(sp);
  f.statut = f.statut || "complete";
  const page = Math.max(0, Number(sp.p ?? 0) | 0);
  const [{ rows, total, poids }, listes, file] = await Promise.all([
    chercherPesees(e.schema, f, PAGE, page * PAGE),
    valeursDistinctes(e.schema),
    sql()`select coalesce(sum(file_attente),0)::int n from plateforme.sites where exploitant_id = ${e.id} and statut = 'actif'`,
  ]);
  const enAttenteEnvoi = file[0].n as number;
  const qs = (p: number) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v) u.set(k, v);
    u.set("p", String(p));
    return "?" + u.toString();
  };
  const base = `/e/${e.code}/pesees`;
  return (
    <>
      <UserTop code={e.code} nom={e.nom} user={s.k === "user" ? s.nom : ""} on="pesees" />
      <main className="wrap">
        <div className="row" style={{ alignItems: "center", marginBottom: 6 }}>
          <h1 style={{ margin: 0 }}>{TITRES[f.statut] ?? "Pesées"}</h1>
          <div className="nogrow row" style={{ gap: 6 }}>
            {(["complete", "attente", "supprimee"] as const).map((st) => (
              <Link key={st} className={`btn sm ${f.statut === st ? "" : "ghost"}`} href={`${base}?statut=${st}`}>
                {st === "complete" ? "Complétées" : st === "attente" ? "En attente" : "Supprimées"}
              </Link>
            ))}
          </div>
        </div>
        {enAttenteEnvoi > 0 && (
          <div className="alert warn">
            {enAttenteEnvoi} modification(s) enregistrée(s) sur le poste ne sont pas encore arrivées en ligne (non synchronisées). Elles apparaîtront dès que le poste aura Internet.
          </div>
        )}
        <FiltresPesees f={f} listes={listes} />
        <div className="grid g4" style={{ marginBottom: 14 }}>
          <div className="kpi"><b>{total.toLocaleString("fr-FR")}</b><span>pesées</span></div>
          {f.statut !== "attente" && <div className="kpi a"><b>{kg(poids)} kg</b><span>poids net total</span></div>}
          {f.statut !== "attente" && total > 0 && <div className="kpi g"><b>{kg(Math.round(poids / total))} kg</b><span>poids net moyen</span></div>}
        </div>
        <div className="scroll">
          <table className="t">
            <thead>
              <tr>
                <th>N° pesée</th><th>Immatriculation</th><th>Client</th><th>Produit</th><th>Transporteur</th>
                <th>1re pesée</th><th>Poids 1 (kg)</th>
                {f.statut !== "attente" && <><th>2e pesée</th><th>Poids 2 (kg)</th><th>Net (kg)</th></>}
                <th>Site</th><th>Mouvement</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.tbl + r.code_pesee + r.site}>
                  <td><b>{r.code_pesee}</b></td>
                  <td>{r.num_imma}</td>
                  <td>{r.client_nom}</td>
                  <td>{r.produit_nom}</td>
                  <td>{r.transporteur_nom}</td>
                  <td>{dt(r.date_1, r.heure_1)}</td>
                  <td className="num">{kg(r.poids_1)}</td>
                  {f.statut !== "attente" && <>
                    <td>{dt(r.date_2, r.heure_2)}</td>
                    <td className="num">{kg(r.poids_2)}</td>
                    <td className="num"><b>{kg(r.poids_net)}</b></td>
                  </>}
                  <td>{r.magasin}{r.statut === "supprimee" && <> <span className="badge del">supprimée</span></>}</td>
                  <td>{r.mouvement}</td>
                  <td><Link className="btn sm ghost" href={`${base}/${encodeURIComponent(r.tbl)}/${encodeURIComponent(String(r.code_pesee))}?s=${r.site}`}>Ticket</Link></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={13} className="muted">Aucune pesée pour ces critères.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="pager">
          {page > 0 && <a className="btn sm ghost" href={base + qs(page - 1)}>← Précédent</a>}
          <span className="muted small">Page {page + 1} / {Math.max(1, Math.ceil(total / PAGE))}</span>
          {(page + 1) * PAGE < total && <a className="btn sm ghost" href={base + qs(page + 1)}>Suivant →</a>}
        </div>
      </main>
      <Foot />
    </>
  );
}
