import Link from "next/link";

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
      <nav>{items.map(([k, l, h]) => <Link key={k} href={h} className={on === k ? "on" : ""}>{l}</Link>)}</nav>
      <div className="who">{user}<a className="btn sm ghost" style={{ color: "#fff", borderColor: "#4E7395" }} href={`${b}/logout`}>Déconnexion</a></div>
    </header>
  );
}
