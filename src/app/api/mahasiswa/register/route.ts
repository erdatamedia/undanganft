import { NextResponse } from "next/server";
import { registerMahasiswa } from "@/lib/mahasiswa-auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    npm?: string;
    name?: string;
    email?: string;
  };

  if (!body.npm || !body.name || !body.email) {
    return NextResponse.json(
      { message: "Nama, NPM, dan email wajib diisi." },
      { status: 400 }
    );
  }

  try {
    const { password } = await registerMahasiswa({
      npm: body.npm,
      name: body.name,
      email: body.email,
    });
    return NextResponse.json({
      message: "Pendaftaran berhasil. Simpan password berikut, ini hanya ditampilkan sekali.",
      password,
    });
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 });
  }
}
