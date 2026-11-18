import crypto from "node:crypto";
import { sql, audit } from "./db";
import { ActivationPayload, fromB64, hashPassword, openActivationCode, sealSecret } from "./crypto";
import { ensureSchema, schemaFor } from "./mirror";

const VALIDITE_H = 48;

export function readCode(code: string): ActivationPayload {
  const p = openActivationCode(code);
  const t = Date.parse(p.cree_le);
  if (!Number.isFinite(t)) throw new Error("Date du code illisible.");
  if (Date.now() - t > VALIDITE_H * 3600_000) throw new Error(`Code expiré (plus de ${VALIDITE_H} h). Générez-en un nouveau sur le poste.`);
  if (t - Date.now() > 24 * 3600_000) throw new Error("La date du poste est dans le futur : corrigez l'horloge du PC puis régénérez le code.");
  return p;
}

async function newCode(): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const c = "KT-" + crypto.randomInt(1000, 10000);
    const [x] = await sql()`select 1 from plateforme.exploitants where code = ${c}`;
    if (!x) return c;
  }
  throw new Error("Impossible de générer un code entreprise libre.");
}

function randomPassword() {
  const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 12; i++) s += alpha[crypto.randomInt(alpha.length)];
  return s;
}

/**
 * Active un poste :
 *  - nouvel exploitant (exploitantId = null) : crée l'exploitant, son schéma séparé, son compte admin web ;
 *  - exploitant existant : ajoute le poste comme nouveau site de cet exploitant.
 * Le même code ne peut servir qu'une fois (identifiant du poste unique).
 */
export async function activate(code: string, exploitantId: number | null, admin: string, codeEntreprise?: string) {
  const p = readCode(code);
  const [dup] = await sql()`select exploitant_id from plateforme.sites where id = ${p.site_id}`;
  if (dup) throw new Error("Ce poste est déjà activé. Pour le réactiver, révoquez-le puis générez un nouveau code sur le poste.");
  const secretEnc = sealSecret(fromB64(p.secret));
  const e = p.entreprise;
  let adminPwd: string | null = null;

  const res = await sql().begin(async (t) => {
    let expId = exploitantId;
    let expCode: string;
    let schema: string;
    if (expId == null) {
      expCode = codeEntreprise ? codeEntreprise.trim().toUpperCase() : await newCode();
      if (!/^[A-Z0-9-]{3,20}$/.test(expCode)) throw new Error("Code entreprise invalide (lettres, chiffres et tirets).");
      const [taken] = await t`select 1 from plateforme.exploitants where code = ${expCode}`;
      if (taken) throw new Error("Ce code entreprise est déjà utilisé.");
      schema = schemaFor(expCode);
      const [row] = await t`insert into plateforme.exploitants (code, schema_name, nom, telephone, adresse, ville, pays, email)
        values (${expCode}, ${schema}, ${e.nom}, ${e.telephone ?? ""}, ${e.adresse ?? ""}, ${e.ville ?? ""}, ${e.pays ?? ""}, ${e.email ?? ""})
        returning id`;
      expId = Number(row.id);
      await ensureSchema(t, schema);
      adminPwd = randomPassword();
      await t`insert into plateforme.web_users (exploitant_id, login, nom, role, pwd_hash)
              values (${expId}, 'admin', 'Administrateur', 'admin', ${hashPassword(adminPwd)})`;
    } else {
      const [ex] = await t`select code, schema_name from plateforme.exploitants where id = ${expId}`;
      if (!ex) throw new Error("Exploitant introuvable.");
      expCode = ex.code;
      schema = ex.schema_name;
      await ensureSchema(t, schema);
    }
    await t`insert into plateforme.sites (id, exploitant_id, magasin, pont_numero, pont_nom, code_machine, licence, version_logiciel, secret_enc, infos)
      values (${p.site_id}, ${expId}, ${p.magasin ?? ""}, ${p.pont_numero ?? ""}, ${p.pont_nom ?? ""}, ${p.code_machine ?? ""},
              ${p.licence ?? ""}, ${p.version_logiciel ?? ""}, ${secretEnc},
              ${t.json({ entreprise: e, nb_pesees: p.nb_pesees ?? null, base: p.base ?? null, code_cree_le: p.cree_le } as never)})`;
    return { expId, expCode, schema };
  });
  await audit(`admin:${admin}`, exploitantId == null ? "creation_exploitant" : "ajout_site", res.expId, {
    site: p.site_id,
    entreprise: e.nom,
    magasin: p.magasin,
    pont: p.pont_numero,
  });
  return { ...res, adminPwd, payload: p };
}
