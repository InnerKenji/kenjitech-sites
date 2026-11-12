#ifndef SWSYNC_H
#define SWSYNC_H
/*
 * SoftWEIGHT Online : synchronisation du poste pont-bascule vers la plateforme web.
 *
 * Principe (aucune pesée oubliée, aucun ralentissement du pesage) :
 *  - des déclencheurs MariaDB (triggers) notent chaque ajout / modification / suppression dans la
 *    table sw_sync_file, dans la même instruction que l'enregistrement : rien ne peut être oublié ;
 *  - un fil d'exécution séparé (QThread), avec sa propre connexion à la base, lit la file par lots,
 *    envoie en HTTPS (requêtes signées HMAC-SHA256) et ne retire une ligne qu'après accusé de réception ;
 *  - sans Internet, la file attend ; reprise automatique avec délais progressifs.
 *
 * Le module ne fait RIEN tant qu'il n'a pas été activé (bouton « Module web » en configuration).
 * Qt 5.2.1 / MinGW 4.8 : pas de lambdas, pas de C++14.
 */
#include <QObject>
#include <QString>
#include <QStringList>
#include <QByteArray>
#include <QVariantMap>
#include <QSqlDatabase>

class QThread;
class QTimer;
class QNetworkAccessManager;
class QNetworkReply;

struct SwSyncParams {
    QString hote, base, utilisateur, motdepasse;
    int port;
    SwSyncParams() : port(3306) {}
};

class SwSync : public QObject
{
    Q_OBJECT
public:
    // Adresse de la plateforme et clé publique (X25519) qui chiffre le code d'activation.
    static const char *URL_PLATEFORME;
    static const char *CLE_PUBLIQUE_B64;

    /* Démarre le module en tâche de fond (à appeler une fois, après l'ouverture de la base).
       Ne fait rien de visible si le module n'est pas activé. */
    static void demarrer(const SwSyncParams &p);
    static void arreter();
    static SwSync *instance();

    /* Utilitaires appelés depuis l'interface (thread principal, connexion par défaut). */
    static bool estActive(QSqlDatabase db);           // un code a été généré pour ce poste
    static QString genererCodeActivation(QSqlDatabase db, const QVariantMap &infos, QString *erreur);
    static bool desactiver(QSqlDatabase db, QString *erreur);
    /* Fragment SQL pour filtrer les pesées non synchronisées d'une table pesee_xxx, ex. :
       model->setFilter(filtreActuel + " and " + SwSync::filtreNonSynchronisees("pesee_2026")) */
    static QString filtreNonSynchronisees(const QString &table);
    static int nbNonSynchronisees(QSqlDatabase db, const QString &table);
    /* Contenu du QR code du ticket : lien de vérification si le module est actif, sinon texte d'origine. */
    static QString contenuQr(QSqlDatabase db, const QString &table, const QString &codePesee,
                             const QString &poidsNet, const QString &texteParDefaut);

signals:
    /* couleur : 0 = gris (inactif / hors ligne), 1 = ambre (envoi en cours / en attente d'activation), 2 = vert (à jour) */
    void etat(const QString &texte, int enAttente, int couleur);

private slots:
    void initDansLeFil();
    void tic();
    void finRequete();

private:
    explicit SwSync(const SwSyncParams &p);
    bool ouvrirBase();
    bool lireConf();
    void ecrireConf(const QString &cle, const QString &valeur);
    QString conf(const QString &cle) const;
    void installerDeclencheurs();
    void reprendreHistorique();
    QStringList tablesSuivies();
    QStringList clePrimaire(const QString &table);
    QVariantList descriptionTables();
    void envoyer(const QString &chemin, const QByteArray &corps, const QString &etape);
    void traiterReponse(const QString &etape, int http, const QVariantMap &rep);
    void envoyerLot();
    void envoyerControle();
    QVariant valeurJson(const QVariant &v);
    QString empreinteMotDePasse(const QString &nom, const QString &stocke);
    void planifier(int ms);
    void signaler(const QString &texte, int couleur);

    SwSyncParams m_p;
    QSqlDatabase m_db;
    QNetworkAccessManager *m_net;
    QTimer *m_timer;
    QNetworkReply *m_reply;
    QString m_etapeEnCours;
    QVariantMap m_conf;
    QByteArray m_secret;
    qint64 m_decalage;      // heure serveur - heure locale (secondes)
    int m_echecs;
    bool m_schemaEnvoye;
    bool m_actif;           // activé côté plateforme
    QList<qlonglong> m_lotIds;
    qint64 m_dernierControle;
    qint64 m_derniereVerifTables;
    int m_enAttente;

    static SwSync *s_instance;
    static QThread *s_thread;
};

#endif
