import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import { listDuplicateGroups, mergeAttendees } from "@/lib/graduation";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromSession();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  return NextResponse.json({ groups: await listDuplicateGroups(id) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromSession();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { keepId?: string; removeId?: string };
  if (!body.keepId || !body.removeId) {
    return NextResponse.json({ message: "keepId dan removeId wajib diisi." }, { status: 400 });
  }
  try {
    await mergeAttendees(id, body.keepId, body.removeId);
    return NextResponse.json({ status: "merged" });
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 });
  }
}
