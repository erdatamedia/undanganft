import { NextResponse } from "next/server";
import { getReviewerFromSession } from "@/lib/wd2-auth";
import { listReviewQueue, type PaymentRecord } from "@/lib/graduation";

const slim = (p: PaymentRecord | null) =>
  p ? { ...p, proof: p.proof ? `/api/wd2/image/payment/${p.id}?v=${encodeURIComponent(p.uploadedAt ?? "")}` : null } : null;

export async function GET() {
  const reviewer = await getReviewerFromSession();
  if (!reviewer) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const queue = (await listReviewQueue()).map((q) => ({
    ...q,
    payments: { fakultas: slim(q.payments.fakultas), univ: slim(q.payments.univ) },
  }));
  return NextResponse.json({ queue, reviewer: { type: reviewer.type, label: reviewer.label } });
}
