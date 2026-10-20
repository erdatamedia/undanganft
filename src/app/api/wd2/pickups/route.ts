import { NextRequest, NextResponse } from "next/server";
import { getReviewerFromSession } from "@/lib/wd2-auth";
import { listPickups, type PaymentRecord } from "@/lib/graduation";

const slim = (p: PaymentRecord | null) =>
  p ? { ...p, proof: p.proof ? `/api/wd2/image/payment/${p.id}?v=${encodeURIComponent(p.uploadedAt ?? "")}` : null } : null;

export async function GET(req: NextRequest) {
  const reviewer = await getReviewerFromSession();
  if (!reviewer) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const status = new URL(req.url).searchParams.get("status");
  const filter = status === "pending" || status === "valid" || status === "issue" ? status : undefined;
  const pickups = (await listPickups(filter)).map((pk) => ({
    ...pk,
    handoverPhoto: pk.handoverPhoto ? `/api/wd2/image/handover/${pk.id}?v=${encodeURIComponent(pk.handedAt)}` : null,
    payments: { fakultas: slim(pk.payments.fakultas), univ: slim(pk.payments.univ) },
  }));
  return NextResponse.json({ pickups });
}
