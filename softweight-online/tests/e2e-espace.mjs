// Connexion à l'espace exploitant avec un opérateur synchronisé, captures des écrans.
// Usage : node tests/e2e-espace.mjs <code_entreprise> <login> <mot_de_passe> <dossier_captures>
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";

const [, , code, login, pwd, out = "."] = process.argv;
const B = "http://localhost:3100";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
await page.goto(B + "/");
await page.fill("input[name=code]", code);
await page.click("button");
await page.waitForURL(new RegExp(`/e/${code}$`));
await page.screenshot({ path: `${out}/10-connexion.png` });
await page.fill("input[name=login]", login);
await page.fill("input[name=pwd]", pwd);
await page.click("button");
await page.waitForURL(/tableau/);
await page.screenshot({ path: `${out}/11-tableau.png`, fullPage: true });
await page.goto(`${B}/e/${code}/donnees/pesee`);
await page.screenshot({ path: `${out}/12-pesees.png`, fullPage: true });
await page.goto(`${B}/e/${code}/donnees/pesee?sup=1`);
console.log("supprimées:", await page.locator("tbody tr").count());
// isolation : un autre code entreprise ne doit pas être accessible avec cette session
await page.goto(`${B}/e/KT-0000/tableau`);
console.log("autre exploitant ->", page.url());
await browser.close();
