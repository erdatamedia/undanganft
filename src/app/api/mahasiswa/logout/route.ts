import { NextResponse } from "next/server";
import { signOutMahasiswa } from "@/lib/mahasiswa-auth";

export async function POST() {
  await signOutMahasiswa();
  return NextResponse.json({ success: true });
}
