import Link from "next/link";
import { requireUser } from "@/lib/tenant";
import { sql } from "@/lib/db";
import { q } from "@/lib/mirror";
import UserTop from "@/components/UserTop";
import Foot from "@/components/Foot";

export const dynamic = "force-dynamic";

export default async function Donnees({ params }: { params: Promise<{ code: string }> }) {
  const { e, s } = await requireUser((await params).code);
  let tables: { nom: string; n: number }[] = [];
  try {
    const t = await sql().unsafe(`select nom from ${q(e.schema)}._tables order by nom`);
    for (const r of t) {
      const [c] = await sql().unsafe(`select count(*)::int n from ${q(e.schema)}.${q("m_" + r.nom)} where not _deleted`);
      tables.push({ nom: r.nom, n: c.n });
    }
  } catch {
    tables = [];
  }
  return (
    <>
      <UserTop code={e.code} nom={e.nom} user={s.k === "user" ? s.nom : ""} on="donnees" />
      <main className="wrap">
        <h1>Toutes les données synchronisées</h1>
        <p className="muted">Copie complète de la base du logiciel, table par table.</p>
        <div className="grid g4">
          {tables.map((t) => (
            <Link key={t.nom} href={`/e/${e.code}/donnees/${t.nom}`} className="kpi" style={{ textDecoration: "none" }}>
              <b>{t.n.toLocaleString("fr-FR")}</b>
              <span>{t.nom}</span>
            </Link>
          ))}
          {tables.length === 0 && <p className="muted">Aucune donnée pour l&apos;instant : la première synchronisation n&apos;a pas encore eu lieu.</p>}
        </div>
      </main>
      <Foot />
    </>
  );
}
