import { redirect } from "next/navigation";
import { adminSession } from "@/lib/session";
import AdminTop from "@/components/AdminTop";
import Foot from "@/components/Foot";
import Form from "./Form";

export const dynamic = "force-dynamic";

export default async function Nouveau() {
  const s = await adminSession();
  if (!s || s.k !== "admin") redirect("/admin/login");
  return (
    <>
      <AdminTop login={s.login} on="new" />
      <main className="wrap" style={{ maxWidth: 860 }}>
        <h1>Activer un poste SoftWEIGHT</h1>
        <p className="muted">Sur le poste, connecté en Superviseur : Configuration → Module web → « Générer le code d&apos;activation ». Copiez le code et collez-le ici. Le code est chiffré et valable 48 heures.</p>
        <Form />
      </main>
      <Foot />
    </>
  );
}
