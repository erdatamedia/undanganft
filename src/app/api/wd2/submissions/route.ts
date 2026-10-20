import { NextResponse } from "next/server";
import { getReviewerFromSession } from "@/lib/wd2-auth";
import { listReviewQueue } from "@/lib/graduation";

export async function GET() {
  const reviewer = await getReviewerFromSession();
  if (!reviewer) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const queue = await listReviewQueue();
  return NextResponse.json({ queue, reviewer: { type: reviewer.type, label: reviewer.label } });
}
