import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import { resetMahasiswaPassword } from "@/lib/mahasiswa-auth";

export async function POST(request: Request) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { npm?: string };
  if (!body.npm?.trim()) {
    return NextResponse.json({ message: "NPM wajib diisi." }, { status: 400 });
  }

  try {
    const { password } = await resetMahasiswaPassword(body.npm);
    return NextResponse.json({ password });
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 404 });
  }
}
