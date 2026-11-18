import crypto from "node:crypto";
import QRCode from "qrcode";
import { sql } from "./db";
import { b64url, fromB64, openSecret } from "./crypto";

/*
 * Jeton du QR code (identique à SwSync::contenuQr côté logiciel) :
 *   <uuid du poste, 16 octets> . <table pesee_xxx> . <code_pesee> . <12 octets HMAC-SHA256(secret, "QR1|table|code|net")>
 * chaque partie en base64url sans "=". Lien : https://softweight.kenjitech.org/v/<jeton>
 */
export const BASE_URL = process.env.PUBLIC_URL || "https://softweight.kenjitech.org";

function uuidBytes(u: string) {
  return Buffer.from(u.replace(/-/g, ""), "hex");
}
function uuidFromBytes(b: Buffer) {
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
export function netTexte(v: unknown): string {
  const n = Math.trunc(Number(v ?? 0));
  return Number.isFinite(n) ? String(n) : "0";
}
function mac(secret: Buffer, table: string, code: string, net: string) {
  return crypto.createHmac("sha256", secret).update(`QR1|${table}|${code.trim()}|${net}`).digest().subarray(0, 12);
}

async function secretDuSite(site: string): Promise<Buffer | null> {
  const [s] = await sql()`select secret_enc from plateforme.sites where id = ${site}`;
  return s ? openSecret(s.secret_enc) : null;
}

export async function jeton(site: string, table: string, code: string, net: unknown): Promise<string | null> {
  const secret = await secretDuSite(site);
  if (!secret) return null;
  return [b64url(uuidBytes(site)), b64url(Buffer.from(table)), b64url(Buffer.from(code.trim())), b64url(mac(secret, table, code, netTexte(net)))].join(".");
}

export async function qrSvg(texte: string): Promise<string> {
  return QRCode.toString(texte, { type: "svg", errorCorrectionLevel: "M", margin: 0, color: { dark: "#012A4C", light: "#FFFFFF" } });
}

export type Decode = { site: string; table: string; code: string; mac: Buffer };
export function decoderJeton(j: string): Decode | null {
  const p = j.split(".");
  if (p.length !== 4) return null;
  try {
    const u = fromB64(p[0]);
    if (u.length !== 16) return null;
    const table = fromB64(p[1]).toString("utf8");
    const code = fromB64(p[2]).toString("utf8");
    if (!/^pesee_[A-Za-z0-9_]{1,50}$/.test(table) || !/^[0-9A-Za-z_-]{1,40}$/.test(code)) return null;
    return { site: uuidFromBytes(u), table, code, mac: fromB64(p[3]) };
  } catch {
    return null;
  }
}

export async function verifierMac(d: Decode, net: unknown): Promise<boolean> {
  const secret = await secretDuSite(d.site);
  if (!secret || d.mac.length !== 12) return false;
  return crypto.timingSafeEqual(mac(secret, d.table, d.code, netTexte(net)), d.mac);
}
