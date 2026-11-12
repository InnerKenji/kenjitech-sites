"use client";
import { useActionState } from "react";
import { etape, Etat } from "./actions";

export default function Form() {
  const [st, act, pending] = useActionState<Etat, FormData>(etape, { etape: "saisie" });
  const erreur = (st as { erreur?: string }).erreur;
  if (st.etape === "fini")
    return (
      <div className="card">
        <div className="alert ok">{st.ajout ? "Le poste a été ajouté à l'exploitant" : "L'exploitant a été créé"} : <b>{st.nom}</b>. La liaison est faite : le poste commence la synchronisation dans les secondes qui suivent.</div>
        <p>Code entreprise à remettre au client :</p>
        <div className="code" style={{ fontSize: "1.4rem", textAlign: "center" }}>{st.expCode}</div>
        {st.adminPwd && (
          <>
            <p style={{ marginTop: 16 }}>Compte administrateur web du client (affiché <b>une seule fois</b>, notez-le) :</p>
            <div className="code">Identifiant : admin<br />Mot de passe : {st.adminPwd}</div>
            <p className="small muted">Les opérateurs du poste pourront aussi se connecter avec leurs identifiants habituels dès que leurs comptes seront synchronisés.</p>
          </>
        )}
        <p style={{ marginTop: 16 }}><a className="btn" href="/admin">Retour aux exploitants</a></p>
      </div>
    );
  return (
    <form action={act} className="card wm">
      {erreur && <div className="alert err">{erreur}</div>}
      {st.etape === "saisie" ? (
        <>
          <label htmlFor="code">Code d&apos;activation copié depuis le poste (commence par SWA1-)</label>
          <textarea id="code" name="code" required placeholder="SWA1-..." />
          <input type="hidden" name="action" value="lire" />
          <div style={{ marginTop: 12 }}><button className="btn amber" disabled={pending}>{pending ? "Lecture…" : "Lire le code"}</button></div>
        </>
      ) : (
        <>
          <input type="hidden" name="code" value={st.code} />
          <input type="hidden" name="action" value="activer" />
          <h2>Vérifiez les informations du poste</h2>
          <table className="t" style={{ marginBottom: 12 }}>
            <tbody>{Object.entries(st.resume).map(([k, v]) => <tr key={k}><th style={{ width: 200 }}>{k}</th><td>{v || "—"}</td></tr>)}</tbody>
          </table>
          <label>Rattacher ce poste à</label>
          <select name="cible" defaultValue="nouveau">
            <option value="nouveau">Nouvel exploitant (crée son espace et ses tables)</option>
            {st.exploitants.map((e) => <option key={e.id} value={e.id}>Exploitant existant : {e.code} — {e.nom}</option>)}
          </select>
          <label>Code entreprise souhaité (facultatif, sinon généré automatiquement, ex. KT-4821)</label>
          <input name="code_entreprise" placeholder="KT-…" />
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn amber nogrow" disabled={pending}>{pending ? "Création…" : "Valider et créer"}</button>
            <a className="btn ghost nogrow" href="/admin/nouveau">Annuler</a>
          </div>
        </>
      )}
    </form>
  );
}
