import Scanner from "@/components/Scanner";
import Foot from "@/components/Foot";

export const metadata = {
  title: "Vérifier un ticket · SoftWEIGHT Online",
  description: "Scannez le QR code d'un ticket de pesée SoftWEIGHT pour vérifier qu'il est authentique. Sans compte.",
};

/** Page publique : aucun compte nécessaire. */
export default function Verifier() {
  return (
    <>
      <header className="top">
        <a className="brand" href="/" style={{ color: "inherit", textDecoration: "none" }}>
          <img src="/softweight.svg" alt="" /><span>SoftWEIGHT Online<small>Vérification de ticket</small></span>
        </a>
      </header>
      <main className="wrap" style={{ maxWidth: 640 }}>
        <Scanner />
        <p className="small muted" style={{ textAlign: "center" }}>
          L'image de la caméra reste sur votre appareil : seul le code lu est envoyé pour la vérification.
        </p>
      </main>
      <Foot />
    </>
  );
}
