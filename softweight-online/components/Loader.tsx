"use client";
import { useEffect, useState } from "react";

/** Écran de chargement : logo SoftWEIGHT qui tourne + petit pont-bascule et afficheur qui « pèse ». */
export default function Loader({ texte = "Chargement des pesées…" }: { texte?: string }) {
  const [kg, setKg] = useState(0);
  useEffect(() => {
    let t = 0;
    const id = setInterval(() => {
      t += 1;
      const phase = t % 40;
      setKg(phase < 18 ? Math.round((phase / 18) * 24860) : phase < 30 ? 24860 : Math.max(0, Math.round(24860 - ((phase - 30) / 10) * 24860)));
    }, 80);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="loader" role="status" aria-live="polite">
      <img className="spin" src="/softweight.svg" alt="SoftWEIGHT" />
      <svg className="bridge" viewBox="0 0 220 70" aria-hidden="true">
        <rect x="10" y="52" width="200" height="8" rx="2" fill="#023D6E" />
        <rect x="10" y="60" width="200" height="4" fill="#9FB3C6" />
        <g className="truck">
          <rect x="0" y="26" width="46" height="24" rx="3" fill="#F5A71B" />
          <rect x="46" y="32" width="18" height="18" rx="3" fill="#023D6E" />
          <circle cx="12" cy="51" r="5" fill="#14212E" /><circle cx="34" cy="51" r="5" fill="#14212E" /><circle cx="56" cy="51" r="5" fill="#14212E" />
        </g>
      </svg>
      <div className="lcd">{kg.toLocaleString("fr-FR")} kg</div>
      <div className="muted small">{texte}</div>
    </div>
  );
}
