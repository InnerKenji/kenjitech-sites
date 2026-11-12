import { requireUser } from "@/lib/tenant";
import { lireFiltres, valeursDistinctes, vuePesees, where } from "@/lib/pesees";
import { sql } from "@/lib/db";
import UserTop from "@/components/UserTop";
import Foot from "@/components/Foot";
import { Colonnes, Classement } from "@/components/Graphes";
import { kg } from "@/lib/fmt";

export const dynamic = "force-dynamic";

const JOURS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function Statistiques({ params, searchParams }: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { e, s } = await requireUser((await params).code);
  const sp = await searchParams;
  const f = lireFiltres(sp);
  f.statut = "complete";
  const now = new Date();
  if (!f.du && !f.au) {
    f.du = iso(new Date(now.getTime() - 29 * 86400_000));
    f.au = iso(now);
  }
  const listes = await valeursDistinctes(e.schema);
  const v = await vuePesees(e.schema);
  const w = where(f);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Ligne = any;
  const run = async (expr: string): Promise<Ligne[]> => (v ? [...(await sql().unsafe(expr.replace("{v}", () => v).replace("{w}", () => w.sql), w.args as never[]))] : []);
  const D = "coalesce(p.d2, p.d1)";
  // période précédente de même durée (comparaison)
  const du = new Date(f.du ?? iso(now)), au = new Date(f.au ?? iso(now));
  const jours = Math.max(1, Math.round((au.getTime() - du.getTime()) / 86400_000) + 1);
  const fPrev = { ...f, du: iso(new Date(du.getTime() - jours * 86400_000)), au: iso(new Date(du.getTime() - 86400_000)) };
  const wp = where(fPrev);

  const [tot, parJour, parHeure, parJourSem, clients, produits, transp, camions, duree, prev, mvt] = await Promise.all([
    run(`select count(*)::int n, coalesce(sum(p.poids_net),0)::float8 t, coalesce(max(p.poids_net),0)::float8 mx from {v} {w}`),
    run(`select to_char(${D}, 'YYYY-MM-DD') k, count(*)::int n, coalesce(sum(p.poids_net),0)::float8 t from {v} {w} group by 1 order by 1`),
    run(`select extract(hour from p.d1)::int k, count(*)::int n from {v} {w} group by 1 order by 1`),
    run(`select extract(dow from ${D})::int k, count(*)::int n, coalesce(sum(p.poids_net),0)::float8 t from {v} {w} group by 1 order by 1`),
    run(`select p.client_nom k, count(*)::int n, coalesce(sum(p.poids_net),0)::float8 t from {v} {w} group by 1 order by 3 desc limit 10`),
    run(`select p.produit_nom k, count(*)::int n, coalesce(sum(p.poids_net),0)::float8 t from {v} {w} group by 1 order by 3 desc limit 10`),
    run(`select p.transporteur_nom k, count(*)::int n, coalesce(sum(p.poids_net),0)::float8 t from {v} {w} group by 1 order by 3 desc limit 10`),
    run(`select p.num_imma k, count(*)::int n, coalesce(sum(p.poids_net),0)::float8 t from {v} {w} group by 1 order by 2 desc limit 10`),
    run(`select percentile_cont(0.5) within group (order by extract(epoch from (p.d2 - p.d1)) / 60)::float8 med,
                avg(extract(epoch from (p.d2 - p.d1)) / 60)::float8 moy from {v} {w} and p.d2 > p.d1`.replace("{w} and", w.sql ? "{w} and" : "where")),
    v ? sql().unsafe(`select count(*)::int n, coalesce(sum(p.poids_net),0)::float8 t from ${v} ${wp.sql}`, wp.args as never[]).then((r) => [...r] as Ligne[]) : Promise.resolve([{ n: 0, t: 0 }] as Ligne[]),
    run(`select coalesce(nullif(p.mouvement,''),'—') k, count(*)::int n, coalesce(sum(p.poids_net),0)::float8 t from {v} {w} group by 1 order by 3 desc`),
  ]);
  const T = tot[0] ?? { n: 0, t: 0, mx: 0 };
  const P = prev[0] ?? { n: 0, t: 0 };
  const delta = P.t ? ((T.t - P.t) / P.t) * 100 : null;

  // série quotidienne complète (jours sans pesée = 0)
  const m = new Map(parJour.map((r: { k: string; n: number; t: number }) => [r.k, r]));
  const serie = [];
  for (let i = 0; i < Math.min(jours, 400); i++) {
    const d = iso(new Date(du.getTime() + i * 86400_000));
    const r = m.get(d) as { n: number; t: number } | undefined;
    serie.push({ label: d.slice(8, 10) + "/" + d.slice(5, 7), value: r ? r.t : 0, detail: `${r ? r.n : 0} pesées` });
  }
  const hMap = new Map(parHeure.map((r: { k: number; n: number }) => [r.k, r.n]));
  const heures = Array.from({ length: 24 }, (_, h) => ({ label: `${h}h`, value: Number(hMap.get(h) ?? 0) }));
  const jMap = new Map(parJourSem.map((r: { k: number; t: number; n: number }) => [r.k, r]));
  const semaine = [1, 2, 3, 4, 5, 6, 0].map((k) => {
    const r = jMap.get(k) as { t: number; n: number } | undefined;
    return { label: JOURS[k], value: r ? r.t : 0, detail: `${r ? r.n : 0} pesées` };
  });
  const toPts = (rows: { k: string; n: number; t: number }[]) => rows.map((r) => ({ label: r.k, value: r.t, detail: `${r.n} pesées` }));

  return (
    <>
      <UserTop code={e.code} nom={e.nom} user={s.k === "user" ? s.nom : ""} on="stats" />
      <main className="wrap">
        <h1>Statistiques</h1>
        <form className="card row noprint" method="get">
          <div><label>Du</label><input type="date" name="du" defaultValue={f.du} /></div>
          <div><label>Au</label><input type="date" name="au" defaultValue={f.au} /></div>
          <div><label>Site</label><select name="magasin" defaultValue={f.magasin ?? ""}><option value="">Tous</option>{listes.magasins.map((x) => <option key={x}>{x}</option>)}</select></div>
          <div><label>Produit</label><input name="produit" defaultValue={f.produit} /></div>
          <div><label>Client</label><input name="client" defaultValue={f.client} /></div>
          <button className="btn amber nogrow">Afficher</button>
        </form>

        <div className="grid g4" style={{ marginBottom: 16 }}>
          <div className="kpi"><b>{kg(T.t / 1000)} t</b><span>tonnage net
            {delta !== null && <> · <span className={`delta ${delta >= 0 ? "up" : "down"}`}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)} %</span> vs période précédente</>}</span></div>
          <div className="kpi a"><b>{T.n.toLocaleString("fr-FR")}</b><span>pesées complétées (période précédente : {P.n})</span></div>
          <div className="kpi g"><b>{T.n ? kg(Math.round(T.t / T.n)) : 0} kg</b><span>net moyen · max {kg(T.mx)} kg</span></div>
          <div className="kpi"><b>{duree[0]?.med != null ? `${Math.round(duree[0].med)} min` : "—"}</b><span>durée médiane sur site (1re → 2e pesée)</span></div>
        </div>

        <div className="card">
          <h2>Tonnage net par jour</h2>
          <Colonnes data={serie} etiquettesTous={Math.max(1, Math.ceil(serie.length / 15))} />
        </div>
        <div className="grid g2">
          <div className="card"><h2>Top clients (tonnage)</h2><Classement data={toPts(clients)} /></div>
          <div className="card"><h2>Top produits (tonnage)</h2><Classement data={toPts(produits)} /></div>
          <div className="card"><h2>Top transporteurs (tonnage)</h2><Classement data={toPts(transp)} /></div>
          <div className="card"><h2>Camions les plus fréquents</h2><Classement data={camions.map((r: { k: string; n: number; t: number }) => ({ label: r.k, value: r.n, detail: `${kg(r.t)} kg net` }))} unite="passages" /></div>
          <div className="card"><h2>Heures d&apos;arrivée (1re pesée)</h2><Colonnes data={heures} unite="pesées" hauteur={240} etiquettesTous={3} largeur={360} /></div>
          <div className="card"><h2>Tonnage par jour de la semaine</h2><Colonnes data={semaine} hauteur={240} largeur={360} /></div>
        </div>
        <div className="card">
          <h2>Par mouvement</h2>
          <table className="t"><thead><tr><th>Mouvement</th><th>Pesées</th><th>Net (kg)</th><th>Part</th></tr></thead>
            <tbody>{mvt.map((r: { k: string; n: number; t: number }) => <tr key={r.k}><td>{r.k}</td><td className="num">{r.n}</td><td className="num">{kg(r.t)}</td><td className="num">{T.t ? ((r.t / T.t) * 100).toFixed(1) : 0} %</td></tr>)}</tbody></table>
        </div>
      </main>
      <Foot />
    </>
  );
}
