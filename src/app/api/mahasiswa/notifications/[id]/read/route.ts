import { NextRequest, NextResponse } from "next/server";
import { getMahasiswaFromSession } from "@/lib/mahasiswa-auth";
import { markNotificationRead } from "@/lib/graduation";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const mhs = await getMahasiswaFromSession();
  if (!mhs) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await markNotificationRead(id);
  return NextResponse.json({ status: "ok" });
}
