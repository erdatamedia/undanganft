import { NextRequest, NextResponse } from "next/server";
import { getWd2FromSession } from "@/lib/wd2-auth";
import { listSubmissionsByStatusWithMahasiswa, type PaymentStatus } from "@/lib/graduation";

export async function GET(req: NextRequest) {
  const wd2 = await getWd2FromSession();
  if (!wd2) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const status = (new URL(req.url).searchParams.get("status") as PaymentStatus) || "pending";
  const submissions = await listSubmissionsByStatusWithMahasiswa(status);
  return NextResponse.json({ submissions });
}
