import { NextResponse } from "next/server";
import { getWd2FromSession } from "@/lib/wd2-auth";
import { countUnreadNotifications, listNotifications } from "@/lib/graduation";

export async function GET() {
  const wd2 = await getWd2FromSession();
  if (!wd2) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const [notifications, unread] = await Promise.all([
    listNotifications("wd2", wd2.id),
    countUnreadNotifications("wd2", wd2.id),
  ]);

  return NextResponse.json({ notifications, unread });
}
