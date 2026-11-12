import { requireUser } from "@/lib/tenant";
import { sql } from "@/lib/db";
import UserTop from "@/components/UserTop";
import Foot from "@/components/Foot";
import { ago } from "@/lib/fmt";

export const dynamic = "force-dynamic";

export default async function Tableau({ params }: { params: Promise<{ code: string }> }) {
  const { e, s } = await requireUser((await params).code);
  const sites = await sql()`select magasin, pont_numero, pont_nom, derniere_connexion, derniere_synchro, file_attente, statut
                            from plateforme.sites where exploitant_id = ${e.id} order by created_at`;
  return (
    <>
      <UserTop code={e.code} nom={e.nom} user={s.k === "user" ? s.nom : ""} on="tableau" />
      <main className="wrap">
        <h1>Tableau de bord</h1>
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
