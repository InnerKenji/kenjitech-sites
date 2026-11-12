/* Graphes SVG rendus côté serveur : une seule série par graphe (une couleur), axes discrets,
   info-bulle au survol (<title>) sur chaque barre, valeurs principales écrites en clair. */
import { kg } from "@/lib/fmt";

type Pt = { label: string; value: number; detail?: string };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
const court = (v: number) => (v >= 1e6 ? `${(v / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M` : v >= 1e3 ? `${(v / 1e3).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k` : v.toLocaleString("fr-FR"));

/** Colonnes verticales (évolution dans le temps). */
export function Colonnes({ data, unite = "kg", hauteur = 220, couleur = "#023D6E", etiquettesTous = 1, largeur = 900 }: {
  data: Pt[]; unite?: string; hauteur?: number; couleur?: string; etiquettesTous?: number; largeur?: number;
}) {
  const W = largeur, H = hauteur, ml = 54, mb = 34, mt = 14, mr = 8;
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const iw = W - ml - mr, ih = H - mb - mt;
  const bw = data.length ? iw / data.length : iw;
  const gap = Math.min(6, bw * 0.25);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const best = data.reduce((a, d, i) => (d.value > (data[a]?.value ?? -1) ? i : a), 0);
  const gid = `g${couleur.replace(/[^0-9a-z]/gi, "")}${W}${H}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="graphe en colonnes">
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={couleur} stopOpacity={0.75} /><stop offset="1" stopColor={couleur} /></linearGradient></defs>
      {ticks.map((t) => {
        const y = mt + ih - (t / max) * ih;
        return (
          <g key={t}>
            <line x1={ml} x2={W - mr} y1={y} y2={y} stroke="#E3E9EF" strokeWidth={1} />
            <text x={ml - 6} y={y + 4} textAnchor="end" fontSize={11} fill="#5B6B7B">{court(t)}</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const h = (d.value / max) * ih;
        const x = ml + i * bw + gap / 2;
        const y = mt + ih - h;
        const w = Math.max(1, bw - gap);
        const r = Math.min(4, w / 2, h);
        return (
          <g key={i} className="bar">
            <rect x={ml + i * bw} y={mt} width={bw} height={ih} fill="transparent" />
            <path d={h <= 0 ? "" : `M${x},${mt + ih} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${mt + ih} Z`} fill={`url(#${gid})`} style={{ animationDelay: `${Math.min(i * 15, 400)}ms` }} />
            <title>{`${d.label} : ${kg(d.value)} ${unite}${d.detail ? ` · ${d.detail}` : ""}`}</title>
            {i % etiquettesTous === 0 && (
              <text x={x + w / 2} y={H - mb + 16} textAnchor="middle" fontSize={11} fill="#5B6B7B">{d.label}</text>
            )}
            {i === best && d.value > 0 && (
              <text x={x + w / 2} y={y - 5} textAnchor="middle" fontSize={11} fill="#14212E" fontWeight={600}>{court(d.value)}</text>
            )}
          </g>
        );
      })}
      <line x1={ml} x2={W - mr} y1={mt + ih} y2={mt + ih} stroke="#9FB3C6" />
    </svg>
  );
}

/** Classement en barres horizontales. */
export function Classement({ data, unite = "kg", couleur = "#023D6E" }: { data: Pt[]; unite?: string; couleur?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="rank">
      {data.map((d, i) => (
        <div key={i} className="rank-row" title={`${d.label} : ${kg(d.value)} ${unite}${d.detail ? ` · ${d.detail}` : ""}`}>
          <span className="rank-l">{d.label || "-"}</span>
          <span className="rank-b"><i style={{ width: `${(d.value / max) * 100}%`, background: `linear-gradient(90deg, ${couleur}B3, ${couleur})`, animationDelay: `${i * 40}ms` }} /></span>
          <span className="rank-v">{court(d.value)} {unite}</span>
        </div>
      ))}
      {data.length === 0 && <p className="muted small">Aucune donnée.</p>}
    </div>
  );
}
