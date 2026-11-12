/**
 * Correspondance entre les tables du logiciel SoftWEIGHT pont-bascule et les écrans web.
 * Les tables sont copiées telles quelles (miroir) ; ce fichier dit seulement où trouver
 * les pesées, les tiers et les opérateurs. À compléter d'après la base du logiciel.
 */
export const PROFIL = {
  operateurs: {
    table: "operateur",
    login: "login",
    nom: "nom",
    role: "profil",
    actif: null as string | null,
    // colonne ajoutée par le module de synchro : empreinte PBKDF2 du mot de passe
    hash: "sw_mdp_empreinte",
  },
};
