import { NextResponse } from "next/server";
import { closeSession } from "@/lib/session";

export async function GET(req: Request) {
  await closeSession("admin");
  return NextResponse.redirect(new URL("/admin/login", req.url));
}
