// Simule un poste avec la vraie structure de la base softweightbd et des pesées réalistes.
// Usage : node tests/poste-reel.mjs <fichier_etat> [url] [nb_pesees]
import crypto from "node:crypto";
import fs from "node:fs";

const [, , stateFile, base = "http://localhost:3100", nbArg = "400"] = process.argv;
const st = JSON.parse(fs.readFileSync(stateFile, "utf8"));
const secret = Buffer.from(st.secret, "base64");

async function call(path, obj) {
  const body = Buffer.from(JSON.stringify(obj));
  const ts = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomBytes(16).toString("base64url");
  const h = crypto.createHash("sha256").update(body).digest("hex");
  const sig = crypto.createHmac("sha256", secret).update(`POST\n${path}\n${ts}\n${nonce}\n${h}`).digest("hex");
  const r = await fetch(base + path, { method: "POST", body, headers: { "content-type": "application/json", "x-sw-site": st.site_id, "x-sw-time": ts, "x-sw-nonce": nonce, "x-sw-signature": sig } });
  return [r.status, await r.json()];
}

const c = (name, type) => ({ name, type });
const PESEE_COLS = [c("code_pesee", "bigint(20)"), c("num_bl", "longtext"), c("nom_client", "text"), c("produit", "longtext"), c("id_operateur_1", "char(32)"),
  c("id_operateur_2", "char(32)"), c("num_imma", "char(32)"), c("date_1", "char(16)"), c("date_2", "char(16)"), c("heure_1", "char(16)"), c("heure_2", "char(16)"),
  c("poids_1", "int(11)"), c("poids_2", "int(11)"), c("poids_net", "int(11)"), c("pont_1", "int(11)"), c("pont_2", "int(11)"), c("provenance", "text"),
  c("nom_magasin", "char(32)"), c("chauffeur", "char(64)"), c("observation", "text"), c("mouvement", "char(32)"), c("code_fournisseur", "text"),
  c("destination", "text"), c("poids_declare", "int(11)"), c("ecart", "int(11)"), c("transporteur", "text"), c("campagne", "char(20)"),
  c("conteneur", "char(50)"), c("plomb", "char(50)"), c("remorque", "char(50)"), c("state", "int(11)")];
const tables = [
  { name: "client", primaryKey: ["id_client"], columns: [c("id_client", "char(32)"), c("nom_client", "char(64)"), c("adresse", "char(32)"), c("tel", "char(32)"), c("email", "char(32)"), c("type", "char(32)")] },
  { name: "produit", primaryKey: ["code_produit"], columns: [c("code_produit", "char(32)"), c("nom_produit", "char(80)"), c("description", "char(100)")] },
  { name: "fournisseur", primaryKey: ["code_fournisseur"], columns: [c("code_fournisseur", "char(32)"), c("nom_fournisseur", "char(64)"), c("Adresse", "char(64)"), c("Tel", "char(32)"), c("email", "char(64)"), c("type", "char(64)")] },
  { name: "operateur", primaryKey: ["nom"], columns: [c("id_operateur", "char(32)"), c("nom", "char(100)"), c("etat", "int(11)"), c("poste", "char(64)"), c("sw_mdp_empreinte", "text")] },
  { name: "magasin", primaryKey: ["nom_magasin"], columns: [c("nom_magasin", "char(32)"), c("rs", "char(32)"), c("adresse", "char(32)"), c("campagne", "char(16)"), c("etat", "int(11)")] },
  { name: "pesee_2025_2026", primaryKey: ["code_pesee"], columns: [...PESEE_COLS, c("idpe", "int(11)")] },
  { name: "pesee_2026_2027", primaryKey: ["code_pesee"], columns: PESEE_COLS },
];
console.log("schema", JSON.stringify(await call("/api/sync/v1/schema", { tables })));

const clients = [["C001", "SOCACAO SARL"], ["C002", "AGRO EXPORT CMR"], ["C003", "TELCAM NEGOCE"], ["C004", "ETS MBARGA"], ["C005", "OLAM CAM"]];
const produits = [["P01", "CACAO FEVES"], ["P02", "CAFE ROBUSTA"], ["P03", "MAIS GRAIN"], ["P04", "CIMENT"]];
const transp = [["T01", "TRANSCAM"], ["T02", "GLOBAL LOGISTICS"], ["T03", "EXPRESS UNION FRET"]];
const immats = ["LT 123 AB", "CE 456 XY", "OU 777 ZZ", "LT 908 KK", "CE 221 AA", "NW 345 BC", "LT 555 PP", "SW 101 QQ"];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const pad = (n) => String(n).padStart(2, "0");
let seq = Number(st.seq ?? 100);
const ch = [];
const salt = crypto.randomBytes(16);
const emp = `pbkdf2$sha256$100000$${salt.toString("base64")}$${crypto.pbkdf2Sync("1234abcd", salt, 100000, 32, "sha256").toString("base64")}`;
for (const [k, n] of clients) ch.push({ seq: ++seq, table: "client", op: "upsert", pk: { id_client: k }, row: { id_client: k, nom_client: n, adresse: "Douala", tel: "+237 6 " + crypto.randomInt(10000000, 99999999), type: "Externe" } });
for (const [k, n] of produits) ch.push({ seq: ++seq, table: "produit", op: "upsert", pk: { code_produit: k }, row: { code_produit: k, nom_produit: n } });
for (const [k, n] of transp) ch.push({ seq: ++seq, table: "fournisseur", op: "upsert", pk: { code_fournisseur: k }, row: { code_fournisseur: k, nom_fournisseur: n, Adresse: "Douala", type: "Externe" } });
ch.push({ seq: ++seq, table: "operateur", op: "upsert", pk: { nom: "PAUL" }, row: { id_operateur: "op001", nom: "PAUL", etat: 1, poste: "Superviseur", sw_mdp_empreinte: emp } });
ch.push({ seq: ++seq, table: "magasin", op: "upsert", pk: { nom_magasin: "BONABERI" }, row: { nom_magasin: "BONABERI", rs: "SOCIETE TEST CACAO", adresse: "Douala", campagne: "2026_2027", etat: 1 } });
const N = Number(nbArg);
const now = Date.now();
for (let i = 0; i < N; i++) {
  const d = new Date(now - Math.random() * 45 * 86400_000);
  const d2 = new Date(d.getTime() + (10 + Math.random() * 90) * 60_000);
  const date = (x) => `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()}`;
  const heure = (x) => `${pad(x.getHours())}:${pad(x.getMinutes())}:${pad(x.getSeconds())}`;
  const p1 = 30000 + crypto.randomInt(0, 25000), p2 = 11000 + crypto.randomInt(0, 4000);
  const attente = i < 6;
  const cl = pick(clients), pr = pick(produits), tr = pick(transp);
  const code = String(i + 1) + `${pad(d.getDate())}${pad(d.getMonth() + 1)}${String(d.getFullYear()).slice(2)}`;
  const tbl = d.getMonth() >= 9 ? "pesee_2026_2027" : "pesee_2025_2026";
  const supp = i % 97 === 50;
  ch.push({ seq: ++seq, table: tbl, op: "upsert", pk: { code_pesee: code }, row: {
    code_pesee: code, num_bl: "BL" + crypto.randomInt(1000, 9999), nom_client: `${cl[0]}   ${cl[1]}`, produit: `${pr[0]}    ${pr[1]}`,
    id_operateur_1: "PAUL", id_operateur_2: attente ? null : "PAUL", num_imma: pick(immats), date_1: date(d), heure_1: heure(d),
    date_2: attente ? null : date(d2), heure_2: attente ? null : heure(d2), poids_1: p1, poids_2: attente ? null : p2, poids_net: attente ? null : p1 - p2,
    pont_1: 1, pont_2: attente ? null : 1, provenance: "AFANEYO", nom_magasin: supp ? "BONABERIdel" : "BONABERI", chauffeur: "Chauffeur " + (i % 12),
    observation: "", mouvement: i % 3 ? "ENTREE" : "SORTIE", code_fournisseur: `${tr[0]}    ${tr[1]}`, destination: "PORT DE DOUALA",
    transporteur: `${tr[0]}    ${tr[1]}`, campagne: tbl.slice(6), state: i % 17 === 0 ? 3 : null } });
}
for (let i = 0; i < ch.length; i += 500) {
  const r = await call("/api/sync/v1/envoi", { gen: 1, changes: ch.slice(i, i + 500), file_attente: ch.length - i });
  console.log("envoi", i, r[0], r[1].acquittes?.length, r[1].tables_inconnues);
}
st.seq = seq;
fs.writeFileSync(stateFile, JSON.stringify(st));
console.log("controle", JSON.stringify(await call("/api/sync/v1/controle", { controles: [{ table: "pesee_2026_2027", colonne_somme: "poids_net", periodes: [{ periode: "total", nb: 1, somme: 1 }] }] })));
