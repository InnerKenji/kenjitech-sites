import { sql, ready } from "@/lib/db";
import { decoderJeton, verifierMac, qrSvg, BASE_URL } from "@/lib/qr";
import { unePesee } from "@/lib/pesees";
import type { Exploitant } from "@/lib/tenant";
import Ticket from "@/components/Ticket";
import Foot from "@/components/Foot";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vérification de pesée · SoftWEIGHT Online", robots: { index: false } };

function Bandeau({ ok, titre, texte }: { ok: boolean; titre: string; texte: string }) {
  return (
    <div className="card" style={{ borderLeft: `8px solid ${ok ? "var(--green)" : "var(--red)"}`, display: "flex", gap: 16, alignItems: "center" }}>
      <div style={{ fontSize: 44, lineHeight: 1, color: ok ? "var(--green)" : "var(--red)" }}>{ok ? "✔" : "✖"}</div>
      <div>
        <h1 style={{ margin: 0, color: ok ? "var(--green)" : "var(--red)" }}>{titre}</h1>
        <p style={{ margin: "4px 0 0" }} className="muted">{texte}</p>
      </div>
    </div>
  );
}

export default async function Verif({ params }: { params: Promise<{ jeton: string }> }) {
  await ready();
  const { jeton } = await params;
  const d = decoderJeton(decodeURIComponent(jeton));
  let contenu: React.ReactNode = null;
  let ok = false;
  let titre = "Pesée non authentifiée ou pas encore synchronisée";
  let texte = "Cette pesée n'a pas été trouvée sur la plateforme SoftWEIGHT Online. Si elle vient d'être faite, le poste ne l'a peut-être pas encore envoyée : réessayez plus tard.";
  if (d) {
    const [s] = await sql()`select e.id, e.code, e.nom, e.telephone, e.ville, e.adresse, e.pays, e.schema_name, e.statut
      from plateforme.sites s join plateforme.exploitants e on e.id = s.exploitant_id where s.id = ${d.site}`;
    if (s) {
      const e: Exploitant = { id: Number(s.id), code: s.code, nom: s.nom, telephone: s.telephone, ville: s.ville, adresse: s.adresse, pays: s.pays, schema: s.schema_name, statut: s.statut };
      const p = await unePesee(e.schema, d.table, d.code, d.site);
      if (p) {
        if (await verifierMac(d, p.poids_net)) {
          if (p.statut === "supprimee") {
            titre = "Pesée annulée";
            texte = "Cette pesée existe mais a été supprimée sur le poste de pesage. Le ticket n'est plus valable.";
          } else {
            ok = true;
            titre = "Pesée authentifiée";
            texte = `Ce ticket correspond exactement à une pesée enregistrée par ${e.nom} et synchronisée sur SoftWEIGHT Online.`;
          }
          const qr = await qrSvg(`${BASE_URL}/v/${jeton}`);
          const imprimeLe = new Date().toLocaleString("fr-FR", { timeZone: "Africa/Douala", dateStyle: "short", timeStyle: "medium" });
          contenu = <Ticket p={p} e={e} qr={qr} format="ticket" imprimeLe={imprimeLe} />;
        } else {
          titre = "Pesée non authentifiée";
          texte = "Les informations de ce ticket ne correspondent pas à la pesée enregistrée (poids modifié ou ticket falsifié).";
        }
      }
    }
  } else {
    texte = "Ce QR code n'est pas un code de vérification SoftWEIGHT valide.";
  }
  return (
    <>
      <header className="top">
        <span className="brand"><img src="/softweight.svg" alt="" /><span>SoftWEIGHT Online<small>Vérification de pesée</small></span></span>
      </header>
      <main className="wrap" style={{ maxWidth: 1060 }}>
        <Bandeau ok={ok} titre={titre} texte={texte} />
        {contenu}
      </main>
      <Foot />
    </>
  );
}
