import type { Pesee } from "@/lib/pesees";
import type { Exploitant } from "@/lib/tenant";
import { kg } from "@/lib/fmt";

/* Reproduit les tickets du logiciel : « ticket » (compact) et « bon » (bon de pesée A4). */

const manuel1 = (s: unknown) => s === 1 || s === 3 || s === "1" || s === "3";
const manuel2 = (s: unknown) => s === 2 || s === 3 || s === "2" || s === "3";

export default function Ticket({ p, e, qr, format, duplicata, imprimeLe }: {
  p: Pesee; e: Exploitant; qr: string | null; format: "ticket" | "bon"; duplicata?: boolean; imprimeLe: string;
}) {
  const complete = p.poids_2 !== null && p.poids_2 !== undefined;
  const brut = complete ? Math.max(Number(p.poids_1), Number(p.poids_2)) : Number(p.poids_1);
  const tare = complete ? Math.min(Number(p.poids_1), Number(p.poids_2)) : null;
  const titre = complete ? "TICKET DE PESÉE" : "TICKET DE PREMIÈRE PESÉE";
  const head = (
    <div className="tk-head">
      <div className="tk-logo"><img src="/softweight.svg" alt="" /></div>
      <div className="tk-ent">
        <div className="tk-nom">{e.nom}</div>
        <div className="tk-adr">
          {[e.adresse || e.ville, e.telephone && `Tél : ${e.telephone}`].filter(Boolean).join("  ·  ")}
        </div>
      </div>
      <div className="tk-mvt">{duplicata ? "DUPLICATA" : (p.mouvement || "").toString().toUpperCase()}</div>
    </div>
  );
  const pied = (
    <div className="tk-pied">
      <span>Imprimé le {imprimeLe} depuis SoftWEIGHT Online</span>
      <b>SoftWEIGHT · KENJITECH</b>
    </div>
  );
  const qrBloc = qr ? (
    <div className="tk-qr">
      <div dangerouslySetInnerHTML={{ __html: qr }} />
      <small>Scannez pour vérifier</small>
    </div>
  ) : null;

  if (format === "ticket") {
    const L = ({ a, b, c, d, hl }: { a: string; b: React.ReactNode; c: string; d: React.ReactNode; hl?: boolean }) => (
      <tr><th>{a}</th><td>{b}</td><th className={hl ? "hl" : ""}>{c}</th><td className={hl ? "hl" : ""}>{d}</td></tr>
    );
    return (
      <div className="ticket">
        {head}
        <div className="tk-bar" />
        <h2 className="tk-titre center-t">{titre} N° {p.code_pesee}</h2>
        <div className="tk-grid">
          <table className="tk-t">
            <tbody>
              <L a="Immatriculation" b={p.num_imma} c="Poids brut" d={<>{kg(brut)} kg {manuel1(p.state) && <em>MANUELLE</em>}</>} />
              <L a="Produit" b={p.produit_nom} c="Poids tare" d={tare !== null ? <>{kg(tare)} kg {manuel2(p.state) && <em>MANUELLE</em>}</> : "-"} />
              <L a="Détails" b={p.observation} c="Poids net" d={complete ? <b className="big">{kg(p.poids_net)} kg</b> : "-"} hl />
              <L a="Provenance" b={p.provenance} c="Date d'entrée" d={`${p.date_1 ?? ""} à ${p.heure_1 ?? ""}`} />
              <L a="Client" b={p.client_nom} c="Date de sortie" d={complete ? `${p.date_2 ?? ""} à ${p.heure_2 ?? ""}` : "-"} />
              <L a="Transporteur" b={p.transporteur_nom} c="Remorque" d={p.remorque} />
              <L a="Chauffeur" b={p.chauffeur} c="Peseur" d={p.id_operateur_2 || p.id_operateur_1} />
            </tbody>
          </table>
          {qrBloc}
        </div>
        <p className="tk-nb">NB : toutes les informations réelles et authentiques de cette pesée se trouvent dans le QR code. Bien vouloir le scanner.</p>
        {pied}
      </div>
    );
  }

  const C = ({ l, v }: { l: string; v: React.ReactNode }) => <div className="bc"><span>{l}</span><b>{v || "-"}</b></div>;
  return (
    <div className="ticket bon">
      {head}
      <div className="tk-bar" />
      <div className="bon-top">
        <h2 className="tk-titre">{titre} N° {p.code_pesee}</h2>
        {qrBloc}
      </div>
      <div className="bon-cols">
        <div>
          <C l="IMMATRICULATION" v={p.num_imma} />
          <C l="CLIENT" v={p.client_nom} />
          <C l="PRODUIT" v={p.produit_nom} />
          <C l="TRANSPORTEUR" v={p.transporteur_nom} />
          <C l="CHAUFFEUR" v={p.chauffeur} />
          <C l="PROVENANCE" v={p.provenance} />
          <C l="PESÉE 1" v={`${p.date_1 ?? ""}  ${p.heure_1 ?? ""}`} />
          <C l="PESÉE 2" v={complete ? `${p.date_2 ?? ""}  ${p.heure_2 ?? ""}` : ""} />
        </div>
        <div>
          <C l="N° BL" v={p.num_bl} />
          <C l="FOURNISSEUR" v={p.fournisseur_nom} />
          <C l="CONTENEUR" v={p.conteneur} />
          <C l="PLOMB" v={p.plomb} />
          <C l="REMORQUE" v={p.remorque} />
          <C l="DESTINATION" v={p.destination} />
          <C l="POIDS DÉCLARÉ" v={p.poids_declare != null ? `${kg(p.poids_declare)} kg` : ""} />
          <C l="ÉCART" v={p.ecart != null ? `${kg(p.ecart)} kg` : ""} />
        </div>
        <div>
          <C l="SITE" v={p.nom_magasin} />
          <C l="MOUVEMENT" v={p.mouvement} />
          <C l="CAMPAGNE" v={p.campagne || p.tbl.replace(/^pesee_/, "")} />
          <C l="PONT" v={[p.pont_1, p.pont_2].filter((x) => x != null).join(" / ")} />
        </div>
      </div>
      <div className="bon-obs"><span>OBSERVATION</span><div>{p.observation}</div></div>
      <table className="bon-poids">
        <thead><tr><th>VISA OPÉRATEUR</th><th>CODE PESÉE</th><th>POIDS P1 (kg)</th><th>POIDS P2 (kg)</th><th className="net">POIDS NET (kg)</th><th>VISA CHAUFFEUR</th></tr></thead>
        <tbody><tr>
          <td>{p.id_operateur_2 || p.id_operateur_1}</td>
          <td>{p.code_pesee}</td>
          <td><div className="w">{kg(p.poids_1)}</div>{manuel1(p.state) && <em>PESÉE MANUELLE</em>}</td>
          <td><div className="w">{complete ? kg(p.poids_2) : "-"}</div>{manuel2(p.state) && <em>PESÉE MANUELLE</em>}</td>
          <td className="net"><div className="w big">{complete ? kg(p.poids_net) : "-"}</div></td>
          <td></td>
        </tr></tbody>
      </table>
      {pied}
    </div>
  );
}
