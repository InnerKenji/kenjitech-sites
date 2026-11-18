/**
 * Correspondance entre les tables du logiciel SoftWEIGHT pont-bascule (base softweightbd)
 * et les écrans web. Les tables sont copiées telles quelles (miroir, préfixe m_).
 */
export const PROFIL = {
  operateurs: {
    table: "operateur",
    login: "nom", // identifiant de connexion sur le poste (clé primaire)
    nom: "nom",
    role: "poste", // "Superviseur" | "operateur" | "delete" (compte supprimé)
    // colonne ajoutée par le module de synchro : empreinte PBKDF2 du mot de passe (jamais le mot de passe)
    hash: "sw_mdp_empreinte",
  },
  // Une table de pesées par campagne : pesee_<campagne>
  peseesPrefixe: "pesee_",
  // Une pesée supprimée sur le poste garde sa ligne, avec « del » ajouté au nom du site
  suffixeSupprime: "del",
};
