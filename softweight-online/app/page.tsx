import { redirect } from "next/navigation";
import Foot from "@/components/Foot";

async function go(fd: FormData) {
  "use server";
  const code = String(fd.get("code") ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9-]{3,20}$/.test(code)) redirect("/?err=1");
  redirect(`/e/${encodeURIComponent(code)}`);
}

export default async function Home({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      <div className="center">
        <div className="card wm login">
          <div className="head">
            <img src="/softweight.svg" alt="SoftWEIGHT" />
            <h1 style={{ marginTop: 8 }}>SoftWEIGHT Online</h1>
            <p className="muted">Consultez vos pesées partout, en temps réel.</p>
          </div>
          {sp.err && <div className="alert err">Code entreprise invalide.</div>}
          <form action={go}>
            <label htmlFor="code">Code entreprise</label>
            <input id="code" name="code" placeholder="ex. KT-4821" autoComplete="organization" autoFocus required />
            <div style={{ marginTop: 14 }}>
              <button className="btn amber" style={{ width: "100%", justifyContent: "center" }}>Continuer</button>
            </div>
          </form>
          <p className="small muted" style={{ marginTop: 14 }}>Le code entreprise vous est remis par KENJITECH.</p>
          <div style={{ borderTop: "1px solid #E3EAF1", marginTop: 16, paddingTop: 14, textAlign: "center" }}>
            <a className="btn ghost" href="/verifier" style={{ width: "100%", justifyContent: "center" }}>Vérifier un ticket (sans compte)</a>
            <p className="small muted" style={{ margin: "6px 0 0" }}>Scannez le QR code d'un ticket pour savoir s'il est authentique.</p>
          </div>
        </div>
      </div>
      <Foot />
    </>
  );
}
