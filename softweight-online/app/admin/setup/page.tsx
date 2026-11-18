import { redirect } from "next/navigation";
import crypto from "node:crypto";
import { sql, ready, audit } from "@/lib/db";
import { hashPassword } from "@/lib/crypto";

export const dynamic = "force-dynamic";

async function setup(fd: FormData) {
  "use server";
  await ready();
  const [{ n }] = await sql()`select count(*)::int as n from plateforme.admins`;
  if (n > 0) redirect("/admin/login");
  const tok = String(fd.get("token") ?? "");
  const expected = process.env.SETUP_TOKEN ?? "";
  if (!expected || tok.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(tok), Buffer.from(expected)))
    redirect("/admin/setup?err=jeton");
  const login = String(fd.get("login") ?? "").trim();
  const pwd = String(fd.get("pwd") ?? "");
  if (!/^[A-Za-z0-9._@-]{3,40}$/.test(login) || pwd.length < 10 || pwd !== String(fd.get("pwd2") ?? ""))
    redirect("/admin/setup?err=champs");
  await sql()`insert into plateforme.admins (login, nom, pwd_hash) values (${login}, ${String(fd.get("nom") ?? "")}, ${hashPassword(pwd)})`;
  await audit(`admin:${login}`, "creation_super_admin", null);
  redirect("/admin/login?ok=1");
}

export default async function Setup({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  await ready();
  const [{ n }] = await sql()`select count(*)::int as n from plateforme.admins`;
  if (n > 0) redirect("/admin/login");
  const sp = await searchParams;
  return (
    <div className="center">
      <div className="card login">
        <h1>Premier compte super admin</h1>
        {sp.err === "jeton" && <div className="alert err">Jeton d&apos;installation incorrect.</div>}
        {sp.err === "champs" && <div className="alert err">Identifiant invalide, ou mot de passe trop court (10 caractères minimum) ou différent.</div>}
        <form action={setup}>
          <label>Jeton d&apos;installation</label><input name="token" type="password" required />
          <label>Nom</label><input name="nom" defaultValue="Ken" />
          <label>Identifiant</label><input name="login" required autoComplete="username" />
          <label>Mot de passe (10 caractères minimum)</label><input name="pwd" type="password" required autoComplete="new-password" />
          <label>Confirmer</label><input name="pwd2" type="password" required autoComplete="new-password" />
          <div style={{ marginTop: 14 }}><button className="btn amber">Créer le compte</button></div>
        </form>
      </div>
    </div>
  );
}
