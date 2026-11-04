# SoftWEIGHT – Pesage par lot en usine + module Gestion comptable
## Notes de procédures pour le guide d'utilisation (opérateur, superviseur, administrateur)

Les notes ci-dessous viennent du code source (`capipesage.cpp`, `operateur.cpp`, `comptabilitegenerale.cpp`, `facturation.cpp`, `historiquefinancement.cpp` et les `.ui`). Elles ont été vérifiées par une démonstration réelle sur la base locale `softwlotfinbd`, faite le 4 novembre 2026 avec des données nommées DEMO.

Les captures sont dans `captures/`. Sur chaque capture, le bouton ou le champ à utiliser est **encadré en jaune ambré**. Les noms de clients, fournisseurs et transporteurs réels, ainsi que les plaques et les numéros de BL, sont floutés. Les mots de passe sont floutés. Les données DEMO et KENJITECH restent visibles.

---

## 0. Rôles et droits

Le rôle d'un utilisateur est le champ **Poste** de sa fiche opérateur.

| Fonction | Opérateur | Superviseur | Administrateur |
|---|:-:|:-:|:-:|
| Se connecter, changer son propre mot de passe | ✔ | ✔ | ✔ |
| Pesée des palettes, tare, effacer une tare ou une pesée de palette | ✔ | ✔ | ✔ |
| Créer un lot, ajouter des palettes, laboratoire, booking, poids conteneur | ✔ | ✔ | ✔ |
| Créer un client, un fournisseur, un site ou un produit | ✔ | ✔ | ✔ |
| États, tri, exports PDF et Excel, état du stock | ✔ | ✔ | ✔ |
| **Clôturer un lot** | ✖ (bouton grisé) | ✔ | ✔ |
| Ajouter ou supprimer un opérateur | ✖ | ✔ | ✔ |
| Configuration (ports, base de données), modifier l'exploitant | ✖ | ✔ | ✔ |
| Poids des sacs vides | ✖ | ✔ | ✔ |
| Comptabilité : financements **clients**, facturation, comptes **clients**, caisse (capital, dépenses, paiement des lots) | ✔ | ✔ | ✔ |
| Comptabilité : onglets **Fournisseurs** (financements reçus, comptes fournisseurs) | ✖ | ✖ | ✔ (onglet visible seulement pour l'Administrateur) |

Captures : `02-accueil-operateur`, `40-accueil-superviseur`, `50-accueil-administrateur`, `17-cloturer-grise-operateur`, `52-financements-onglets-admin`, `53-compta-onglets-admin`.

Menus : **Fichier** (Nouvelle pesée > Pesée sur pont bascule / Pesée sur balance ; Nouvel utilisateur ; Configuration ; Imprimer ; Fermer) ; **Ressource** (Client ; Produit ; Opérateur > Ajouter / Modifier le mot de passe / Supprimer ; Fournisseur ; Site client ; Pont ; Transporteur ; Type de véhicule ; Poids des sacs vides ; Déclôturer le lot ; Réinitialiser booking ; Réinitialiser analyse ; Modifier les informations du lot ; Supprimer le lot) ; **Comptabilité** (Historique des financements ; Facturation ; Comptabilité générale). Captures `03-menu-fichier`, `04-menu-ressource`, `23-menu-comptabilite`.

À la fermeture, SoftWEIGHT lance automatiquement une sauvegarde de la base (fenêtre « Patientez pendant la sauvegarde de la base de données »).

---

## 1. Se connecter (tous les rôles)
1. Cliquer sur **Connexion**, en haut à droite du bandeau.
2. Saisir l'**Identifiant** (code opérateur, par exemple op006), puis le **Mot de passe**.
3. Cliquer sur **VALIDER**. Message : « Connecté ! ». Le nom de l'utilisateur s'affiche dans le bandeau.
- Erreur : « Paramètres d'accès invalide ! » (identifiant ou mot de passe faux).
- Pour se déconnecter, recliquer sur Connexion (« … va être déconnecté »).

Captures : `01-connexion` (opérateur), `39-connexion` (superviseur), `49-connexion` (administrateur), `02-accueil-operateur`.

## 2. Créer un utilisateur (Superviseur ou Administrateur)
1. **Ressource > Opérateur > Ajouter un opérateur.**
2. Renseigner **Nom**, **Poste** (operateur / Superviseur / Administrateur) et **Mot de passe**.
3. **SAUVEGARDER.** Message : « Votre compte a bien été créé. Votre nom d'utilisateur est opXXX ». Le code (op008 dans la démo) est attribué automatiquement : c'est l'identifiant de connexion.
- Changer son mot de passe : **Ressource > Opérateur > Modifier le mot de passe** (ancien mot de passe, puis nouveau). Erreur : « L'actuel mot de passe est érroné ! ».
- Supprimer : **Ressource > Opérateur > Supprimer un opérateur** (Superviseur ou Administrateur).

Captures : `41-menu-ressource-operateur`, `42-utilisateur-nouveau`, `42-utilisateur-message`.

## 3. Créer un client
**Ressource > Client (livreurs, planteurs…)**, ou le bouton **+** à côté du champ Client dans le formulaire de lot.
- Champs : **NOM** (obligatoire), ADRESSE (20 caractères au maximum), TELEPHONE, Email.
- **SAUVEGARDER.** Erreur si le nom est vide : « Veuillez saisir un nom de client. »
- La liste de droite affiche les clients existants.
- Remarque : les entrées du menu Ressource s'activent sur les écrans de pesée. Le bouton **+** du formulaire est toujours disponible.

Capture : `05-client-nouveau`.

## 4. Créer un fournisseur
**Ressource > Fournisseur (grands financiers, exportateurs…)**
- Champs : **Nom du fournisseur** (obligatoire), Adresse, Téléphone, Email. Le code fournisseur (f10 dans la démo) est attribué automatiquement.
- **SAUVEGARDER.** Erreur : « Veuillez saisir un nom de fournisseur. »

Capture : `06-fournisseur-nouveau`.

## 5. Créer un site et les autres référentiels
- **Site client** : Ressource > Site client. Champs : **Nom du magasin** (obligatoire), Société, ADRESSE, Téléphone. Erreur : « Veuillez saisir un nom de site. » Capture `07-site-nouveau`.
- **Produit** : Ressource > Produit. Champ : **NOM DU PRODUIT** ; le code (p012 dans la démo) est automatique. Boutons Modifier et Supprimer. Capture `08-produit-nouveau`.
- Également : Pont (numéro, n° de certificat, marque, magasin), Transporteur (société, téléphone), Type de véhicule.

## 6. Créer un lot
1. Accueil > icône **pèse-palette** : l'écran des lots s'ouvre. Cliquer sur **Nouveau lot**.
2. **Mouvement des lots** (obligatoire) : `1-RECEPTION` ou `4-CHARGEMENT`.
3. Pour une **RÉCEPTION**, choisir le **Client (livreurs de produit)** ; pour un **CHARGEMENT**, choisir le **Fournisseur (exportateurs)**.
4. **Produit** (obligatoire). Facultatif : Provenance, Destination, Immatriculation, N° Bon de livraison, Conteneur, Plomb, Chauffeur, Observation.
5. **ENREGISTRER LE LOT.** Message : « Le lot RE7670411261603 a été créé. » Le code du lot est généré automatiquement : RE = réception, EX ou EM = chargement.
- Erreurs : « Veuillez spécifier le mouvement. », « Veuillez spécifier le produit. », « Vous faites un mouvement de réception de produit. Vous devez sélectionner un client. », « … mouvement de chargement … Vous devez sélectionner un fournisseur. »

Captures : `09-lots-liste`, `10-lot-nouveau`, `10-lot-message`.

## 7. Créer une palette pour un lot
1. Écran des lots : cliquer sur le lot dans la liste **LOT**.
2. Cliquer sur **Ajouter** (cadre PALETTE). Une palette PAL1, PAL2… est créée à chaque clic.
- Erreurs : « Veuillez d'abord sélectionner le lot. », « Ce lot est déjà clôturé. »

Captures : `11-palette-ajouter`, `11-palettes-creees`.

## 8. Faire la pesée d'une palette
1. Sélectionner le lot, puis **double-cliquer sur la palette** dans le tableau PALETTE. L'écran de pesée s'ouvre.
2. Placer la palette sur la balance : l'afficheur noir montre le poids en direct.
3. Saisir le **Nombre de sacs** (jute et/ou nylon).
4. Cliquer sur **VALIDER LE POIDS** (à droite de « kg »), puis sur **SAUVEGARDER**.
- Erreurs : « Veuillez saisir le nombre de sacs/colis. », « Aucune charge détectée. » (poids nul), « Cette palette a déjà été pesée. », « Les enregistrements de ce lot sont en cours d'utilisation. »
- Saisie manuelle du poids : bouton **clavier**, visible seulement en mode manuel.

Captures : `12-pesee-palette-1-a-valider`, `12-pesee-palette-1-b-sauvegarder`, `13-pesee-palette-2-a-valider`, `13-pesee-palette-2-b-sauvegarder`, `13-palettes-pesees`.

## 9. Ajouter la tare des palettes
1. Écran des lots : sélectionner le lot, puis cliquer sur **Pesée Tare**. Cela n'est possible que si le lot n'a pas encore de tare.
2. Poser les palettes vides : leur poids s'affiche.
3. **VALIDER LE POIDS**, puis **SAUVEGARDER**. La tare (48 kg dans la démo) apparaît dans le champ **Tare** du lot.

Captures : `14-tare-bouton`, `14-tare-a-valider`, `14-tare-b-sauvegarder`.

## 10. Retirer la tare
- Sélectionner le lot, puis cliquer sur **Effacer tare**. Message : « Tare effacée. Il faudra la repeser complètement avant de pouvoir clôturer le lot. »
- Erreurs : « Veuillez d'abord sélectionner le lot. », « Ce lot a déjà été clôturé. »

Captures : `15-effacer-tare`, `15-effacer-tare-message`.

## 11. Supprimer la pesée d'une palette
- Sélectionner le lot, cliquer sur la palette, puis sur **Effacer pesée palette**. La palette est retirée du lot (elle n'apparaît plus dans le tableau) ; il suffit d'en ajouter une nouvelle et de la peser.
- Erreurs : « Veuillez d'abord sélectionner le lot et la palette à supprimer. », « Ce lot a déjà été clôturé. »

Captures : `16-effacer-pesee-palette`, `16-pesee-effacee`.

## 12. Clôturer le lot (Superviseur ou Administrateur)
1. Sélectionner le lot, puis cliquer sur **CLÔTURER LE LOT**. Ce bouton est grisé pour un opérateur.
2. Confirmer « Voulez-vous clôturer le lot ? » avec **OUI**.
3. À la clôture, le **poids du lot** (somme des palettes) et le **poids net** sont calculés. Le net déduit la tare et le poids des sacs vides : dans la démo, 1 260 kg brut − 48 kg de tare − 20 sacs × 1 kg = **1 192 kg net**.
- Conditions : toutes les palettes doivent être pesées. Erreurs : « Toutes les palettes créées pour ce lot n'ont pas encore été pesées. », « Vous n'avez pesé aucune palette de ce lot. », « Veuillez d'abord sélectionner le lot à clôturer. »
- Annuler une clôture : **Ressource > Déclôturer le lot** (menu proposé selon le lot sélectionné ; non testé dans la démo).

Captures : `17-cloturer-grise-operateur`, `43-cloturer-lot`, `44-cloture-confirmation`, `45-lot-cloture`.

## 13. Imprimer le ticket
- Sélectionner le lot, puis **Fichier > Imprimer**. Fenêtre « Voulez-vous générer le fichier et imprimer ? » : **Oui** génère le ticket PDF et l'envoie à l'imprimante ; **Non** annule.
- La démonstration n'a pas lancé d'impression réelle.

Capture : `19-imprimer-ticket`.

## 14. Données de laboratoire (analyse)
1. Sélectionner le lot, puis cliquer sur **LABORATOIRE**.
2. Saisir le **Taux d'humidité %** et le **Taux de défauts %**. La fenêtre affiche aussi les poids de réfaction (humidité, défaut, coupe) et le **Poids net attendu**.
3. **ENREGISTRER.** Message : « Enregistrement effectué ! ». Pour effacer une analyse : **Ressource > Réinitialiser analyse**.
- Autres boutons : **BOOKING** (numéro de booking) et **Poids conteneur** (poids du conteneur, VGM).

Captures : `18-laboratoire-bouton`, `18-laboratoire-saisie`, `18-laboratoire-message`.

## 15. États (tri) et exports PDF / Excel
- **Générer les états** (icône États de l'accueil) : Période (Pesée du … au …), **Trier par** (Mouvement, Client, Produit, Provenance, Destination, Fournisseur, Navire, Conteneur), Paramètres, type d'état **Simple** ou **Détaillé**, puis **GÉNÉRER**. Capture `20-etats-tri-generer`.
- **Rapport des lots** (seconde icône États) : filtres **Pesée du / au**, Lot, Mouvement, Client, Produit, Provenance, Destination, Fournisseur, Véhicule, Conteneur, Plomb, Booking. Le bouton **=** calcule le **TOTAL NET**.
  - **EXPORT PDF** crée l'état au format PDF (dossier `Docs/Etat_cumule`) et l'ouvre.
  - **EXPORT EXCEL** crée le fichier Excel des lots affichés.
  - Pour n'exporter que les lots clôturés, filtrer d'abord la liste.
  - Capture `21-etats-lots-exports`.
- **ETAT DU STOCK** : reçu (réception), expédié (chargement) et stock actuel en kg. Capture `22-etat-stock`.

## 16. Facturer un lot
1. **Comptabilité > Facturation.** Filtres disponibles : type, statut, client, fournisseur, produit, code ou n° de lot, intervalle de dates.
2. **Double-cliquer sur le lot** : ses données (poids net, sacs, client…) s'affichent dans « Facturation du lot sélectionné ».
3. Saisir le **Coût unit. (FCFA/kg)** : le **Coût total** est calculé (poids net × coût).
4. **ENREGISTRER.** Message : « Facturation enregistrée. Total : 1 490 000 ». Dans la démo, 1 192 kg × 1 250 FCFA.
- Erreurs : « Veuillez double-cliquer sur un lot… », « Veuillez saisir le coût unitaire par kg (entier positif). », « Le poids net du lot est nul ou invalide, facturation impossible. », « Ce lot est déjà facturé. On ne peut plus le facturer. »

Captures : `26-facturer-lot`, `26-facturation-message`, `26-lot-facture`.

## 17. Payer un lot
1. **Comptabilité > Comptabilité générale**, onglet **Caisse (capital / dépenses)**.
2. Dans « Lots RÉCEPTION – filtre par statut » (statut « Non payés »), sélectionner le lot.
3. Cliquer sur **Payer le lot sélectionné**, puis confirmer « Payer le lot suivant : … Montant … Confirmer la sortie de caisse ? » avec **Yes**.
4. Message : « Paiement enregistré : 1 490 000 FCFA. » Une dépense de type PAIEMENT_LOT est créée, le lot reçoit sa date de paiement, et le solde en caisse diminue.
- Erreurs : « Veuillez sélectionner un lot à payer dans le tableau du bas. », « Ce lot a déjà été payé le … ».

Captures : `29-payer-lot`, `29-paiement-message`, `29-lot-paye`.

## 18. Préfinancements et financements
- **Client** (tous les rôles) : **Comptabilité > Historique des financements**, onglet Financements CLIENTS. Renseigner Client, Date, **Montant (FCFA)** et Descriptif, puis **ENREGISTRER**. Message : « Financement enregistré. »
  - Un montant **négatif** correspond à un remboursement ou à une correction, et le descriptif devient obligatoire.
  - Erreurs : « Veuillez sélectionner le nom du client. », « La saisie du nom du client n'existe pas dans la base de données. »
  - Captures `24-prefinancement-client`, `24-prefinancement-message`, `24-prefinancement-historique`.
- **Fournisseur** (Administrateur seulement : onglet Financements FOURNISSEURS (reçus)) : mêmes champs. Message : « Financement fournisseur enregistré. » Captures `52-financements-onglets-admin`, `25-financement-fournisseur`, `25-financement-f-message`.
- Chaque historique se filtre (client ou fournisseur, intervalle, date) et s'exporte en Excel.

## 19. Enregistrer une entrée d'argent (capital) et une dépense
- Onglet **Caisse** de la Comptabilité générale.
- **+ Déclarer capital** : Date, **Montant (FCFA)** (strictement positif), Descriptif facultatif, puis **VALIDER**. Erreurs : « Veuillez saisir le montant. », « Le montant doit être strictement positif. » Captures `27-capital-bouton`, `28-capital-saisie`.
- **+ Dépense libre** : Date, **Type de dépense** (MATÉRIEL, SALAIRE, ÉLECTRICITÉ, EAU, CARBURANT, TRANSPORT, AUTRE ou saisie libre), Bénéficiaire facultatif, **Montant**, Descriptif, puis **VALIDER**. Capture `30-depense-saisie`.
- Les cartes **CAPITAL REÇU**, **DÉPENSES TOTALES** et **SOLDE EN CAISSE** se mettent à jour. Le solde est vert s'il est positif, rouge s'il est négatif, orange s'il est nul. Capture `34-caisse-apres`.

## 20. Comptabilité générale et compte d'un client ou d'un fournisseur
- **Comptabilité > Comptabilité générale**, onglet **Comptes CLIENTS** : pour chaque client, le nombre de livraisons, le montant livré, le financement et l'écart, avec les totaux. Capture `31-compta-comptes-clients`.
- **Un client en particulier** : choisir le client dans la liste **Client :** (saisie avec auto-complétion). Bouton **Réinitialiser** pour revenir à tous. **Trier par** (nom, livraisons, montant, financement). **Exporter Excel.** Capture `32-compta-client-demo` : CLIENT DEMO, 1 livraison, 1 490 000 FCFA livrés, 500 000 FCFA financés.
- **Comptes FOURNISSEURS** (Administrateur seulement) : même principe, avec le filtre **Fournisseur :**. Captures `53-compta-onglets-admin`, `33-compta-fournisseur-demo`.

---

## Données écrites pendant la démonstration (à effacer par la restauration de la sauvegarde de Ken)
- `client` : CLIENT DEMO. `fournisseur` : f10 FOURNISSEUR DEMO. `site_client` : SITE DEMO. `produit` : p012 CACAO DEMO.
- `operateur` : op008 OPERATEUR DEMO. Les connexions modifient aussi la colonne `etat` (utilisateur connecté).
- `lot` : RE7670411261603 (réception, CLIENT DEMO, CACAO DEMO, tare 48, labo, clôturé, facturé 1 250 FCFA/kg, payé). `pal` : PAL1 et PAL2 (PAL2 effacée).
- `finan` : 500 000 (CLIENT DEMO). `finan_fournisseur` : 2 000 000 (f10). `compte` et `compte_fournisseur` mis à jour.
- `capital` : 10 000 000 « Apport en capital (DEMO) ». `depense` : PAIEMENT_LOT 1 490 000 (CLIENT DEMO, lot DEMO) et CARBURANT 75 000 « (DEMO) ».
