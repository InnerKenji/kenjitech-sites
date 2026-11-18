import { NextRequest, NextResponse } from "next/server";
import zlib from "node:zlib";
import { sql, ready } from "./db";
import { openSecret, safeEqualHex, signRequest } from "./crypto";

export type SiteCtx = {
  siteId: string;
  secret: Buffer;
  exploitantId: number;
  schema: string;
  code: string;
  body: Buffer;
};

const FENETRE = 600; // secondes de décalage d'horloge tolérées
const MAX_DECOMPRESSE = 20_000_000; // un lot décompressé ne dépasse jamais 20 Mo (protection « bombe zip »)

export function err(status: number, code: string, extra: object = {}) {
  return NextResponse.json({ ok: false, erreur: code, heure_serveur: Math.floor(Date.now() / 1000), ...extra }, { status });
}

/**
 * Vérifie qu'une requête vient bien d'un poste activé :
 * signature HMAC valide, horodatage récent, nonce jamais vu, poste et exploitant actifs.
 * L'exploitant est TOUJOURS déduit du poste, jamais d'une donnée envoyée.
 */
export async function authSite(req: NextRequest): Promise<SiteCtx | NextResponse> {
  await ready();
  const siteId = req.headers.get("x-sw-site") ?? "";
  const ts = req.headers.get("x-sw-time") ?? "";
  const nonce = req.headers.get("x-sw-nonce") ?? "";
  const sig = req.headers.get("x-sw-signature") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(siteId) || !/^\d{9,11}$/.test(ts) || !/^[A-Za-z0-9_-]{16,64}$/.test(nonce) || !sig)
    return err(400, "entetes_invalides");

  const body = Buffer.from(await req.arrayBuffer());
  if (body.length > 4_500_000) return err(413, "lot_trop_gros");

  const [s] = await sql()`
    select s.id, s.secret_enc, s.statut, e.id as exp_id, e.schema_name, e.code, e.statut as exp_statut
    from plateforme.sites s join plateforme.exploitants e on e.id = s.exploitant_id
    where s.id = ${siteId}`;
  if (!s) return err(404, "poste_non_active");

  const secret = openSecret(s.secret_enc);
  const expected = signRequest(secret, req.method, new URL(req.url).pathname, ts, nonce, body);
  if (!safeEqualHex(sig, expected)) return err(401, "signature_invalide");
  if (Math.abs(Date.now() / 1000 - Number(ts)) > FENETRE) return err(401, "horloge_decalee");
  if (s.statut !== "actif") return err(403, "poste_revoque");
  if (s.exp_statut !== "actif") return err(403, "exploitant_suspendu");

  const ins = await sql()`insert into plateforme.nonces (site_id, nonce) values (${siteId}, ${nonce})
                         on conflict do nothing returning nonce`;
  if (ins.length === 0) return err(409, "requete_rejouee");
  if (Math.random() < 0.02) await sql()`delete from plateforme.nonces where ts < now() - interval '1 hour'`;

  // Corps compressé (zlib) par le poste pour les connexions lentes. La signature porte sur les octets
  // reçus, vérifiée AVANT toute décompression : un tiers ne peut rien faire décompresser au serveur.
  let corps: Buffer = body;
  if (req.headers.get("x-sw-zip") === "1" && body.length > 0) {
    try {
      corps = zlib.inflateSync(body, { maxOutputLength: MAX_DECOMPRESSE });
    } catch {
      return err(400, "compression_invalide");
    }
  }

  await sql()`update plateforme.sites set derniere_connexion = now() where id = ${siteId}`;
  return { siteId, secret, exploitantId: Number(s.exp_id), schema: s.schema_name, code: s.code, body: corps };
}

export function json<T>(ctx: SiteCtx): T {
  return JSON.parse(ctx.body.toString("utf8") || "{}") as T;
}
