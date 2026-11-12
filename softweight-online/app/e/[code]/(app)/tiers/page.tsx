import Link from "next/link";
import { requireUser } from "@/lib/tenant";
import { sql } from "@/lib/db";
import { q } from "@/lib/mirror";
import UserTop from "@/components/UserTop";
import Foot from "@/components/Foot";

export const dynamic = "force-dynamic";

// table, titre, colonnes affichées [colonne, libellé]
const LISTES: Record<string, { t: string; titre: string; cols: [string, string][] }> = {
  clients: { t: "client", titre: "Clients", cols: [["id_client", "Code"], ["nom_client", "Nom"], ["adresse", "Adresse"], ["tel", "Téléphone"], ["email", "E-mail"], ["type", "Type"]] },
  fournisseurs: { t: "fournisseur", titre: "Fournisseurs et transporteurs", cols: [["code_fournisseur", "Code"], ["nom_fournisseur", "Nom"], ["adresse", "Adresse"], ["tel", "Téléphone"], ["email", "E-mail"], ["type", "Type"]] },
  produits: { t: "produit", titre: "Produits", cols: [["code_produit", "Code"], ["nom_produit", "Nom"], ["description", "Description"]] },
  sites: { t: "site_client", titre: "Sites clients (provenances / destinations)", cols: [["nom_mag", "Site"], ["adresse", "Adresse"], ["societe", "Société"], ["tel", "Téléphone"]] },
  operateurs: { t: "operateur", titre: "Opérateurs", cols: [["id_operateur", "Code"], ["nom", "Identifiant"], ["poste", "Rôle"], ["etat", "État"]] },
  magasins: { t: "magasin", titre: "Magasins / sites de pesage", cols: [["nom_magasin", "Site"], ["rs", "Société"], ["adresse", "Adresse"], ["campagne", "Campagne"]] },
  ponts: { t: "pont", titre: "Ponts-bascules", cols: [["numero_pont", "N°"], ["nom_magasin", "Site"], ["marque", "Marque"], ["numero_certificat", "Certificat"]] },
};

export default async function Tiers({ params, searchParams }: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ l?: string; q?: string }>;
}) {
  const { e, s } = await requireUser((await params).code);
  const sp = await searchParams;
  const cle = sp.l && LISTES[sp.l] ? sp.l : "clients";
  const L = LISTES[cle];
  const search = (sp.q ?? "").trim().slice(0, 80);
  let rows: Record<string, unknown>[] = [];
  let cols = L.cols;
  try {
    const [def] = await sql().unsafe(`select colonnes from ${q(e.schema)}._tables where nom = $1`, [L.t]);
    const dispo = new Set(((def?.colonnes ?? []) as { name: string }[]).map((c) => c.name));
    cols = L.cols.filter(([c]) => dispo.has(c));
    if (cols.length) {
      const args: unknown[] = [];
      let w = "not _deleted";
      if (search) { args.push(`%${search}%`); w += ` and (${cols.map(([c]) => `${q(c)}::text ilike $1`).join(" or ")})`; }
      if (L.t === "operateur") w += ` and coalesce(lower(poste),'') <> 'delete'`;
      rows = await sql().unsafe(`select ${cols.map(([c]) => q(c)).join(", ")} from ${q(e.schema)}.${q("m_" + L.t)} where ${w} order by 2 limit 2000`, args as never[]);
    }
  } catch {
    rows = [];
  }
  return (
    <>
      <UserTop code={e.code} nom={e.nom} user={s.k === "user" ? s.nom : ""} on="tiers" />
      <main className="wrap">
        <h1>{L.titre}</h1>
        <div className="row noprint" style={{ gap: 6, marginBottom: 12 }}>
          {Object.entries(LISTES).map(([k, v]) => (
            <Link key={k} className={`btn sm nogrow ${k === cle ? "" : "ghost"}`} href={`/e/${e.code}/tiers?l=${k}`}>{v.titre.split(" (")[0]}</Link>
          ))}
        </div>
        <form className="card row noprint" method="get">
          <input type="hidden" name="l" value={cle} />
          <div><label>Rechercher</label><input name="q" defaultValue={search} /></div>
          <button className="btn nogrow">Rechercher</button>
        </form>
        <div className="scroll">
          <table className="t">
            <thead><tr>{cols.map(([, l]) => <th key={l}>{l}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => <tr key={i}>{cols.map(([c]) => <td key={c}>{r[c] == null ? "" : String(r[c])}</td>)}</tr>)}
              {rows.length === 0 && <tr><td colSpan={Math.max(1, cols.length)} className="muted">Aucune donnée synchronisée pour l&apos;instant.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="muted small">{rows.length} ligne(s)</p>
      </main>
      <Foot />
    </>
  );
}
