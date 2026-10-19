import { NextResponse } from "next/server";
import { signOutWd2 } from "@/lib/wd2-auth";

export async function POST() {
  await signOutWd2();
  return NextResponse.json({ success: true });
}
