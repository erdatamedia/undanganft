import { NextRequest, NextResponse } from "next/server";
import { getReviewerFromSession } from "@/lib/wd2-auth";
import { listPickups } from "@/lib/graduation";

export async function GET(req: NextRequest) {
  const reviewer = await getReviewerFromSession();
  if (!reviewer) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const status = new URL(req.url).searchParams.get("status");
  const filter = status === "pending" || status === "valid" || status === "issue" ? status : undefined;
  const pickups = await listPickups(filter);
  return NextResponse.json({ pickups });
}
