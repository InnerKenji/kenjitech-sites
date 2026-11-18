import Link from "next/link";

/* Petites icônes en ligne (quelques octets chacune, aucun fichier à charger). */
const P: Record<string, string> = {
  tableau: "M3 13h8V3H3zm10 8h8V11h-8zM3 21h8v-6H3zm10-18v6h8V3z",
  pesees: "M12 3a3 3 0 0 0-2.8 4H5l-3 13h20L19 7h-4.2A3 3 0 0 0 12 3zm0 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2z",
  etats: "M6 2h9l5 5v15H6zm8 1.5V8h4.5zM9 12h8v2H9zm0 4h8v2H9z",
  stats: "M4 20V10h3v10zm6.5 0V4h3v16zM17 20v-7h3v7z",
  tiers: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM1 20c0-3.3 3.6-6 8-6s8 2.7 8 6zm16.5 0c0-1.9-.8-3.6-2.1-4.8C19.5 15 23 17 23 20z",
  donnees: "M12 3C7.6 3 4 4.3 4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6c0-1.7-3.6-3-8-3zm0 2c3.9 0 6 1 6 1s-2.1 1-6 1-6-1-6-1 2.1-1 6-1zM6 9.2C7.5 9.7 9.6 10 12 10s4.5-.3 6-.8V12c0 .4-2.1 1.5-6 1.5S6 12.4 6 12zm0 6c1.5.5 3.6.8 6 .8s4.5-.3 6-.8V18c0 .4-2.1 1.5-6 1.5S6 18.4 6 18z",
};
const Ico = ({ k }: { k: string }) => <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={P[k]} /></svg>;

export default function UserTop({ code, nom, user, on }: { code: string; nom: string; user: string; on: string }) {
  const b = `/e/${code}`;
  const items: [string, string, string][] = [
    ["tableau", "Tableau de bord", `${b}/tableau`],
    ["pesees", "Pesées", `${b}/pesees`],
    ["etats", "États", `${b}/etats`],
    ["stats", "Statistiques", `${b}/statistiques`],
    ["tiers", "Clients & tiers", `${b}/tiers`],
    ["donnees", "Toutes les données", `${b}/donnees`],
  ];
  return (
    <header className="top noprint">
      <Link href={`${b}/tableau`} className="brand">
        <img src="/softweight.svg" alt="" />
        <span>{nom}<small>SoftWEIGHT Online · {code}</small></span>
      </Link>
      <nav>{items.map(([k, l, h]) => <Link key={k} href={h} className={on === k ? "on" : ""}><Ico k={k} />{l}</Link>)}</nav>
      <div className="who">{user}<a className="btn sm ghost" style={{ color: "#fff", borderColor: "#4E7395" }} href={`${b}/logout`}>Déconnexion</a></div>
    </header>
  );
}
