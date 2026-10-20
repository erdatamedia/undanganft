import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import { listVideotron } from "@/lib/graduation";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromSession();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  return NextResponse.json({ rows: await listVideotron(id) });
}
