import { NextRequest, NextResponse } from "next/server";
import { getWd2FromSession } from "@/lib/wd2-auth";
import { markNotificationRead } from "@/lib/graduation";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const wd2 = await getWd2FromSession();
  if (!wd2) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await markNotificationRead(id);
  return NextResponse.json({ status: "ok" });
}
