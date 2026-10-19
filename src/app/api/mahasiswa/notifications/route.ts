import { NextResponse } from "next/server";
import { getMahasiswaFromSession } from "@/lib/mahasiswa-auth";
import { countUnreadNotifications, listNotifications } from "@/lib/graduation";

export async function GET() {
  const mhs = await getMahasiswaFromSession();
  if (!mhs) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const [notifications, unread] = await Promise.all([
    listNotifications("mahasiswa", mhs.id),
    countUnreadNotifications("mahasiswa", mhs.id),
  ]);

  return NextResponse.json({ notifications, unread });
}
