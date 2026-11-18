import crypto from "node:crypto";
import nacl from "tweetnacl";

/* ---------- Encodage ---------- */
export const b64url = (b: Uint8Array | Buffer) => Buffer.from(b).toString("base64url");
export const fromB64 = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

function envKey(name: string, len = 32): Buffer {
  const v = process.env[name];
  if (!v) throw new Error(`${name} manquant`);
  const k = fromB64(v);
  if (k.length !== len) throw new Error(`${name} doit faire ${len} octets`);
  return k;
}

/* ---------- Chiffrement des clés secrètes des postes (AES-256-GCM) ---------- */
export function sealSecret(plain: Buffer): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", envKey("MASTER_KEY"), iv);
  const enc = Buffer.concat([c.update(plain), c.final()]);
  return ["v1", b64url(iv), b64url(c.getAuthTag()), b64url(enc)].join(".");
}
export function openSecret(sealed: string): Buffer {
  const [v, iv, tag, enc] = sealed.split(".");
  if (v !== "v1") throw new Error("format de clé inconnu");
  const d = crypto.createDecipheriv("aes-256-gcm", envKey("MASTER_KEY"), fromB64(iv));
  d.setAuthTag(fromB64(tag));
  return Buffer.concat([d.update(fromB64(enc)), d.final()]);
}

/* ---------- Code d'activation ----------
 * Format : "SWA1-" + base64url( clé publique éphémère X25519 (32) | nonce (24) | crypto_box(JSON) )
 * Seule la plateforme (clé privée ACTIVATION_SECRET_KEY) peut l'ouvrir.
 */
export type ActivationPayload = {
  v: number;
  site_id: string;
  secret: string; // base64, 32 octets
  cree_le: string; // ISO
  entreprise: {
    nom: string;
    telephone?: string;
    adresse?: string;
    ville?: string;
    pays?: string;
    email?: string;
  };
  magasin?: string;
  pont_numero?: string;
  pont_nom?: string;
  code_machine?: string;
  licence?: string;
  version_logiciel?: string;
  nb_pesees?: number;
  base?: string;
};

export function openActivationCode(code: string): ActivationPayload {
  const clean = code.replace(/\s+/g, "");
  if (!clean.startsWith("SWA1-")) throw new Error("Ce n'est pas un code d'activation SoftWEIGHT.");
  const raw = fromB64(clean.slice(5));
  if (raw.length < 32 + 24 + 16) throw new Error("Code incomplet : vérifiez qu'il a été copié en entier.");
  const epk = raw.subarray(0, 32);
  const nonce = raw.subarray(32, 56);
  const box = raw.subarray(56);
  const sk = envKey("ACTIVATION_SECRET_KEY");
  const out = nacl.box.open(new Uint8Array(box), new Uint8Array(nonce), new Uint8Array(epk), new Uint8Array(sk));
  if (!out) throw new Error("Code invalide ou modifié : impossible de le déchiffrer.");
  const p = JSON.parse(Buffer.from(out).toString("utf8")) as ActivationPayload;
  if (p.v !== 1 || !/^[0-9a-f-]{36}$/i.test(p.site_id) || !p.secret || !p.entreprise?.nom)
    throw new Error("Code incomplet.");
  if (fromB64(p.secret).length !== 32) throw new Error("Clé du poste invalide.");
  return p;
}

/** Pour les tests et l'outil de démonstration : fabrique un code comme le ferait le logiciel. */
export function makeActivationCode(p: ActivationPayload, platformPublicKey: Uint8Array): string {
  const eph = nacl.box.keyPair();
  const nonce = nacl.randomBytes(24);
  const box = nacl.box(new Uint8Array(Buffer.from(JSON.stringify(p), "utf8")), nonce, platformPublicKey, eph.secretKey);
  return "SWA1-" + b64url(Buffer.concat([eph.publicKey, nonce, box]));
}

/* ---------- Signature des requêtes du poste (HMAC-SHA256) ----------
 * chaîne signée = METHODE \n chemin \n horodatage(secondes) \n nonce \n sha256hex(corps)
 */
export function signRequest(secret: Buffer, method: string, path: string, ts: string, nonce: string, body: Buffer) {
  const h = crypto.createHash("sha256").update(body).digest("hex");
  const msg = `${method.toUpperCase()}\n${path}\n${ts}\n${nonce}\n${h}`;
  return crypto.createHmac("sha256", secret).update(msg).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  if (!/^[0-9a-f]+$/i.test(a) || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

/* ---------- Mots de passe ----------
 * Comptes web : scrypt.  Opérateurs synchronisés : PBKDF2-SHA256 calculé par le poste
 * (format "pbkdf2$sha256$<iterations>$<sel base64>$<hash base64>").
 */
export function hashPassword(pwd: string): string {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pwd.normalize("NFC"), salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$${b64url(salt)}$${b64url(h)}`;
}

export function verifyPassword(pwd: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const p = stored.split("$");
  try {
    if (p[0] === "scrypt" && p.length === 4) {
      const h = crypto.scryptSync(pwd.normalize("NFC"), fromB64(p[2]), 32, { N: Number(p[1]), r: 8, p: 1 });
      return crypto.timingSafeEqual(h, fromB64(p[3]));
    }
    if (p[0] === "pbkdf2" && p[1] === "sha256" && p.length === 5) {
      const it = Number(p[2]);
      if (!Number.isInteger(it) || it < 10000 || it > 2_000_000) return false;
      const ref = fromB64(p[4]);
      const h = crypto.pbkdf2Sync(Buffer.from(pwd, "utf8"), fromB64(p[3]), it, ref.length, "sha256");
      return crypto.timingSafeEqual(h, ref);
    }
  } catch {
    return false;
  }
  return false;
}

/* ---------- QR de vérification ----------
 * Jeton = base64url( site_id (16 octets) | n° de pesée (texte) ) + "." + 12 premiers octets
 * de HMAC-SHA256(secret du poste, "QR1|" + n° de pesée + "|" + poids net) en base64url.
 */
export function qrMac(secret: Buffer, numero: string, net: string): string {
  return b64url(crypto.createHmac("sha256", secret).update(`QR1|${numero}|${net}`).digest().subarray(0, 12));
}

export const randomToken = (n = 32) => b64url(crypto.randomBytes(n));
