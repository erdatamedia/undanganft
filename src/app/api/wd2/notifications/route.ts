import { NextResponse } from "next/server";
import { getReviewerFromSession, getWd2FromSession } from "@/lib/wd2-auth";
import { countUnreadNotifications, listNotifications } from "@/lib/graduation";

export async function GET() {
  const wd2 = await getWd2FromSession();
  if (!wd2) {
    // Admin membuka portal reviewer: tidak punya notifikasi WD2, bukan error.
    if (await getReviewerFromSession()) return NextResponse.json({ notifications: [], unread: 0 });
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const [notifications, unread] = await Promise.all([
    listNotifications("wd2", wd2.id),
    countUnreadNotifications("wd2", wd2.id),
  ]);

  return NextResponse.json({ notifications, unread });
}
