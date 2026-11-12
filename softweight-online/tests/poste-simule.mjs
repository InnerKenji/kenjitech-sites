// Simule un poste SoftWEIGHT : fabrique un code d'activation, puis envoie schéma et pesées signés.
// Usage : node tests/poste-simule.mjs code <fichier_etat>
//         node tests/poste-simule.mjs sync <fichier_etat> [url]
import nacl from "tweetnacl";
import crypto from "node:crypto";
import fs from "node:fs";

const [, , cmd, stateFile, base = "http://localhost:3100"] = process.argv;
const pub = Buffer.from(process.env.ACTIVATION_PUBLIC_KEY, "base64");

if (cmd === "code") {
  const st = { site_id: crypto.randomUUID(), secret: crypto.randomBytes(32).toString("base64") };
  fs.writeFileSync(stateFile, JSON.stringify(st));
  const p = {
    v: 1, site_id: st.site_id, secret: st.secret, cree_le: new Date().toISOString(),
    entreprise: { nom: "SOCIÉTÉ TEST CACAO", telephone: "+237 6 99 00 00 00", ville: "Douala", pays: "Cameroun" },
    magasin: "Magasin Bonabéri", pont_numero: "PB-01", pont_nom: "Pont 60 t", code_machine: "SW-ABCDE-12345",
    licence: "SW-2026-0099", version_logiciel: "3.6.0", nb_pesees: 3,
  };
  const eph = nacl.box.keyPair();
  const nonce = nacl.randomBytes(24);
  const box = nacl.box(Buffer.from(JSON.stringify(p)), nonce, new Uint8Array(pub), eph.secretKey);
  console.log("SWA1-" + Buffer.concat([eph.publicKey, nonce, box]).toString("base64url"));
} else {
  const st = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  const secret = Buffer.from(st.secret, "base64");
  async function call(path, obj) {
    const body = Buffer.from(JSON.stringify(obj));
    const ts = String(Math.floor(Date.now() / 1000));
    const nonce = crypto.randomBytes(16).toString("base64url");
    const h = crypto.createHash("sha256").update(body).digest("hex");
    const sig = crypto.createHmac("sha256", secret).update(`POST\n${path}\n${ts}\n${nonce}\n${h}`).digest("hex");
    const r = await fetch(base + path, {
      method: "POST", body,
      headers: { "content-type": "application/json", "x-sw-site": st.site_id, "x-sw-time": ts, "x-sw-nonce": nonce, "x-sw-signature": sig },
    });
    return [r.status, await r.json()];
  }
  const show = async (label, p) => console.log(label, JSON.stringify(await p));
  await show("bonjour", call("/api/sync/v1/bonjour", { file_attente: 5, version: "3.6.0" }));
  await show("schema", call("/api/sync/v1/schema", { tables: [
    { name: "pesee", primaryKey: ["id"], columns: [
      { name: "id", type: "int(11)" }, { name: "numero", type: "varchar(20)" }, { name: "immat", type: "varchar(20)" },
      { name: "poids1", type: "double" }, { name: "poids2", type: "double" }, { name: "net", type: "double" },
      { name: "date1", type: "datetime" }, { name: "date2", type: "datetime" }, { name: "statut", type: "tinyint(1)" }] },
    { name: "operateur", primaryKey: ["id"], columns: [
      { name: "id", type: "int" }, { name: "login", type: "varchar(30)" }, { name: "nom", type: "varchar(50)" },
      { name: "profil", type: "varchar(20)" }, { name: "sw_mdp_empreinte", type: "varchar(200)" }] },
  ] }));
  const salt = crypto.randomBytes(16);
  const emp = `pbkdf2$sha256$100000$${salt.toString("base64")}$${crypto.pbkdf2Sync("motdepasse1", salt, 100000, 32, "sha256").toString("base64")}`;
  const changes = [
    { seq: 1, table: "pesee", op: "upsert", pk: { id: 1 }, row: { id: 1, numero: "T0001", immat: "LT 123 AB", poids1: 38420, date1: "2026-11-12 08:10:00", statut: 0 } },
    { seq: 2, table: "pesee", op: "upsert", pk: { id: 2 }, row: { id: 2, numero: "T0002", immat: "CE 456 XY", poids1: 41200, poids2: 14100, net: 27100, date1: "2026-11-12 08:30:00", date2: "2026-11-12 09:05:00", statut: 1 } },
    { seq: 3, table: "pesee", op: "upsert", pk: { id: 3 }, row: { id: 3, numero: "T0003", immat: "OU 777 ZZ", poids1: 12000, date1: "0000-00-00 00:00:00", statut: 0 } },
    { seq: 4, table: "pesee", op: "upsert", pk: { id: 1 }, row: { id: 1, numero: "T0001", immat: "LT 123 AB", poids1: 38420, poids2: 13980, net: 24440, date1: "2026-11-12 08:10:00", date2: "2026-11-12 10:00:00", statut: 1 } },
    { seq: 5, table: "pesee", op: "delete", pk: { id: 3 }, row: { id: 3, numero: "T0003", immat: "OU 777 ZZ", poids1: 12000, statut: 0 } },
    { seq: 6, table: "operateur", op: "upsert", pk: { id: 1 }, row: { id: 1, login: "jean", nom: "Jean Opérateur", profil: "Superviseur", sw_mdp_empreinte: emp } },
  ];
  await show("envoi", call("/api/sync/v1/envoi", { gen: 0, changes, file_attente: 6 }));
  await show("renvoi ancien (ne doit rien écraser)", call("/api/sync/v1/envoi", { gen: 0, changes: [changes[0]] }));
  await show("table inconnue", call("/api/sync/v1/envoi", { gen: 0, changes: [{ seq: 7, table: "inconnue", op: "upsert", pk: { id: 1 }, row: { id: 1 } }] }));
  await show("controle", call("/api/sync/v1/controle", { controles: [{ table: "pesee", colonne_date: "date1", colonne_somme: "net",
    periodes: [{ periode: "2026-11", nb: 2, somme: 51540 }, { periode: "2026-10", nb: 4 }] }] }));
  const r = await fetch(base + "/api/sync/v1/bonjour", { method: "POST", body: "{}", headers: {
    "x-sw-site": st.site_id, "x-sw-time": String(Math.floor(Date.now() / 1000)), "x-sw-nonce": "aaaaaaaaaaaaaaaaaaaa", "x-sw-signature": "00" } });
  console.log("fausse signature ->", r.status);
}
