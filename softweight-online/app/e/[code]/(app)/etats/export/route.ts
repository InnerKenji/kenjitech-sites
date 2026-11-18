import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getExploitant } from "@/lib/tenant";
import { userSession } from "@/lib/session";
import { chercherPesees, lireFiltres } from "@/lib/pesees";
import { audit } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const e = await getExploitant((await params).code);
  if (!e) return new NextResponse("Introuvable", { status: 404 });
  const s = await userSession(e.code);
  if (!s || s.k !== "user" || s.exp_id !== e.id) return new NextResponse("Non connecté", { status: 401 });
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const f = lireFiltres(sp);
  f.statut = f.statut || "complete";
  const { rows, total, poids } = await chercherPesees(e.schema, f, 200000, 0);

  const wb = new ExcelJS.Workbook();
  wb.creator = "SoftWEIGHT Online, KENJITECH";
  const ws = wb.addWorksheet("Pesées", { views: [{ state: "frozen", ySplit: 4 }] });
  ws.mergeCells("A1:Q1");
  ws.getCell("A1").value = `${e.nom} : état des pesées`;
  ws.getCell("A1").font = { bold: true, size: 15, color: { argb: "FF023D6E" } };
  ws.mergeCells("A2:Q2");
  ws.getCell("A2").value = `Filtres : ${Object.entries(f).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(", ")} · ${total} pesées · ${poids.toLocaleString("fr-FR")} kg net · exporté le ${new Date().toLocaleString("fr-FR", { timeZone: "Africa/Douala" })}`;
  ws.getCell("A2").font = { italic: true, color: { argb: "FF5B6B7B" } };
  const cols: [string, string, number][] = [
    ["N° pesée", "code_pesee", 14], ["N° BL", "num_bl", 12], ["Immatriculation", "num_imma", 15], ["Client", "client_nom", 26],
    ["Produit", "produit_nom", 22], ["Transporteur", "transporteur_nom", 22], ["Fournisseur", "fournisseur_nom", 20], ["Chauffeur", "chauffeur", 18],
    ["Date 1", "date_1", 11], ["Heure 1", "heure_1", 9], ["Poids 1 (kg)", "poids_1", 12], ["Date 2", "date_2", 11], ["Heure 2", "heure_2", 9],
    ["Poids 2 (kg)", "poids_2", 12], ["Net (kg)", "poids_net", 12], ["Site", "magasin", 16], ["Mouvement", "mouvement", 12],
    ["Provenance", "provenance", 16], ["Destination", "destination", 16], ["Conteneur", "conteneur", 14], ["Plomb", "plomb", 12],
    ["Observation", "observation", 24], ["Campagne", "tbl", 14], ["Statut", "statut", 11],
  ];
  const head = ws.getRow(4);
  cols.forEach(([t, , w], i) => {
    const c = head.getCell(i + 1);
    c.value = t;
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF023D6E" } };
    ws.getColumn(i + 1).width = w;
  });
  const num = new Set(["poids_1", "poids_2", "poids_net"]);
  rows.forEach((r, k) => {
    const row = ws.getRow(5 + k);
    cols.forEach(([, key], i) => {
      const v = (r as Record<string, unknown>)[key];
      row.getCell(i + 1).value = v == null ? null : num.has(key) ? Number(v) : key === "tbl" ? String(v).replace(/^pesee_/, "") : String(v);
      if (num.has(key)) row.getCell(i + 1).numFmt = "# ##0";
    });
    if (k % 2) row.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F7FA" } }));
  });
  const tot = ws.getRow(5 + rows.length);
  tot.getCell(1).value = "TOTAL";
  tot.getCell(15).value = poids;
  tot.getCell(15).numFmt = "# ##0";
  tot.font = { bold: true };
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + rows.length, column: cols.length } };

  const buf = await wb.xlsx.writeBuffer();
  await audit(`web:${s.login}`, "export_excel", e.id, { lignes: rows.length });
  const nom = `etat-pesees-${e.code}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(Buffer.from(buf as ArrayBuffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${nom}"`,
      "cache-control": "no-store",
    },
  });
}
