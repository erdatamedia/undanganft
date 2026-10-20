import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import { registerMahasiswaByAdmin } from "@/lib/mahasiswa-auth";

export async function POST(request: Request) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    npm?: string;
    name?: string;
    email?: string;
  };
  try {
    const { mahasiswa, password } = await registerMahasiswaByAdmin({
      npm: body.npm ?? "",
      name: body.name ?? "",
      email: body.email,
    });
    return NextResponse.json({ mahasiswa, password });
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 });
  }
}
