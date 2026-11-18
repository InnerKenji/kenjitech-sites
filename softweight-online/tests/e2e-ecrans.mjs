// Parcourt les écrans de l'espace exploitant et fait des captures.
// Usage : node tests/e2e-ecrans.mjs <code_entreprise> <login> <mdp> <dossier>
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";

const [, , code, login, pwd, out = "."] = process.argv;
const B = "http://localhost:3100";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
await page.goto(`${B}/e/${code}`);
await page.fill("input[name=login]", login);
await page.fill("input[name=pwd]", pwd);
await page.click("button");
await page.waitForURL(/tableau/);
const shot = async (url, name) => {
  await page.goto(B + url);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  console.log(name, (await page.title()), page.url().replace(B, ""));
};
await shot(`/e/${code}/tableau`, "20-tableau");
await shot(`/e/${code}/pesees`, "21-pesees");
await shot(`/e/${code}/pesees?statut=attente`, "22-attente");
const lien = await page.locator("a:has-text('Ticket')").first().getAttribute("href").catch(() => null);
await shot(`/e/${code}/pesees`, "21-pesees");
const t = await page.locator("a:has-text('Ticket')").first().getAttribute("href");
await shot(t, "23-ticket");
await shot(t + "&f=bon", "24-bon");
const qrUrl = await page.evaluate(() => null);
await shot(`/e/${code}/etats?du=2026-10-01`, "25-etats");
await shot(`/e/${code}/statistiques`, "26-stats");
await shot(`/e/${code}/tiers?l=clients`, "27-tiers");
// export Excel
const [dl] = await Promise.all([page.waitForEvent("download"), page.goto(`${B}/e/${code}/etats`).then(() => page.click("a:has-text('Exporter en Excel')"))]);
console.log("export:", dl.suggestedFilename(), (await dl.path()) ? "ok" : "échec");
console.log("erreurs JS:", errs.length ? errs : "aucune", lien ? "" : "");
await browser.close();
