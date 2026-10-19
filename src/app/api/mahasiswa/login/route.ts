import { NextResponse } from "next/server";
import { signInMahasiswa } from "@/lib/mahasiswa-auth";

export async function POST(request: Request) {
  const { npm, password } = await request.json();
  if (!npm || !password) {
    return NextResponse.json({ message: "NPM dan password wajib diisi." }, { status: 400 });
  }
  try {
    await signInMahasiswa(npm, password);
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 401 });
  }
  return NextResponse.json({ success: true });
}
