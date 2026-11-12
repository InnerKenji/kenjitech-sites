#include "swsync.h"
#include "swnacl.h"
#include "licencesw.h"

#include <QThread>
#include <QTimer>
#include <QDateTime>
#include <QUuid>
#include <QSqlQuery>
#include <QSqlRecord>
#include <QSqlField>
#include <QSqlError>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QNetworkAccessManager>
#include <QNetworkRequest>
#include <QNetworkReply>
#include <QSslConfiguration>
#include <QSslSocket>
#include <QCryptographicHash>
#include <QMessageAuthenticationCode>
#include <QUrl>
#include <QStringList>
#include <QSet>
#include <QMap>
#include <QDebug>
#include <string.h>

const char *SwSync::URL_PLATEFORME = "https://softweight.kenjitech.org";
// Clé publique X25519 de la plateforme (la clé privée correspondante n'existe que sur le serveur).
const char *SwSync::CLE_PUBLIQUE_B64 = "kdIlvcGfIdx55aNqlNNOABmiQHop3oWyTNF4xk32czU=";

SwSync *SwSync::s_instance = 0;
QThread *SwSync::s_thread = 0;

static const int LOT_MAX = 200;
static const char *CONNEXION = "swsync";
static const qlonglong GEN_MAX = 9000;

/* Tables jamais envoyées : licence, file et réglages du module. */
static bool tableExclue(const QString &t)
{
    QString l = t.toLower();
    return l == "tablic" || l == "swlic" || l.startsWith("sw_sync");
}

/* ------------------------------------------------------------------ */
/* Tables locales du module (créées seulement à l'activation)         */
/* ------------------------------------------------------------------ */
static bool creerTablesModule(QSqlDatabase db, QString *err)
{
    QSqlQuery q(db);
    const char *ddl[] = {
        "CREATE TABLE IF NOT EXISTS sw_sync_conf (cle VARCHAR(80) NOT NULL PRIMARY KEY, valeur TEXT) ENGINE=InnoDB DEFAULT CHARSET=utf8",
        "CREATE TABLE IF NOT EXISTS sw_sync_file (id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, tbl VARCHAR(64) NOT NULL, "
        "op CHAR(1) NOT NULL, pk TEXT NOT NULL, quand DATETIME NOT NULL, KEY tbl (tbl)) ENGINE=InnoDB DEFAULT CHARSET=utf8",
        "CREATE TABLE IF NOT EXISTS sw_sync_mdp (nom VARCHAR(100) NOT NULL PRIMARY KEY, source CHAR(64) NOT NULL, "
        "empreinte TEXT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8",
        0
    };
    for (int i = 0; ddl[i]; ++i) {
        if (!q.exec(QString::fromLatin1(ddl[i]))) {
            if (err) *err = q.lastError().text();
            return false;
        }
    }
    return true;
}

/* Clé locale liée à la machine : protège la clé secrète stockée dans la base. */
static QByteArray cleMachine()
{
    QString cm = LicenceSW::codeMachine();
    return QCryptographicHash::hash(("SWSYNC|" + cm).toUtf8(), QCryptographicHash::Sha256);
}
static QString protegerSecret(const QByteArray &secret)
{
    QByteArray k = cleMachine(), out = secret;
    for (int i = 0; i < out.size(); ++i) out[i] = out[i] ^ k[i % k.size()];
    return QString::fromLatin1(out.toBase64());
}
static QByteArray lireSecret(const QString &stocke)
{
    QByteArray k = cleMachine(), out = QByteArray::fromBase64(stocke.toLatin1());
    for (int i = 0; i < out.size(); ++i) out[i] = out[i] ^ k[i % k.size()];
    return out;
}

static QString confLire(QSqlDatabase db, const QString &cle)
{
    QSqlQuery q(db);
    q.prepare("SELECT valeur FROM sw_sync_conf WHERE cle = :c");
    q.bindValue(":c", cle);
    if (q.exec() && q.next()) return q.value(0).toString();
    return QString();
}
static bool confEcrire(QSqlDatabase db, const QString &cle, const QString &valeur)
{
    QSqlQuery q(db);
    q.prepare("REPLACE INTO sw_sync_conf (cle, valeur) VALUES (:c, :v)");
    q.bindValue(":c", cle);
    q.bindValue(":v", valeur);
    return q.exec();
}
static bool tableExiste(QSqlDatabase db, const QString &t)
{
    QSqlQuery q(db);
    q.prepare("SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :t");
    q.bindValue(":t", t);
    return q.exec() && q.next();
}

/* ------------------------------------------------------------------ */
/* Fonctions statiques utilisées par l'interface                      */
/* ------------------------------------------------------------------ */
bool SwSync::estActive(QSqlDatabase db)
{
    if (!tableExiste(db, "sw_sync_conf")) return false;
    return !confLire(db, "site_id").isEmpty();
}

QString SwSync::genererCodeActivation(QSqlDatabase db, const QVariantMap &infos, QString *erreur)
{
    if (!QSslSocket::supportsSsl()) {
        if (erreur) *erreur = QString::fromUtf8("Les bibliothèques HTTPS (libeay32.dll et ssleay32.dll) sont absentes du dossier du logiciel.");
        return QString();
    }
    if (!creerTablesModule(db, erreur)) return QString();
    if (confLire(db, "plateforme_ok") == "1") {
        if (erreur) *erreur = QString::fromUtf8("Ce poste est déjà relié à la plateforme. Désactivez d'abord le module pour générer un nouveau code.");
        return QString();
    }
    // Nouvelle identité du poste (remplace un code précédent non utilisé)
    QString site = QUuid::createUuid().toString().remove('{').remove('}').toLower();
    unsigned char sec[32];
    sw_random(sec, 32);
    QByteArray secret((const char *)sec, 32);
    memset(sec, 0, 32);

    QJsonObject ent;
    ent["nom"] = infos.value("entreprise").toString();
    ent["telephone"] = infos.value("telephone").toString();
    ent["adresse"] = infos.value("adresse").toString();
    ent["ville"] = infos.value("ville").toString();
    ent["pays"] = infos.value("pays", QString::fromUtf8("Cameroun")).toString();
    QJsonObject o;
    o["v"] = 1;
    o["site_id"] = site;
    o["secret"] = QString::fromLatin1(secret.toBase64());
    o["cree_le"] = QDateTime::currentDateTimeUtc().toString("yyyy-MM-ddTHH:mm:ssZ");
    o["entreprise"] = ent;
    o["magasin"] = infos.value("magasin").toString();
    o["pont_numero"] = infos.value("pont_numero").toString();
    o["pont_nom"] = infos.value("pont_nom").toString();
    o["code_machine"] = LicenceSW::codeMachine();
    o["licence"] = infos.value("licence").toString();
    o["version_logiciel"] = infos.value("version").toString();
    o["nb_pesees"] = infos.value("nb_pesees").toInt();
    o["base"] = db.databaseName();
    QByteArray msg = QJsonDocument(o).toJson(QJsonDocument::Compact);

    QByteArray pk = QByteArray::fromBase64(CLE_PUBLIQUE_B64);
    QByteArray out(msg.size() + 72, 0);
    long n = sw_seal((unsigned char *)out.data(), (const unsigned char *)msg.constData(), msg.size(),
                     (const unsigned char *)pk.constData());
    if (n <= 0) {
        if (erreur) *erreur = QString::fromUtf8("Erreur de chiffrement.");
        return QString();
    }
    out.resize((int)n);

    bool ok = confEcrire(db, "site_id", site) && confEcrire(db, "secret", protegerSecret(secret))
              && confEcrire(db, "plateforme_ok", "0") && confEcrire(db, "reprise_faite", "0")
              && confEcrire(db, "code_genere_le", QDateTime::currentDateTime().toString(Qt::ISODate));
    if (confLire(db, "gen").isEmpty()) ok = ok && confEcrire(db, "gen", "1");
    if (!ok) {
        if (erreur) *erreur = QString::fromUtf8("Impossible d'enregistrer la configuration du module.");
        return QString();
    }
    return "SWA1-" + QString::fromLatin1(out.toBase64(QByteArray::Base64UrlEncoding | QByteArray::OmitTrailingEquals));
}

bool SwSync::desactiver(QSqlDatabase db, QString *erreur)
{
    QSqlQuery q(db);
    // Supprime les déclencheurs posés par le module
    if (q.exec("SELECT trigger_name FROM information_schema.triggers WHERE trigger_schema = DATABASE() AND trigger_name LIKE 'swsync\\_%'")) {
        QStringList noms;
        while (q.next()) noms << q.value(0).toString();
        foreach (const QString &n, noms) {
            QSqlQuery d(db);
            d.exec("DROP TRIGGER IF EXISTS `" + n + "`");
        }
    }
    if (tableExiste(db, "sw_sync_conf") && !q.exec("DELETE FROM sw_sync_conf")) {
        if (erreur) *erreur = q.lastError().text();
        return false;
    }
    if (tableExiste(db, "sw_sync_file")) q.exec("DELETE FROM sw_sync_file");
    return true;
}

QString SwSync::filtreNonSynchronisees(const QString &table)
{
    QString t = table;
    t.replace("'", "");
    return QString("CAST(code_pesee AS CHAR) IN (SELECT JSON_VALUE(pk, '$.code_pesee') FROM sw_sync_file WHERE tbl = '%1')").arg(t);
}

int SwSync::nbNonSynchronisees(QSqlDatabase db, const QString &table)
{
    if (!tableExiste(db, "sw_sync_file")) return 0;
    QSqlQuery q(db);
    q.prepare("SELECT COUNT(DISTINCT pk) FROM sw_sync_file WHERE tbl = :t");
    q.bindValue(":t", table);
    if (q.exec() && q.next()) return q.value(0).toInt();
    return 0;
}

QString SwSync::contenuQr(QSqlDatabase db, const QString &table, const QString &codePesee,
                          const QString &poidsNet, const QString &texteParDefaut)
{
    if (!tableExiste(db, "sw_sync_conf") || confLire(db, "plateforme_ok") != "1") return texteParDefaut;
    QString site = confLire(db, "site_id");
    QByteArray secret = lireSecret(confLire(db, "secret"));
    if (site.isEmpty() || secret.size() != 32) return texteParDefaut;
    QByteArray uuid = QUuid(site).toRfc4122();
    QString net = QString::number(poidsNet.trimmed().toLongLong());
    QByteArray mac = QMessageAuthenticationCode::hash(("QR1|" + table + "|" + codePesee.trimmed() + "|" + net).toUtf8(),
                                                      secret, QCryptographicHash::Sha256).left(12);
    QByteArray::Base64Options b = QByteArray::Base64UrlEncoding | QByteArray::OmitTrailingEquals;
    return QString("%1/v/%2.%3.%4.%5").arg(URL_PLATEFORME)
        .arg(QString::fromLatin1(uuid.toBase64(b)))
        .arg(QString::fromLatin1(table.toUtf8().toBase64(b)))
        .arg(QString::fromLatin1(codePesee.trimmed().toUtf8().toBase64(b)))
        .arg(QString::fromLatin1(mac.toBase64(b)));
}

/* ------------------------------------------------------------------ */
/* Démarrage du fil d'exécution                                       */
/* ------------------------------------------------------------------ */
SwSync *SwSync::instance() { return s_instance; }

void SwSync::demarrer(const SwSyncParams &p)
{
    if (s_instance) return;
    s_thread = new QThread();
    s_instance = new SwSync(p);
    s_instance->moveToThread(s_thread);
    QObject::connect(s_thread, SIGNAL(started()), s_instance, SLOT(initDansLeFil()));
    s_thread->start(QThread::LowPriority);
}

void SwSync::arreter()
{
    if (!s_thread) return;
    s_thread->quit();
    s_thread->wait(3000);
}

SwSync::SwSync(const SwSyncParams &p)
    : QObject(0), m_p(p), m_net(0), m_timer(0), m_reply(0), m_decalage(0), m_echecs(0),
      m_schemaEnvoye(false), m_actif(false), m_dernierControle(0), m_derniereVerifTables(0), m_enAttente(0)
{
}

void SwSync::initDansLeFil()
{
    m_net = new QNetworkAccessManager(this);
    m_timer = new QTimer(this);
    m_timer->setSingleShot(true);
    connect(m_timer, SIGNAL(timeout()), this, SLOT(tic()));
    planifier(3000);
}

void SwSync::planifier(int ms) { m_timer->start(ms); }

void SwSync::signaler(const QString &texte, int couleur) { emit etat(texte, m_enAttente, couleur); }

bool SwSync::ouvrirBase()
{
    if (m_db.isValid() && m_db.isOpen()) {
        QSqlQuery ping(m_db);
        if (ping.exec("SELECT 1")) return true;
        m_db.close();
    }
    if (!QSqlDatabase::contains(CONNEXION)) m_db = QSqlDatabase::addDatabase("QMYSQL", CONNEXION);
    else m_db = QSqlDatabase::database(CONNEXION, false);
    m_db.setHostName(m_p.hote);
    m_db.setDatabaseName(m_p.base);
    m_db.setPort(m_p.port);
    m_db.setUserName(m_p.utilisateur);
    m_db.setPassword(m_p.motdepasse);
    m_db.setConnectOptions("MYSQL_OPT_RECONNECT=1");
    if (!m_db.open()) return false;
    QSqlQuery q(m_db);
    q.exec("SET NAMES utf8");
    return true;
}

bool SwSync::lireConf()
{
    m_conf.clear();
    if (!tableExiste(m_db, "sw_sync_conf")) return false;
    QSqlQuery q(m_db);
    if (!q.exec("SELECT cle, valeur FROM sw_sync_conf")) return false;
    while (q.next()) m_conf[q.value(0).toString()] = q.value(1).toString();
    if (conf("site_id").isEmpty()) return false;
    m_secret = lireSecret(conf("secret"));
    return m_secret.size() == 32;
}
QString SwSync::conf(const QString &cle) const { return m_conf.value(cle).toString(); }
void SwSync::ecrireConf(const QString &cle, const QString &valeur)
{
    confEcrire(m_db, cle, valeur);
    m_conf[cle] = valeur;
}

/* ------------------------------------------------------------------ */
/* Boucle principale                                                  */
/* ------------------------------------------------------------------ */
void SwSync::tic()
{
    if (m_reply) { planifier(1000); return; }
    if (!ouvrirBase()) { signaler(QString::fromUtf8("Synchro : base locale indisponible"), 0); planifier(30000); return; }
    if (!lireConf()) { m_actif = false; planifier(60000); return; } // module non activé : rien à faire

    QSqlQuery c(m_db);
    if (c.exec("SELECT COUNT(*) FROM sw_sync_file") && c.next()) m_enAttente = c.value(0).toInt();

    if (!m_actif) {
        // Se présenter : la plateforme dit si le poste est activé et donne son heure
        QJsonObject o;
        o["file_attente"] = m_enAttente;
        envoyer("/api/sync/v1/bonjour", QJsonDocument(o).toJson(QJsonDocument::Compact), "bonjour");
        return;
    }
    qint64 maintenant = QDateTime::currentMSecsSinceEpoch() / 1000;
    if (maintenant - m_derniereVerifTables > 60) {   // nouvelles campagnes = nouvelles tables
        m_derniereVerifTables = maintenant;
        installerDeclencheurs();
        if (conf("reprise_faite") != "1") reprendreHistorique();
    }
    if (!m_schemaEnvoye) {
        QJsonObject o;
        o["tables"] = QJsonArray::fromVariantList(descriptionTables());
        envoyer("/api/sync/v1/schema", QJsonDocument(o).toJson(QJsonDocument::Compact), "schema");
        return;
    }
    if (m_enAttente > 0) { envoyerLot(); return; }
    if (maintenant - m_dernierControle > 6 * 3600) { envoyerControle(); return; }
    signaler(QString::fromUtf8("Synchro web : à jour"), 2);
    planifier(5000);
}

/* ------------------------------------------------------------------ */
/* Déclencheurs                                                       */
/* ------------------------------------------------------------------ */
QStringList SwSync::tablesSuivies()
{
    QStringList t;
    QSqlQuery q(m_db);
    if (q.exec("SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'"))
        while (q.next()) {
            QString n = q.value(0).toString();
            if (!tableExclue(n) && !clePrimaire(n).isEmpty()) t << n;
        }
    return t;
}

QStringList SwSync::clePrimaire(const QString &table)
{
    QStringList k;
    QSqlQuery q(m_db);
    q.prepare("SELECT column_name FROM information_schema.key_column_usage WHERE table_schema = DATABASE() "
              "AND table_name = :t AND constraint_name = 'PRIMARY' ORDER BY ordinal_position");
    q.bindValue(":t", table);
    if (q.exec()) while (q.next()) k << q.value(0).toString();
    return k;
}

static QString jsonObjet(const QStringList &cols, const QString &prefixe)
{
    QStringList parts;
    foreach (const QString &c, cols) parts << QString("'%1', %2.`%1`").arg(c, prefixe);
    return "JSON_OBJECT(" + parts.join(", ") + ")";
}

void SwSync::installerDeclencheurs()
{
    QSet<QString> existants;
    QSqlQuery q(m_db);
    if (q.exec("SELECT trigger_name FROM information_schema.triggers WHERE trigger_schema = DATABASE() AND trigger_name LIKE 'swsync\\_%'"))
        while (q.next()) existants.insert(q.value(0).toString().toLower());

    foreach (const QString &t, tablesSuivies()) {
        QStringList pk = clePrimaire(t);
        QString ai = ("swsync_" + t + "_ai").left(64), au = ("swsync_" + t + "_au").left(64), ad = ("swsync_" + t + "_ad").left(64);
        QString nt = t;
        nt.replace("'", "");
        QSqlQuery d(m_db);
        if (!existants.contains(ai.toLower()))
            d.exec(QString("CREATE TRIGGER `%1` AFTER INSERT ON `%2` FOR EACH ROW "
                           "INSERT INTO sw_sync_file (tbl, op, pk, quand) VALUES ('%3', 'U', %4, NOW())")
                       .arg(ai, t, nt, jsonObjet(pk, "NEW")));
        if (!existants.contains(au.toLower())) {
            QStringList diff;
            foreach (const QString &c, pk) diff << QString("NOT (OLD.`%1` <=> NEW.`%1`)").arg(c);
            d.exec(QString("CREATE TRIGGER `%1` AFTER UPDATE ON `%2` FOR EACH ROW BEGIN "
                           "IF %3 THEN INSERT INTO sw_sync_file (tbl, op, pk, quand) VALUES ('%4', 'D', %5, NOW()); END IF; "
                           "INSERT INTO sw_sync_file (tbl, op, pk, quand) VALUES ('%4', 'U', %6, NOW()); END")
                       .arg(au, t, diff.join(" OR "), nt, jsonObjet(pk, "OLD"), jsonObjet(pk, "NEW")));
        }
        if (!existants.contains(ad.toLower()))
            d.exec(QString("CREATE TRIGGER `%1` AFTER DELETE ON `%2` FOR EACH ROW "
                           "INSERT INTO sw_sync_file (tbl, op, pk, quand) VALUES ('%3', 'D', %4, NOW())")
                       .arg(ad, t, nt, jsonObjet(pk, "OLD")));
        if (d.lastError().isValid()) qWarning() << "swsync trigger" << t << d.lastError().text();
    }
}

/* Envoie toutes les données déjà présentes (une seule fois, après l'activation). */
void SwSync::reprendreHistorique()
{
    foreach (const QString &t, tablesSuivies()) {
        QSqlQuery q(m_db);
        QString nt = t;
        nt.replace("'", "");
        q.exec(QString("INSERT INTO sw_sync_file (tbl, op, pk, quand) SELECT '%1', 'U', %2, NOW() FROM `%3` AS x")
                   .arg(nt, jsonObjet(clePrimaire(t), "x"), t));
    }
    ecrireConf("reprise_faite", "1");
}

QVariantList SwSync::descriptionTables()
{
    QVariantList out;
    foreach (const QString &t, tablesSuivies()) {
        QVariantList cols;
        QSqlQuery q(m_db);
        q.prepare("SELECT column_name, column_type FROM information_schema.columns WHERE table_schema = DATABASE() "
                  "AND table_name = :t ORDER BY ordinal_position");
        q.bindValue(":t", t);
        q.exec();
        while (q.next()) {
            QString n = q.value(0).toString();
            if (t.toLower() == "operateur" && n.toLower() == "password") continue; // jamais envoyé en clair
            QVariantMap c;
            c["name"] = n;
            c["type"] = q.value(1).toString();
            cols << c;
        }
        if (t.toLower() == "operateur") {
            QVariantMap c;
            c["name"] = "sw_mdp_empreinte";
            c["type"] = "text";
            cols << c;
        }
        QVariantMap m;
        m["name"] = t;
        m["columns"] = cols;
        m["primaryKey"] = clePrimaire(t);
        out << m;
    }
    return out;
}

/* ------------------------------------------------------------------ */
/* Envoi d'un lot                                                     */
/* ------------------------------------------------------------------ */
QVariant SwSync::valeurJson(const QVariant &v)
{
    if (v.isNull()) return QVariant();
    switch (v.type()) {
    case QVariant::DateTime: return v.toDateTime().toString("yyyy-MM-dd HH:mm:ss");
    case QVariant::Date: return v.toDate().toString("yyyy-MM-dd");
    case QVariant::Time: return v.toTime().toString("HH:mm:ss");
    case QVariant::ByteArray: return QString::fromLatin1(v.toByteArray().toBase64());
    case QVariant::Int: case QVariant::LongLong: case QVariant::UInt: case QVariant::ULongLong:
        return QString::number(v.toLongLong());
    case QVariant::Double: return v.toDouble();
    default: return v.toString();
    }
}

/* Empreinte PBKDF2-HMAC-SHA256 (100 000 tours) du mot de passe d'un opérateur, mise en cache. */
QString SwSync::empreinteMotDePasse(const QString &nom, const QString &stocke)
{
    int i = stocke.indexOf(QString::fromUtf8("£"));
    QString mdp = i >= 0 ? stocke.mid(i + 1) : stocke;
    QString source = QString::fromLatin1(QCryptographicHash::hash((nom + "|" + mdp).toUtf8(), QCryptographicHash::Sha256).toHex());
    QSqlQuery q(m_db);
    q.prepare("SELECT source, empreinte FROM sw_sync_mdp WHERE nom = :n");
    q.bindValue(":n", nom);
    if (q.exec() && q.next() && q.value(0).toString() == source) return q.value(1).toString();

    const int ITER = 100000;
    unsigned char s[16];
    sw_random(s, 16);
    QByteArray sel((const char *)s, 16), cle = mdp.toUtf8();
    QMessageAuthenticationCode mac(QCryptographicHash::Sha256, cle);
    mac.addData(sel + QByteArray("\x00\x00\x00\x01", 4));
    QByteArray u = mac.result(), t = u;
    for (int k = 1; k < ITER; ++k) {
        mac.reset();
        mac.addData(u);
        u = mac.result();
        for (int j = 0; j < t.size(); ++j) t[j] = t[j] ^ u[j];
    }
    QString emp = QString("pbkdf2$sha256$%1$%2$%3").arg(ITER).arg(QString::fromLatin1(sel.toBase64()), QString::fromLatin1(t.toBase64()));
    QSqlQuery w(m_db);
    w.prepare("REPLACE INTO sw_sync_mdp (nom, source, empreinte) VALUES (:n, :s, :e)");
    w.bindValue(":n", nom);
    w.bindValue(":s", source);
    w.bindValue(":e", emp);
    w.exec();
    return emp;
}

void SwSync::envoyerLot()
{
    QSqlQuery q(m_db);
    if (!q.exec(QString("SELECT id, tbl, op, pk, quand FROM sw_sync_file ORDER BY id LIMIT %1").arg(LOT_MAX))) {
        planifier(10000);
        return;
    }
    // Dernière entrée par (table, clé) : on envoie l'état actuel de la ligne
    QMap<QString, QVariantMap> parCle;
    QStringList ordre;
    m_lotIds.clear();
    while (q.next()) {
        m_lotIds << q.value(0).toLongLong();
        QString cle = q.value(1).toString() + "|" + q.value(3).toString();
        QVariantMap e;
        e["id"] = q.value(0).toLongLong();
        e["tbl"] = q.value(1).toString();
        // Clé en texte (évite qu'un grand entier devienne « 1.2e+06 » en JSON)
        QVariantMap pkm = QJsonDocument::fromJson(q.value(3).toString().toUtf8()).object().toVariantMap();
        foreach (const QString &k, pkm.keys()) {
            QVariant v = pkm[k];
            if (v.type() == QVariant::Double && v.toDouble() == (double)(qlonglong)v.toDouble())
                pkm[k] = QString::number((qlonglong)v.toDouble());
            else if (!v.isNull())
                pkm[k] = v.toString();
        }
        e["pk"] = pkm;
        e["quand"] = q.value(4).toDateTime().toString("yyyy-MM-dd HH:mm:ss");
        if (!parCle.contains(cle)) ordre << cle;
        parCle[cle] = e;
    }
    QVariantList changes;
    foreach (const QString &cle, ordre) {
        QVariantMap e = parCle[cle];
        QString t = e["tbl"].toString();
        QVariantMap pk = e["pk"].toMap();
        QStringList conds;
        foreach (const QString &k, pk.keys()) conds << QString("`%1` = :%2").arg(k, QString("k%1").arg(conds.size()));
        QSqlQuery r(m_db);
        r.prepare(QString("SELECT * FROM `%1` WHERE %2").arg(t, conds.join(" AND ")));
        int i = 0;
        foreach (const QString &k, pk.keys()) r.bindValue(QString(":k%1").arg(i++), pk[k]);
        QVariantMap ch;
        ch["seq"] = e["id"];
        ch["table"] = t;
        ch["pk"] = pk;
        ch["at"] = e["quand"];
        if (r.exec() && r.next()) {
            QSqlRecord rec = r.record();
            QVariantMap row;
            for (int c = 0; c < rec.count(); ++c) {
                QString n = rec.fieldName(c);
                if (t.toLower() == "operateur" && n.toLower() == "password") continue;
                row[n] = valeurJson(r.value(c));
            }
            if (t.toLower() == "operateur")
                row["sw_mdp_empreinte"] = empreinteMotDePasse(r.value(rec.indexOf("nom")).toString(), r.value(rec.indexOf("password")).toString());
            ch["op"] = "upsert";
            ch["row"] = row;
        } else if (r.lastError().isValid()) {
            continue; // table disparue ou erreur : l'entrée reste dans la file
        } else {
            ch["op"] = "delete";
        }
        changes << ch;
    }
    QJsonObject o;
    o["gen"] = conf("gen").toInt();
    o["file_attente"] = m_enAttente;
    o["changes"] = QJsonArray::fromVariantList(changes);
    signaler(QString::fromUtf8("Synchro web : envoi en cours (%1)").arg(m_enAttente), 1);
    envoyer("/api/sync/v1/envoi", QJsonDocument(o).toJson(QJsonDocument::Compact), "envoi");
}

/* Contrôle de cohérence : nombre de lignes et somme des poids nets par table de pesées. */
void SwSync::envoyerControle()
{
    QVariantList ctl;
    foreach (const QString &t, tablesSuivies()) {
        QVariantMap c;
        c["table"] = t;
        bool pesee = t.toLower().startsWith("pesee_");
        if (pesee) c["colonne_somme"] = "poids_net";
        QSqlQuery q(m_db);
        if (!q.exec(QString("SELECT COUNT(*)%1 FROM `%2`").arg(pesee ? ", COALESCE(SUM(poids_net),0)" : "", t)) || !q.next()) continue;
        QVariantMap p;
        p["periode"] = "total";
        p["nb"] = q.value(0).toLongLong();
        if (pesee) p["somme"] = q.value(1).toLongLong();
        c["periodes"] = QVariantList() << p;
        ctl << c;
    }
    QJsonObject o;
    o["controles"] = QJsonArray::fromVariantList(ctl);
    envoyer("/api/sync/v1/controle", QJsonDocument(o).toJson(QJsonDocument::Compact), "controle");
}

/* ------------------------------------------------------------------ */
/* HTTPS signé                                                        */
/* ------------------------------------------------------------------ */
void SwSync::envoyer(const QString &chemin, const QByteArray &corps, const QString &etape)
{
    qint64 ts = QDateTime::currentMSecsSinceEpoch() / 1000 + m_decalage;
    unsigned char n[16];
    sw_random(n, 16);
    QString nonce = QString::fromLatin1(QByteArray((const char *)n, 16).toBase64(QByteArray::Base64UrlEncoding | QByteArray::OmitTrailingEquals));
    QByteArray h = QCryptographicHash::hash(corps, QCryptographicHash::Sha256).toHex();
    QByteArray msg = "POST\n" + chemin.toUtf8() + "\n" + QByteArray::number(ts) + "\n" + nonce.toLatin1() + "\n" + h;
    QByteArray sig = QMessageAuthenticationCode::hash(msg, m_secret, QCryptographicHash::Sha256).toHex();

    QNetworkRequest req(QUrl(QString::fromLatin1(URL_PLATEFORME) + chemin));
    QSslConfiguration ssl = QSslConfiguration::defaultConfiguration();
    ssl.setProtocol(QSsl::TlsV1_2);
    ssl.setPeerVerifyMode(QSslSocket::VerifyPeer);   // certificat du serveur obligatoirement valide
    req.setSslConfiguration(ssl);
    req.setHeader(QNetworkRequest::ContentTypeHeader, "application/json");
    req.setRawHeader("X-SW-Site", conf("site_id").toLatin1());
    req.setRawHeader("X-SW-Time", QByteArray::number(ts));
    req.setRawHeader("X-SW-Nonce", nonce.toLatin1());
    req.setRawHeader("X-SW-Signature", sig);
    m_etapeEnCours = etape;
    m_reply = m_net->post(req, corps);
    connect(m_reply, SIGNAL(finished()), this, SLOT(finRequete()));
    QTimer::singleShot(60000, m_reply, SLOT(abort()));
}

void SwSync::finRequete()
{
    QNetworkReply *r = m_reply;
    m_reply = 0;
    if (!r) return;
    int http = r->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
    QByteArray data = r->readAll();
    bool reseau = r->error() != QNetworkReply::NoError && http == 0;
    r->deleteLater();
    if (reseau) {
        m_echecs++;
        int d = qMin(300000, 10000 * (1 << qMin(m_echecs, 5)));
        signaler(QString::fromUtf8("Synchro web : hors ligne (%1 en attente)").arg(m_enAttente), 0);
        planifier(d);
        return;
    }
    QVariantMap rep = QJsonDocument::fromJson(data).object().toVariantMap();
    if (rep.contains("heure_serveur")) {
        qint64 srv = rep["heure_serveur"].toLongLong();
        qint64 loc = QDateTime::currentMSecsSinceEpoch() / 1000;
        if (qAbs(srv - (loc + m_decalage)) > 60) m_decalage = srv - loc;
    }
    traiterReponse(m_etapeEnCours, http, rep);
}

void SwSync::traiterReponse(const QString &etape, int http, const QVariantMap &rep)
{
    QString erreur = rep.value("erreur").toString();
    if (http == 401 && erreur == "horloge_decalee") { planifier(1000); return; }
    if (http == 404 && erreur == "poste_non_active") {
        m_actif = false;
        signaler(QString::fromUtf8("Synchro web : en attente d'activation sur la plateforme"), 1);
        planifier(30000);
        return;
    }
    if (http == 403) {
        m_actif = false;
        signaler(erreur == "exploitant_suspendu" ? QString::fromUtf8("Synchro web : compte suspendu")
                                                 : QString::fromUtf8("Synchro web : poste révoqué"), 0);
        planifier(600000);
        return;
    }
    if (http != 200 || !rep.value("ok").toBool()) {
        m_echecs++;
        signaler(QString::fromUtf8("Synchro web : erreur %1 %2").arg(http).arg(erreur), 0);
        planifier(qMin(300000, 10000 * (1 << qMin(m_echecs, 5))));
        return;
    }
    m_echecs = 0;
    if (etape == "bonjour") {
        m_actif = true;
        if (conf("plateforme_ok") != "1") ecrireConf("plateforme_ok", "1");
        m_derniereVerifTables = 0;
        planifier(100);
    } else if (etape == "schema") {
        m_schemaEnvoye = true;
        planifier(100);
    } else if (etape == "envoi") {
        QVariantList ack = rep.value("acquittes").toList();
        QSet<qlonglong> acq;
        foreach (const QVariant &v, ack) acq.insert(v.toLongLong());
        // Une entrée est retirée si elle, ou une entrée plus récente de la même ligne, a été acquittée.
        QSqlQuery q(m_db);
        q.prepare("SELECT tbl, pk FROM sw_sync_file WHERE id = :id");
        QSet<QString> lignesOk;
        foreach (qlonglong id, acq) {
            q.bindValue(":id", id);
            if (q.exec() && q.next()) lignesOk.insert(q.value(0).toString() + "|" + q.value(1).toString());
        }
        qlonglong maxAck = 0;
        foreach (qlonglong id, acq) maxAck = qMax(maxAck, id);
        QSqlQuery d(m_db);
        d.prepare("DELETE FROM sw_sync_file WHERE id <= :max AND CONCAT(tbl, '|', pk) = :cle");
        foreach (const QString &cle, lignesOk) {
            d.bindValue(":max", maxAck);
            d.bindValue(":cle", cle);
            d.exec();
        }
        if (!rep.value("tables_inconnues").toList().isEmpty()) m_schemaEnvoye = false;
        planifier(acq.isEmpty() ? 5000 : 50);
    } else if (etape == "controle") {
        m_dernierControle = QDateTime::currentMSecsSinceEpoch() / 1000;
        foreach (const QVariant &v, rep.value("ecarts").toList()) {
            QString t = v.toMap().value("table").toString();
            if (t.isEmpty() || tableExclue(t) || !tablesSuivies().contains(t)) continue;
            QSqlQuery q(m_db);
            QString nt = t;
            nt.replace("'", "");
            q.exec(QString("INSERT INTO sw_sync_file (tbl, op, pk, quand) SELECT '%1', 'U', %2, NOW() FROM `%3` AS x")
                       .arg(nt, jsonObjet(clePrimaire(t), "x"), t));
        }
        planifier(1000);
    } else {
        planifier(5000);
    }
}
