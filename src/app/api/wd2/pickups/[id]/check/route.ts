import { NextRequest, NextResponse } from "next/server";
import { getReviewerFromSession } from "@/lib/wd2-auth";
import { checkPickup, getPickupById } from "@/lib/graduation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const reviewer = await getReviewerFromSession();
  if (!reviewer) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { outcome?: string; note?: string };
  if (body.outcome !== "valid" && body.outcome !== "issue") {
    return NextResponse.json({ message: "outcome harus 'valid' atau 'issue'." }, { status: 400 });
  }
  if (body.outcome === "issue" && !body.note?.trim()) {
    return NextResponse.json({ message: "Catatan wajib diisi untuk status Bermasalah." }, { status: 400 });
  }

  const pickup = await getPickupById(id);
  if (!pickup) {
    return NextResponse.json({ message: "Data serah-terima tidak ditemukan" }, { status: 404 });
  }

  const updated = await checkPickup(
    id,
    { type: reviewer.type, id: reviewer.id },
    body.outcome,
    body.note
  );
  return NextResponse.json({ pickup: updated });
}
