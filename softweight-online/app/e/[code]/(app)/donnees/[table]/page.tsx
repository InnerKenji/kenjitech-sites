import { notFound } from "next/navigation";
import { requireUser } from "@/lib/tenant";
import { sql } from "@/lib/db";
import { q, ident } from "@/lib/mirror";
import UserTop from "@/components/UserTop";
import { dt } from "@/lib/fmt";

export const dynamic = "force-dynamic";
const PAGE = 100;

function cell(v: unknown) {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return dt(v);
  if (typeof v === "object") return "[données]";
  return String(v);
}

export default async function Table({
  params,
  searchParams,
}: {
  params: Promise<{ code: string; table: string }>;
  searchParams: Promise<{ p?: string; sup?: string; q?: string }>;
}) {
  const { code, table } = await params;
  const { e, s } = await requireUser(code);
  const sp = await searchParams;
  let tn = "";
  try {
    tn = ident(table);
  } catch {
    notFound();
  }
  const [def] = await sql().unsafe(`select colonnes from ${q(e.schema)}._tables where nom = $1`, [tn]);
  if (!def) notFound();
  const cols = (def.colonnes as { name: string; pg: string }[]).map((c) => c.name);
  const page = Math.max(0, Number(sp.p ?? 0) | 0);
  const sup = sp.sup === "1";
  const search = (sp.q ?? "").trim().slice(0, 100);
  const where = [sup ? "_deleted" : "not _deleted"];
  const args: unknown[] = [];
  if (search) {
    args.push(`%${search}%`);
    where.push(`_raw::text ilike $${args.length}`);
  }
  const full = `${q(e.schema)}.${q("m_" + tn)}`;
  const [{ n }] = await sql().unsafe(`select count(*)::int n from ${full} where ${where.join(" and ")}`, args as never[]);
  const rows = await sql().unsafe(
    `select _synced_at, _deleted_at${cols.length ? ", " + cols.map(q).join(", ") : ""} from ${full}
     where ${where.join(" and ")} order by _seq desc limit ${PAGE} offset ${page * PAGE}`,
    args as never[]
  );
  const base = `/e/${e.code}/donnees/${tn}`;
  const qs = (p: number) => {
    const u = new URLSearchParams();
    if (search) u.set("q", search);
    if (sup) u.set("sup", "1");
    u.set("p", String(p));
    return "?" + u.toString();
  };
  return (
    <>
      <UserTop code={e.code} nom={e.nom} user={s.k === "user" ? s.nom : ""} on="donnees" />
      <main className="wrap">
        <h1>
          {tn} <span className="muted small">({n.toLocaleString("fr-FR")} lignes{sup ? " supprimées" : ""})</span>
        </h1>
        <form className="row card noprint" method="get">
          <div>
            <label>Rechercher</label>
            <input name="q" defaultValue={search} />
          </div>
          <label className="toggle nogrow">
            <input type="checkbox" name="sup" value="1" defaultChecked={sup} /> Afficher les lignes supprimées sur le poste
          </label>
          <button className="btn nogrow">Filtrer</button>
        </form>
        <div className="scroll">
          <table className="t">
            <thead>
              <tr>
                {cols.map((c) => <th key={c}>{c}</th>)}
                <th>Synchronisé le</th>
                {sup && <th>Supprimé le</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {cols.map((c) => <td key={c}>{cell(r[c])}</td>)}
                  <td>{dt(r._synced_at)}</td>
                  {sup && <td>{dt(r._deleted_at)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pager">
          {page > 0 && <a className="btn sm ghost" href={base + qs(page - 1)}>← Précédent</a>}
          <span className="muted small">Page {page + 1} / {Math.max(1, Math.ceil(n / PAGE))}</span>
          {(page + 1) * PAGE < n && <a className="btn sm ghost" href={base + qs(page + 1)}>Suivant →</a>}
        </div>
      </main>
    </>
  );
}
