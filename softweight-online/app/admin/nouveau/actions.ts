"use server";
import { adminSession } from "@/lib/session";
import { activate, readCode } from "@/lib/activation";
import { sql } from "@/lib/db";

export type Etat =
  | { etape: "saisie"; erreur?: string }
  | { etape: "verif"; code: string; resume: Record<string, string>; exploitants: { id: number; code: string; nom: string }[] }
  | { etape: "fini"; expCode: string; adminPwd: string | null; nom: string; ajout: boolean };

export async function etape(prev: Etat, fd: FormData): Promise<Etat> {
  const s = await adminSession();
  if (!s || s.k !== "admin") return { etape: "saisie", erreur: "Session expirée, reconnectez-vous." };
  const code = String(fd.get("code") ?? "").trim();
  const action = String(fd.get("action") ?? "lire");
  try {
    if (action === "lire") {
      const p = readCode(code);
      const ex = await sql()`select id, code, nom from plateforme.exploitants order by nom`;
      return {
        etape: "verif",
        code,
        exploitants: ex.map((e) => ({ id: Number(e.id), code: e.code, nom: e.nom })),
        resume: {
          Entreprise: p.entreprise.nom,
          Téléphone: p.entreprise.telephone ?? "",
          Adresse: [p.entreprise.adresse, p.entreprise.ville, p.entreprise.pays].filter(Boolean).join(", "),
          Magasin: p.magasin ?? "",
          "Pont-bascule": [p.pont_numero, p.pont_nom].filter(Boolean).join(" · "),
          "Code machine": p.code_machine ?? "",
          Licence: p.licence ?? "",
          "Version du logiciel": p.version_logiciel ?? "",
          "Pesées à reprendre": p.nb_pesees != null ? String(p.nb_pesees) : "",
          "Code généré le": new Date(p.cree_le).toLocaleString("fr-FR", { timeZone: "Africa/Douala" }),
        },
      };
    }
    const cible = String(fd.get("cible") ?? "nouveau");
    const r = await activate(code, cible === "nouveau" ? null : Number(cible), s.login, String(fd.get("code_entreprise") ?? "") || undefined);
    return { etape: "fini", expCode: r.expCode, adminPwd: r.adminPwd, nom: r.payload.entreprise.nom, ajout: cible !== "nouveau" };
  } catch (e) {
    if (prev.etape === "verif" && action !== "lire") return { ...prev, etape: "verif" as const, ...{ erreur: (e as Error).message } } as Etat;
    return { etape: "saisie", erreur: (e as Error).message };
  }
}
