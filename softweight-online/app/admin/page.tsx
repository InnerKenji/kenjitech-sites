import Link from "next/link";
import { redirect } from "next/navigation";
import { adminSession } from "@/lib/session";
import { sql } from "@/lib/db";
import AdminTop from "@/components/AdminTop";
import Foot from "@/components/Foot";
import { ago } from "@/lib/fmt";

export const dynamic = "force-dynamic";

export default async function Admin() {
  const s = await adminSession();
  if (!s || s.k !== "admin") redirect("/admin/login");
  const rows = await sql()`
    select e.id, e.code, e.nom, e.ville, e.statut, e.created_at,
      count(s.id)::int as nb_sites,
      max(s.derniere_synchro) as derniere_synchro,
      max(s.derniere_connexion) as derniere_connexion,
      coalesce(sum(s.file_attente),0)::int as file
    from plateforme.exploitants e left join plateforme.sites s on s.exploitant_id = e.id
    group by e.id order by e.nom`;
  return (
    <>
      <AdminTop login={s.login} on="dash" />
      <main className="wrap">
        <div className="row" style={{ marginBottom: 14 }}>
          <h1 style={{ margin: 0 }}>Exploitants</h1>
          <Link className="btn amber nogrow" href="/admin/nouveau">+ Activer un poste</Link>
        </div>
        <div className="grid g4" style={{ marginBottom: 18 }}>
          <div className="kpi"><b>{rows.length}</b><span>exploitants</span></div>
          <div className="kpi a"><b>{rows.reduce((a, r) => a + r.nb_sites, 0)}</b><span>ponts-bascules reliés</span></div>
          <div className="kpi g"><b>{rows.filter((r) => r.derniere_connexion && Date.now() - new Date(r.derniere_connexion).getTime() < 3600_000).length}</b><span>en ligne (dernière heure)</span></div>
          <div className="kpi"><b>{rows.reduce((a, r) => a + r.file, 0)}</b><span>modifications en attente d&apos;envoi</span></div>
        </div>
        <div className="card">
          {rows.length === 0 ? (
            <p className="muted">Aucun exploitant. Générez un code d&apos;activation sur un poste SoftWEIGHT (Configuration → Module web), puis cliquez sur « Activer un poste ».</p>
          ) : (
            <div className="scroll">
              <table className="t">
                <thead><tr><th>Code</th><th>Entreprise</th><th>Ville</th><th>Postes</th><th>Dernier contact</th><th>Dernière synchro</th><th>En attente</th><th>Statut</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td><Link href={`/admin/exploitants/${r.id}`}><b>{r.code}</b></Link></td>
                      <td>{r.nom}</td><td>{r.ville}</td><td className="num">{r.nb_sites}</td>
                      <td>{ago(r.derniere_connexion)}</td><td>{ago(r.derniere_synchro)}</td><td className="num">{r.file}</td>
                      <td>{r.statut === "actif" ? <span className="badge ok">actif</span> : <span className="badge del">suspendu</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
      <Foot />
    </>
  );
}
