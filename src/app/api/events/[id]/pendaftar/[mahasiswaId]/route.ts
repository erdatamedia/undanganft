import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import { deleteMahasiswaAccount } from "@/lib/graduation";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; mahasiswaId: string }> }
) {
  const user = await getUserFromSession();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { mahasiswaId } = await params;
  const ok = await deleteMahasiswaAccount(mahasiswaId).catch(() => false);
  if (!ok) return NextResponse.json({ message: "Akun tidak ditemukan atau gagal dihapus." }, { status: 404 });
  return NextResponse.json({ status: "deleted" });
}
