import { sql } from "./db";
import { q } from "./mirror";
import { PROFIL } from "./profil";

export async function findOperator(schema: string, login: string) {
  const P = PROFIL.operateurs;
  try {
    const rows = await sql().unsafe(
      `select _site, _pk, ${q(P.login)} as login, ${q(P.nom)} as nom, ${q(P.role)} as role, ${q(P.hash)} as hash
       from ${q(schema)}.${q("m_" + P.table)} where not _deleted and lower(${q(P.login)}) = lower($1) limit 1`,
      [login]
    );
    const r = rows[0];
    if (!r || !r.hash) return null;
    const role = String(r.role ?? "").toLowerCase();
    return { key: `${r._site}:${r._pk}`, login: String(r.login), nom: String(r.nom ?? ""), hash: String(r.hash), admin: /admin|superviseur/.test(role) };
  } catch {
    return null; // table pas encore synchronisée
  }
}
