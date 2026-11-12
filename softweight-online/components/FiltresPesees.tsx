import type { Filtres } from "@/lib/pesees";

/** Formulaire de filtres commun aux écrans Pesées et États (méthode GET : l'adresse garde les filtres). */
export default function FiltresPesees({ f, listes, avecStatut = true, action }: {
  f: Filtres;
  listes: { magasins: string[]; campagnes: string[]; mouvements: string[] };
  avecStatut?: boolean;
  action?: string;
}) {
  return (
    <form className="card noprint" method="get" action={action}>
      <div className="row">
        {avecStatut && (
          <div>
            <label>Pesées</label>
            <select name="statut" defaultValue={f.statut ?? "complete"}>
              <option value="complete">Complétées</option>
              <option value="attente">En attente (1re pesée)</option>
              <option value="supprimee">Supprimées</option>
              <option value="toutes">Toutes</option>
            </select>
          </div>
        )}
        <div><label>Du</label><input type="date" name="du" defaultValue={f.du} /></div>
        <div><label>Au</label><input type="date" name="au" defaultValue={f.au} /></div>
        <div><label>Client</label><input name="client" defaultValue={f.client} /></div>
        <div><label>Produit</label><input name="produit" defaultValue={f.produit} /></div>
        <div><label>Transporteur</label><input name="transporteur" defaultValue={f.transporteur} /></div>
      </div>
      <div className="row">
        <div><label>Immatriculation</label><input name="immat" defaultValue={f.immat} /></div>
        <div>
          <label>Site</label>
          <select name="magasin" defaultValue={f.magasin ?? ""}>
            <option value="">Tous</option>
            {listes.magasins.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label>Campagne</label>
          <select name="campagne" defaultValue={f.campagne ?? ""}>
            <option value="">Toutes</option>
            {listes.campagnes.map((c) => <option key={c} value={c}>{c.replace(/^pesee_/, "")}</option>)}
          </select>
        </div>
        <div>
          <label>Mouvement</label>
          <select name="mouvement" defaultValue={f.mouvement ?? ""}>
            <option value="">Tous</option>
            {listes.mouvements.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div><label>Recherche (n°, BL, chauffeur, conteneur…)</label><input name="q" defaultValue={f.q} /></div>
        <button className="btn amber nogrow">Filtrer</button>
      </div>
    </form>
  );
}
