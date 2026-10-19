import { NextRequest, NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import { importEligible, listEligible } from "@/lib/graduation";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const eligible = await listEligible(id);
  return NextResponse.json({ eligible });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const payload = (await req.json()) as { npm?: string; name?: string; program?: string };
  if (!payload.npm?.trim() || !payload.name?.trim()) {
    return NextResponse.json({ message: "NPM dan nama wajib diisi." }, { status: 400 });
  }
  const result = await importEligible(id, [
    { npm: payload.npm, name: payload.name, program: payload.program },
  ]);
  return NextResponse.json(result);
}
