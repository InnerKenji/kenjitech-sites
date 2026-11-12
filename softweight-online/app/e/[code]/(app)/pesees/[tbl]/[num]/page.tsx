import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/tenant";
import { unePesee } from "@/lib/pesees";
import { BASE_URL, jeton, qrSvg } from "@/lib/qr";
import { audit } from "@/lib/db";
import UserTop from "@/components/UserTop";
import Ticket from "@/components/Ticket";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function TicketPage({ params, searchParams }: {
  params: Promise<{ code: string; tbl: string; num: string }>;
  searchParams: Promise<{ s?: string; f?: string; dup?: string }>;
}) {
  const { code, tbl, num } = await params;
  const { e, s } = await requireUser(code);
  const sp = await searchParams;
  const table = decodeURIComponent(tbl);
  const numero = decodeURIComponent(num);
  if (!/^pesee_[A-Za-z0-9_]{1,50}$/.test(table)) notFound();
  const site = sp.s && /^[0-9a-f-]{36}$/.test(sp.s) ? sp.s : undefined;
  const p = await unePesee(e.schema, table, numero, site);
  if (!p) notFound();
  const format = sp.f === "bon" ? "bon" : "ticket";
  const dup = sp.dup !== "0";
  const j = await jeton(p.site, p.tbl, String(p.code_pesee), p.poids_net);
  const qr = j ? await qrSvg(`${BASE_URL}/v/${j}`) : null;
  const imprimeLe = new Date().toLocaleString("fr-FR", { timeZone: "Africa/Douala", dateStyle: "short", timeStyle: "medium" }).replace(" ", " à ");
  await audit(s.k === "user" ? `web:${s.login}` : "?", "consultation_ticket", e.id, { table, numero });
  const base = `/e/${e.code}/pesees/${encodeURIComponent(table)}/${encodeURIComponent(numero)}?s=${p.site}`;
  return (
    <>
      <UserTop code={e.code} nom={e.nom} user={s.k === "user" ? s.nom : ""} on="pesees" />
      <main className="wrap">
        <div className="row noprint" style={{ marginBottom: 14, alignItems: "center" }}>
          <Link className="btn sm ghost nogrow" href={`/e/${e.code}/pesees?statut=${p.statut}`}>← Retour</Link>
          <div className="nogrow row" style={{ gap: 6 }}>
            <Link className={`btn sm ${format === "ticket" ? "" : "ghost"}`} href={`${base}&f=ticket${dup ? "" : "&dup=0"}`}>Ticket</Link>
            <Link className={`btn sm ${format === "bon" ? "" : "ghost"}`} href={`${base}&f=bon${dup ? "" : "&dup=0"}`}>Bon de pesée A4</Link>
            <Link className={`btn sm ${dup ? "" : "ghost"}`} href={`${base}&f=${format}${dup ? "&dup=0" : ""}`}>{dup ? "Mention DUPLICATA : oui" : "Mention DUPLICATA : non"}</Link>
            <PrintButton />
          </div>
          {p.statut === "supprimee" && <span className="badge del nogrow">Pesée supprimée sur le poste</span>}
        </div>
        <Ticket p={p} e={e} qr={qr} format={format} duplicata={dup} imprimeLe={imprimeLe} />
      </main>
    </>
  );
}
