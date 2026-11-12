// Test de bout en bout de l'activation : super admin, collage du code, connexion de l'exploitant.
// Usage : node tests/e2e-activation.mjs <code_activation> <dossier_captures>
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";

const [, , code, out = "."] = process.argv;
const B = "http://localhost:3100";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });

await page.goto(B + "/admin/login");
if (page.url().includes("/admin/setup")) {
  await page.fill("input[name=token]", process.env.SETUP_TOKEN);
  await page.fill("input[name=login]", "ken");
  await page.fill("input[name=pwd]", "MotDePasseTest!1");
  await page.fill("input[name=pwd2]", "MotDePasseTest!1");
  await page.click("button");
  await page.waitForURL(/admin\/login/);
}
await page.fill("input[name=login]", "ken");
await page.fill("input[name=pwd]", "MotDePasseTest!1");
await page.click("button");
await page.waitForURL(B + "/admin");
await page.goto(B + "/admin/nouveau");
await page.fill("textarea[name=code]", code);
await page.click("button:has-text('Lire le code')");
await page.waitForSelector("text=Vérifiez les informations");
await page.screenshot({ path: `${out}/02-verif.png`, fullPage: true });
await page.click("button:has-text('Valider et créer')");
await page.waitForSelector("text=Code entreprise à remettre");
await page.screenshot({ path: `${out}/03-fini.png`, fullPage: true });
const txt = await page.locator(".code").allInnerTexts();
const expCode = txt[0].trim();
const pwd = txt[1].match(/Mot de passe : (\S+)/)[1];
console.log(JSON.stringify({ expCode, pwd }));
await browser.close();
