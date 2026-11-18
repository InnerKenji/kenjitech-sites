import { redirect } from "next/navigation";
import { adminSession } from "@/lib/session";
import { sql } from "@/lib/db";
import AdminTop from "@/components/AdminTop";
import { dt } from "@/lib/fmt";

export const dynamic = "force-dynamic";

export default async function Journal() {
  const s = await adminSession();
  if (!s || s.k !== "admin") redirect("/admin/login");
  const rows = await sql()`select a.ts, a.acteur, a.action, a.detail, e.code from plateforme.audit a
    left join plateforme.exploitants e on e.id = a.exploitant_id order by a.ts desc limit 300`;
  return (
    <>
      <AdminTop login={s.login} on="log" />
      <main className="wrap"><h1>Journal</h1><div className="card scroll"><table className="t">
        <thead><tr><th>Date</th><th>Exploitant</th><th>Acteur</th><th>Action</th><th>Détail</th></tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}><td>{dt(r.ts)}</td><td>{r.code ?? ""}</td><td>{r.acteur}</td><td>{r.action}</td><td className="small muted">{JSON.stringify(r.detail)}</td></tr>)}</tbody>
      </table></div></main>
    </>
  );
}
