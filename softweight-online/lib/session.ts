import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { fromB64 } from "./crypto";
import { sql, ready } from "./db";

export type Session =
  | { k: "admin"; uid: number; login: string }
  | { k: "user"; exp_id: number; code: string; uid: string; login: string; nom: string; role: "admin" | "lecture" };

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
  const [e] = await sql()`select statut from plateforme.exploitants where id = ${s.exp_id}`;
  return e?.statut === "actif" ? s : null;
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
