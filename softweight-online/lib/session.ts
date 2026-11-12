import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { fromB64 } from "./crypto";
import { sql, ready } from "./db";
import { findOperator } from "./operateurs";

export type Session =
  | { k: "admin"; uid: number; login: string }
  | { k: "user"; exp_id: number; code: string; uid: string; login: string; nom: string; role: "admin" | "lecture"; v: string };

/** Empreinte courte du mot de passe stocké : si le mot de passe change (sur le poste ou sur le web),
    ou si le compte est supprimé, les sessions ouvertes avec l'ancien mot de passe sont refusées. */
export function versionMdp(hash: string) {
  return crypto.createHash("sha256").update("SWV|" + hash).digest("base64url").slice(0, 16);
}

const COOKIE_ADMIN = "sw_admin";
const COOKIE_USER = "sw_user";
const DUREE = 60 * 60 * 10; // 10 h

function key() {
  const v = process.env.SESSION_SECRET;
  if (!v) throw new Error("SESSION_SECRET manquant");
  return new Uint8Array(fromB64(v));
}

export async function openSession(s: Session) {
  const jwt = await new SignJWT(s as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DUREE}s`)
    .sign(key());
  const c = await cookies();
  c.set(s.k === "admin" ? COOKIE_ADMIN : COOKIE_USER, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DUREE,
  });
}

export async function closeSession(k: "admin" | "user") {
  (await cookies()).delete(k === "admin" ? COOKIE_ADMIN : COOKIE_USER);
}

async function read(name: string): Promise<Session | null> {
  const v = (await cookies()).get(name)?.value;
  if (!v) return null;
  try {
    const { payload } = await jwtVerify(v, key(), { algorithms: ["HS256"] });
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

export async function adminSession() {
  const s = await read(COOKIE_ADMIN);
  if (!s || s.k !== "admin") return null;
  await ready();
  const [a] = await sql()`select actif from plateforme.admins where id = ${s.uid}`;
  return a?.actif ? s : null;
}

/** Session d'un utilisateur de l'exploitant `code`. Vérifie à chaque fois que l'exploitant est actif. */
export async function userSession(code: string) {
  const s = await read(COOKIE_USER);
  if (!s || s.k !== "user" || s.code !== code.toUpperCase()) return null;
  await ready();
  const [e] = await sql()`select statut, schema_name from plateforme.exploitants where id = ${s.exp_id}`;
  if (e?.statut !== "actif" || !s.v) return null;
  // le compte existe toujours, est actif, et son mot de passe n'a pas changé depuis la connexion
  if (s.uid.startsWith("w")) {
    const [u] = await sql()`select pwd_hash, actif from plateforme.web_users where id = ${Number(s.uid.slice(1)) || 0} and exploitant_id = ${s.exp_id}`;
    return u?.actif && versionMdp(u.pwd_hash) === s.v ? s : null;
  }
  const op = await findOperator(e.schema_name, s.login);
  return op && versionMdp(op.hash) === s.v ? s : null;
}

/* ---------- Limitation des essais de connexion ---------- */
export async function tooManyAttempts(cle: string): Promise<boolean> {
  const [r] = await sql()`select bloque_jusqua from plateforme.login_echecs where cle = ${cle}`;
  return !!r?.bloque_jusqua && new Date(r.bloque_jusqua) > new Date();
}
export async function recordFailure(cle: string) {
  await sql()`insert into plateforme.login_echecs (cle, echecs, maj) values (${cle}, 1, now())
    on conflict (cle) do update set
      echecs = case when plateforme.login_echecs.maj < now() - interval '30 minutes' then 1 else plateforme.login_echecs.echecs + 1 end,
      maj = now(),
      bloque_jusqua = case when plateforme.login_echecs.echecs + 1 >= 5 then now() + interval '15 minutes' else null end`;
}
export async function clearFailures(cle: string) {
  await sql()`delete from plateforme.login_echecs where cle = ${cle}`;
}
