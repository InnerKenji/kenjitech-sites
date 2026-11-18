"use client";
/*
 * Lecture du QR d'un ticket par la caméra, sans compte.
 * - Détecteur natif du navigateur (BarcodeDetector) quand il existe : aucun téléchargement en plus.
 * - Sinon lecteur jsQR, chargé seulement à ce moment-là (connexions lentes).
 * - Repli « photo du ticket » si la caméra est absente, refusée ou non prise en charge.
 * Dès qu'un QR SoftWEIGHT est lu, on ouvre la page de vérification /v/<jeton> (vérification côté serveur).
 */
import { useCallback, useEffect, useRef, useState } from "react";

type Etat = "demarrage" | "scan" | "erreur" | "ouverture";
type Camera = { id: string; nom: string };
type Lecteur = (src: CanvasImageSource, w: number, h: number) => Promise<string | null>;

const HOTES = ["softweight.kenjitech.org", "softweight-online.vercel.app"];

/** Renvoie le jeton si le texte lu est un lien de vérification SoftWEIGHT, sinon null. */
function jetonDe(texte: string): string | null {
  try {
    const u = new URL(texte.trim());
    if (u.protocol !== "https:" && u.hostname !== "localhost") return null;
    if (!HOTES.includes(u.hostname) && u.hostname !== window.location.hostname) return null;
    const m = u.pathname.match(/^\/v\/([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\/?$/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function messageErreur(e: unknown): string {
  const n = (e as { name?: string })?.name ?? "";
  if (n === "NotAllowedError" || n === "SecurityError")
    return "L'accès à la caméra a été refusé. Autorisez la caméra pour ce site dans les réglages du navigateur, puis réessayez. Vous pouvez aussi prendre le ticket en photo.";
  if (n === "NotFoundError" || n === "OverconstrainedError" || n === "DevicesNotFoundError")
    return "Aucune caméra n'a été détectée sur cet appareil. Vous pouvez choisir une photo du ticket.";
  if (n === "NotReadableError" || n === "TrackStartError")
    return "La caméra est déjà utilisée par une autre application. Fermez-la puis réessayez.";
  return "Impossible d'ouvrir la caméra sur ce navigateur. Vous pouvez choisir une photo du ticket.";
}

export default function Scanner() {
  const video = useRef<HTMLVideoElement>(null);
  const toile = useRef<HTMLCanvasElement | null>(null);
  const flux = useRef<MediaStream | null>(null);
  const lecteur = useRef<Lecteur | null>(null);
  const boucle = useRef<number>(0);
  const occupe = useRef(false);
  const [etat, setEtat] = useState<Etat>("demarrage");
  const [erreur, setErreur] = useState("");
  const [info, setInfo] = useState("");
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [camera, setCamera] = useState("");

  /** Prépare le lecteur : natif si possible, sinon jsQR téléchargé à la demande. */
  const preparerLecteur = useCallback(async (): Promise<Lecteur> => {
    if (lecteur.current) return lecteur.current;
    const BD = (window as unknown as { BarcodeDetector?: { new (o: object): { detect(s: CanvasImageSource): Promise<{ rawValue: string }[]> }; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
    if (BD) {
      try {
        const formats = BD.getSupportedFormats ? await BD.getSupportedFormats() : ["qr_code"];
        if (formats.includes("qr_code")) {
          const d = new BD({ formats: ["qr_code"] });
          lecteur.current = async (src) => {
            const r = await d.detect(src);
            return r.length ? r[0].rawValue : null;
          };
          return lecteur.current;
        }
      } catch {
        /* on passe au lecteur intégré */
      }
    }
    const jsQR = (await import("jsqr")).default;
    lecteur.current = async (src, w, h) => {
      // Image réduite à 720 px de large au plus : lecture rapide même sur un petit téléphone
      const k = Math.min(1, 720 / Math.max(w, 1));
      const cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
      const c = toile.current ?? (toile.current = document.createElement("canvas"));
      c.width = cw;
      c.height = ch;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(src, 0, 0, cw, ch);
      const r = jsQR(ctx.getImageData(0, 0, cw, ch).data, cw, ch, { inversionAttempts: "attemptBoth" });
      return r ? r.data : null;
    };
    return lecteur.current;
  }, []);

  const arreter = useCallback(() => {
    cancelAnimationFrame(boucle.current);
    flux.current?.getTracks().forEach((t) => t.stop());
    flux.current = null;
  }, []);

  /** Un texte a été lu : lien SoftWEIGHT -> page de vérification ; sinon message et on continue. */
  const traiter = useCallback(
    (texte: string) => {
      const j = jetonDe(texte);
      if (!j) {
        setInfo("Ce QR code n'est pas un ticket SoftWEIGHT. Cadrez le QR imprimé sur le ticket de pesée.");
        return false;
      }
      setEtat("ouverture");
      arreter();
      try {
        navigator.vibrate?.(80);
      } catch {}
      window.location.assign(`/v/${j}?scan=1`);
      return true;
    },
    [arreter]
  );

  const demarrer = useCallback(
    async (id?: string) => {
      arreter();
      setErreur("");
      setInfo("");
      setEtat("demarrage");
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setErreur("Ce navigateur ne permet pas d'utiliser la caméra ici. Vous pouvez choisir une photo du ticket.");
        setEtat("erreur");
        return;
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: id
            ? { deviceId: { exact: id }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        flux.current = s;
        const v = video.current!;
        v.srcObject = s;
        await v.play().catch(() => {});
        // Liste des caméras (les noms ne sont connus qu'après l'autorisation)
        const liste = (await navigator.mediaDevices.enumerateDevices())
          .filter((d) => d.kind === "videoinput")
          .map((d, i) => ({ id: d.deviceId, nom: d.label || `Caméra ${i + 1}` }));
        setCameras(liste);
        setCamera(s.getVideoTracks()[0]?.getSettings().deviceId ?? id ?? "");
        setEtat("scan");
        const lire = await preparerLecteur();
        let dernier = 0;
        const tic = async (t: number) => {
          boucle.current = requestAnimationFrame(tic);
          if (occupe.current || t - dernier < 180 || !v.videoWidth) return; // environ 5 lectures par seconde
          dernier = t;
          occupe.current = true;
          try {
            const texte = await lire(v, v.videoWidth, v.videoHeight);
            if (texte) traiter(texte);
          } catch {
            /* image illisible : on continue */
          } finally {
            occupe.current = false;
          }
        };
        boucle.current = requestAnimationFrame(tic);
      } catch (e) {
        setErreur(messageErreur(e));
        setEtat("erreur");
      }
    },
    [arreter, preparerLecteur, traiter]
  );

  useEffect(() => {
    demarrer();
    // Caméra coupée quand la page passe en arrière-plan (batterie), relancée au retour
    const vis = () => {
      if (document.hidden) arreter();
      else if (!flux.current) demarrer(camera || undefined);
    };
    document.addEventListener("visibilitychange", vis);
    return () => {
      document.removeEventListener("visibilitychange", vis);
      arreter();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Repli : photo du ticket (appareil photo du téléphone ou fichier image). */
  async function photo(f: File | undefined) {
    if (!f) return;
    setInfo("Lecture de la photo...");
    const url = URL.createObjectURL(f);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const lire = await preparerLecteur();
      const texte = await lire(img, img.naturalWidth, img.naturalHeight);
      if (!texte) setInfo("Aucun QR code lisible sur cette photo. Reprenez la photo plus près du QR, bien à plat et net.");
      else traiter(texte);
    } catch {
      setInfo("Cette image n'a pas pu être lue.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return (
    <div className="card scan">
      <h2 style={{ marginTop: 0 }}>Vérifier un ticket de pesée</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Cadrez le QR code imprimé sur le ticket. La vérification se fait automatiquement dès qu'il est lu.
      </p>

      {cameras.length > 1 && (
        <div style={{ marginBottom: 10 }}>
          <label htmlFor="cam">Caméra</label>
          <select id="cam" value={camera} onChange={(e) => { setCamera(e.target.value); demarrer(e.target.value); }}>
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </select>
        </div>
      )}

      <div className={`scan-zone ${etat === "scan" ? "actif" : ""}`} hidden={etat === "erreur"}>
        <video ref={video} playsInline muted autoPlay aria-label="Image de la caméra" />
        <div className="scan-cadre" aria-hidden="true" />
        {etat === "demarrage" && <div className="scan-msg">Ouverture de la caméra...</div>}
        {etat === "ouverture" && <div className="scan-msg">QR code lu, vérification...</div>}
      </div>

      {erreur && <div className="alert err" role="alert">{erreur}</div>}
      {info && <div className="alert warn" role="status">{info}</div>}

      <div className="row" style={{ marginTop: 12, flexWrap: "wrap" }}>
        {etat === "erreur" && (
          <button className="btn" type="button" onClick={() => demarrer()}>Réessayer la caméra</button>
        )}
        <label className="btn ghost" style={{ margin: 0 }}>
          Choisir une photo du ticket
          <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => photo(e.target.files?.[0])} />
        </label>
      </div>
    </div>
  );
}
