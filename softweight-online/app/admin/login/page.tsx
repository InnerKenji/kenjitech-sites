import { redirect } from "next/navigation";
import { sql, ready, audit } from "@/lib/db";
import { verifyPassword } from "@/lib/crypto";
import { openSession, tooManyAttempts, recordFailure, clearFailures, adminSession } from "@/lib/session";

export const dynamic = "force-dynamic";

async function login(fd: FormData) {
  "use server";
  await ready();
  const login = String(fd.get("login") ?? "").trim();
  const cle = `admin:${login.toLowerCase()}`;
  if (await tooManyAttempts(cle)) redirect("/admin/login?err=bloque");
  const [a] = await sql()`select id, login, pwd_hash, actif from plateforme.admins where lower(login) = lower(${login})`;
  if (!a || !a.actif || !verifyPassword(String(fd.get("pwd") ?? ""), a.pwd_hash)) {
    await recordFailure(cle);
    redirect("/admin/login?err=1");
  }
  await clearFailures(cle);
  await openSession({ k: "admin", uid: Number(a.id), login: a.login });
  await audit(`admin:${a.login}`, "connexion", null);
  redirect("/admin");
}

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ err?: string; ok?: string }> }) {
  await ready();
  const [{ n }] = await sql()`select count(*)::int as n from plateforme.admins`;
  if (n === 0) redirect("/admin/setup");
  if (await adminSession()) redirect("/admin");
  const sp = await searchParams;
  return (
    <div className="center">
      <div className="card wm login">
        <div className="head"><img src="/kenjitech-logo.png" alt="KENJITECH" /><h1 style={{ marginTop: 8 }}>Administration</h1></div>
        {sp.ok && <div className="alert ok">Compte créé. Connectez-vous.</div>}
        {sp.err === "1" && <div className="alert err">Identifiant ou mot de passe incorrect.</div>}
        {sp.err === "bloque" && <div className="alert err">Trop d&apos;essais. Réessayez dans 15 minutes.</div>}
        <form action={login}>
          <label>Identifiant</label><input name="login" required autoComplete="username" />
          <label>Mot de passe</label><input name="pwd" type="password" required autoComplete="current-password" />
          <div style={{ marginTop: 14 }}><button className="btn amber">Se connecter</button></div>
        </form>
      </div>
    </div>
  );
}
