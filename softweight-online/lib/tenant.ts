import { redirect } from "next/navigation";
import { sql, ready } from "./db";
import { userSession } from "./session";

export type Exploitant = { id: number; code: string; nom: string; telephone: string; ville: string; adresse: string; pays: string; schema: string; statut: string };

export async function getExploitant(code: string): Promise<Exploitant | null> {
  await ready();
  const c = decodeURIComponent(code).toUpperCase();
  if (!/^[A-Z0-9-]{3,20}$/.test(c)) return null;
  const [e] = await sql()`select id, code, nom, telephone, ville, adresse, pays, schema_name, statut from plateforme.exploitants where code = ${c}`;
  if (!e) return null;
  return { id: Number(e.id), code: e.code, nom: e.nom, telephone: e.telephone, ville: e.ville, adresse: e.adresse, pays: e.pays, schema: e.schema_name, statut: e.statut };
}

/** Page protégée de l'espace exploitant : renvoie l'exploitant et la session, sinon redirige vers la connexion. */
export async function requireUser(code: string) {
  const e = await getExploitant(code);
  if (!e) redirect("/?err=1");
  const s = await userSession(e.code);
  if (!s || s.k !== "user" || s.exp_id !== e.id) redirect(`/e/${e.code}`);
  return { e, s };
}
