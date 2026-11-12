/**
 * Accès aux pesées synchronisées : une table miroir par campagne (m_pesee_<campagne>),
 * réunies en une seule vue de travail. Les colonnes absentes d'une campagne valent NULL.
 */
import { sql } from "./db";
import { q } from "./mirror";

export const COLS = [
  "code_pesee", "num_bl", "nom_client", "produit", "id_operateur_1", "id_operateur_2", "num_imma",
  "date_1", "date_2", "heure_1", "heure_2", "poids_1", "poids_2", "poids_net", "pont_1", "pont_2",
  "provenance", "nom_magasin", "chauffeur", "observation", "mouvement", "code_fournisseur", "destination",
  "poids_declare", "ecart", "transporteur", "campagne", "conteneur", "plomb", "remorque", "state",
] as const;

const TEXTE = new Set(["code_pesee", "num_bl", "nom_client", "produit", "id_operateur_1", "id_operateur_2", "num_imma",
  "date_1", "date_2", "heure_1", "heure_2", "provenance", "nom_magasin", "chauffeur", "observation", "mouvement",
  "code_fournisseur", "destination", "transporteur", "campagne", "conteneur", "plomb", "remorque"]);

export type Pesee = Record<(typeof COLS)[number], string | number | null> & {
  tbl: string; site: string; statut: "attente" | "complete" | "supprimee"; d1: string | null; d2: string | null;
  synced_at: Date; client_nom: string; produit_nom: string; transporteur_nom: string; fournisseur_nom: string; magasin: string;
};

export async function tablesPesees(schema: string): Promise<{ nom: string; cols: Set<string> }[]> {
  try {
    const rows = await sql().unsafe(`select nom, colonnes from ${q(schema)}._tables where nom like 'pesee\\_%' order by nom`);
    return rows.map((r) => ({ nom: String(r.nom), cols: new Set((r.colonnes as { name: string }[]).map((c) => c.name)) }));
  } catch {
    return [];
  }
}

const dateExpr = (d: string, h: string) =>
  `case when ${d} ~ '^\\d{2}/\\d{2}/\\d{4}$' then to_timestamp(${d} || ' ' || coalesce(nullif(${h}, ''), '00:00:00'), 'DD/MM/YYYY HH24:MI:SS')::timestamp end`;

/** Sous-requête SQL qui réunit toutes les campagnes, avec colonnes calculées. */
export async function vuePesees(schema: string): Promise<string | null> {
  const tables = await tablesPesees(schema);
  if (!tables.length) return null;
  const parts = tables.map((t) => {
    const sel = COLS.map((c) => (t.cols.has(c) ? `${TEXTE.has(c) ? `${q(c)}::text` : `${q(c)}::numeric`} as ${q(c)}` : `null::${TEXTE.has(c) ? "text" : "numeric"} as ${q(c)}`));
    return `select '${t.nom.replace(/'/g, "")}'::text as tbl, _site::text as site, _synced_at as synced_at, _deleted as efface, ${sel.join(", ")}
            from ${q(schema)}.${q("m_" + t.nom)}`;
  });
  // Les champs client/produit/transporteur contiennent « code + espaces + nom » : on garde le nom lisible.
  const nomSeul = (c: string) => `coalesce(nullif(trim(regexp_replace(${c}, '^\\S+\\s{3,}', '')), ''), ${c})`;
  return `(select u.*,
      case when u.nom_magasin ilike '%del' or u.efface then 'supprimee' when u.poids_2 is not null then 'complete' else 'attente' end as statut,
      regexp_replace(coalesce(u.nom_magasin, ''), 'del$', '') as magasin,
      ${dateExpr("u.date_1", "u.heure_1")} as d1,
      ${dateExpr("u.date_2", "u.heure_2")} as d2,
      ${nomSeul("u.nom_client")} as client_nom,
      ${nomSeul("u.produit")} as produit_nom,
      ${nomSeul("u.transporteur")} as transporteur_nom,
      ${nomSeul("u.code_fournisseur")} as fournisseur_nom
    from (${parts.join(" union all ")}) u) p`;
}

export type Filtres = {
  statut?: string; du?: string; au?: string; client?: string; produit?: string; transporteur?: string;
  immat?: string; magasin?: string; campagne?: string; mouvement?: string; q?: string;
};

/** Conditions SQL + paramètres à partir des filtres de l'écran. */
export function where(f: Filtres): { sql: string; args: unknown[] } {
  const w: string[] = [];
  const a: unknown[] = [];
  const add = (cond: (i: number) => string, v: unknown) => { a.push(v); w.push(cond(a.length)); };
  const st = f.statut || "complete";
  if (st !== "toutes") add((i) => `p.statut = $${i}`, st);
  const dcol = st === "attente" ? "p.d1" : "coalesce(p.d2, p.d1)";
  if (f.du && /^\d{4}-\d{2}-\d{2}$/.test(f.du)) add((i) => `${dcol} >= $${i}::date`, f.du);
  if (f.au && /^\d{4}-\d{2}-\d{2}$/.test(f.au)) add((i) => `${dcol} < ($${i}::date + 1)`, f.au);
  if (f.client) add((i) => `p.nom_client ilike $${i}`, `%${f.client}%`);
  if (f.produit) add((i) => `p.produit ilike $${i}`, `%${f.produit}%`);
  if (f.transporteur) add((i) => `p.transporteur ilike $${i}`, `%${f.transporteur}%`);
  if (f.immat) add((i) => `replace(upper(p.num_imma), ' ', '') like $${i}`, `%${f.immat.toUpperCase().replace(/\s/g, "")}%`);
  if (f.magasin) add((i) => `p.magasin = $${i}`, f.magasin);
  if (f.campagne) add((i) => `p.tbl = $${i}`, f.campagne);
  if (f.mouvement) add((i) => `p.mouvement = $${i}`, f.mouvement);
  if (f.q) {
    add((i) => `(p.code_pesee ilike $${i} or p.num_bl ilike $${i} or p.num_imma ilike $${i} or p.nom_client ilike $${i} or p.chauffeur ilike $${i} or p.conteneur ilike $${i} or p.observation ilike $${i})`, `%${f.q}%`);
  }
  return { sql: w.length ? "where " + w.join(" and ") : "", args: a };
}

export function lireFiltres(sp: Record<string, string | string[] | undefined>): Filtres {
  const g = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v)?.trim().slice(0, 80) || undefined;
  };
  return { statut: g("statut"), du: g("du"), au: g("au"), client: g("client"), produit: g("produit"), transporteur: g("transporteur"),
    immat: g("immat"), magasin: g("magasin"), campagne: g("campagne"), mouvement: g("mouvement"), q: g("q") };
}

export async function chercherPesees(schema: string, f: Filtres, limit = 100, offset = 0) {
  const v = await vuePesees(schema);
  if (!v) return { rows: [] as Pesee[], total: 0, poids: 0 };
  const w = where(f);
  const order = f.statut === "attente" ? "p.d1 desc nulls last" : "coalesce(p.d2, p.d1) desc nulls last";
  const [tot] = await sql().unsafe(`select count(*)::int n, coalesce(sum(p.poids_net),0)::float8 poids from ${v} ${w.sql}`, w.args as never[]);
  const rows = await sql().unsafe(`select p.* from ${v} ${w.sql} order by ${order}, p.code_pesee desc limit ${limit | 0} offset ${offset | 0}`, w.args as never[]);
  return { rows: rows as unknown as Pesee[], total: tot.n as number, poids: Number(tot.poids) };
}

export async function unePesee(schema: string, tbl: string, code: string, site?: string) {
  const v = await vuePesees(schema);
  if (!v) return null;
  const args: unknown[] = [tbl, code];
  let cond = "p.tbl = $1 and p.code_pesee = $2";
  if (site) { args.push(site); cond += " and p.site = $3"; }
  const rows = await sql().unsafe(`select p.* from ${v} where ${cond} limit 1`, args as never[]);
  return (rows[0] as unknown as Pesee) ?? null;
}

export async function valeursDistinctes(schema: string) {
  const v = await vuePesees(schema);
  if (!v) return { magasins: [], campagnes: [], mouvements: [] };
  const [m, c, mv] = await Promise.all([
    sql().unsafe(`select distinct p.magasin v from ${v} where p.magasin <> '' order by 1`),
    sql().unsafe(`select distinct p.tbl v from ${v} order by 1 desc`),
    sql().unsafe(`select distinct p.mouvement v from ${v} where coalesce(p.mouvement,'') <> '' order by 1`),
  ]);
  return { magasins: m.map((r) => String(r.v)), campagnes: c.map((r) => String(r.v)), mouvements: mv.map((r) => String(r.v)) };
}
