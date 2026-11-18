"use client";

export default function PrintButton({ label = "Imprimer / PDF" }: { label?: string }) {
  return (
    <button className="btn sm amber" onClick={() => window.print()}>
      {label}
    </button>
  );
}
