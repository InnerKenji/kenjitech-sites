import { NextResponse } from "next/server";
import { closeSession } from "@/lib/session";

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  await closeSession("user");
  return NextResponse.redirect(new URL(`/e/${encodeURIComponent(code)}`, req.url));
}
