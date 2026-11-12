import Link from "next/link";

export default function AdminTop({ login, on }: { login: string; on: string }) {
  return (
    <header className="top">
      <Link href="/admin" className="brand">
        <img src="/softweight.svg" alt="" />
        <span>SoftWEIGHT Online<small>Super administration KENJITECH</small></span>
      </Link>
      <nav>
        <Link href="/admin" className={on === "dash" ? "on" : ""}>Exploitants</Link>
        <Link href="/admin/nouveau" className={on === "new" ? "on" : ""}>Activer un poste</Link>
        <Link href="/admin/journal" className={on === "log" ? "on" : ""}>Journal</Link>
      </nav>
      <div className="who">{login}<a className="btn sm ghost" style={{ color: "#fff", borderColor: "#4E7395" }} href="/admin/logout">Déconnexion</a></div>
    </header>
  );
}
