import { redirect } from "next/navigation";
import { getExploitant } from "@/lib/tenant";
import { sql, audit } from "@/lib/db";
import { verifyPassword } from "@/lib/crypto";
import { openSession, tooManyAttempts, recordFailure, clearFailures, userSession, versionMdp } from "@/lib/session";

const LEURRE = "pbkdf2$sha256$100000$OaNaykUhQjYb5zRwV4n2uQ==$h6OmbzMsARlvtxuBrAv6fAbQThvIPi/d6y5crnvQ/sA=";
import { findOperator } from "@/lib/operateurs";
import Foot from "@/components/Foot";

export const dynamic = "force-dynamic";

async function login(fd: FormData) {
  "use server";
  const e = await getExploitant(String(fd.get("code")));
  if (!e) redirect("/?err=1");
  const login = String(fd.get("login") ?? "").trim();
  const pwd = String(fd.get("pwd") ?? "");
  const cle = `${e.code}:${login.toLowerCase()}`;
  if (await tooManyAttempts(cle)) redirect(`/e/${e.code}?err=bloque`);
  if (e.statut !== "actif") redirect(`/e/${e.code}?err=suspendu`);
  // 1) comptes web
  const [u] = await sql()`select id, login, nom, role, pwd_hash, actif from plateforme.web_users
                          where exploitant_id = ${e.id} and lower(login) = lower(${login})`;
  if (u && u.actif && verifyPassword(pwd, u.pwd_hash)) {
    await clearFailures(cle);
    await openSession({ k: "user", exp_id: e.id, code: e.code, uid: "w" + u.id, login: u.login, nom: u.nom || u.login, role: u.role, v: versionMdp(u.pwd_hash) });
    await audit(`web:${u.login}`, "connexion", e.id);
    redirect(`/e/${e.code}/tableau`);
  }
  // 2) opérateurs synchronisés depuis le poste (mêmes identifiants que sur le PC du pont-bascule)
  const op = await findOperator(e.schema, login);
  if (op && verifyPassword(pwd, op.hash)) {
    await clearFailures(cle);
    await openSession({ k: "user", exp_id: e.id, code: e.code, uid: "o" + op.key, login: op.login, nom: op.nom || op.login, role: op.admin ? "admin" : "lecture", v: versionMdp(op.hash) });
    await audit(`operateur:${op.login}`, "connexion", e.id);
    redirect(`/e/${e.code}/tableau`);
  }
  // même temps de réponse que le compte existe ou non (ne révèle pas les identifiants)
  if (!u && !op) verifyPassword(pwd, LEURRE);
  await recordFailure(cle);
  redirect(`/e/${e.code}?err=1`);
}

export default async function EspaceLogin({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ err?: string }> }) {
  const { code } = await params;
  const e = await getExploitant(code);
  if (!e) redirect("/?err=1");
  if (await userSession(e.code)) redirect(`/e/${e.code}/tableau`);
  const sp = await searchParams;
  return (
    <>
      <div className="center">
        <div className="card wm login">
          <div className="head">
            <img src="/softweight.svg" alt="SoftWEIGHT" />
            <h1 style={{ marginTop: 8, marginBottom: 2 }}>{e.nom}</h1>
            <p className="muted" style={{ margin: 0 }}>{[e.ville, e.pays].filter(Boolean).join(", ")}{e.telephone ? ` · ${e.telephone}` : ""}</p>
            <p className="small muted">Code entreprise : <b>{e.code}</b> · <a href="/">changer</a></p>
          </div>
          {sp.err === "1" && <div className="alert err">Identifiant ou mot de passe incorrect.</div>}
          {sp.err === "bloque" && <div className="alert err">Trop d&apos;essais. Réessayez dans 15 minutes.</div>}
          {sp.err === "suspendu" && <div className="alert err">Cet espace est suspendu. Contactez KENJITECH.</div>}
          <form action={login}>
            <input type="hidden" name="code" value={e.code} />
            <label>Identifiant</label><input name="login" required autoComplete="username" autoFocus />
            <label>Mot de passe</label><input name="pwd" type="password" required autoComplete="current-password" />
            <div style={{ marginTop: 14 }}><button className="btn amber" style={{ width: "100%", justifyContent: "center" }}>Se connecter</button></div>
          </form>
          <p className="small muted" style={{ marginTop: 12 }}>Utilisez les mêmes identifiants que sur le logiciel SoftWEIGHT du pont-bascule.</p>
        </div>
      </div>
      <Foot />
    </>
  );
}
