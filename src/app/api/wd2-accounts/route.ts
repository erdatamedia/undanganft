import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUserFromSession } from "@/lib/auth";
import { createWd2Account, listWd2Accounts } from "@/lib/graduation";

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function GET() {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const accounts = await listWd2Accounts();
  return NextResponse.json({ accounts });
}

export async function POST(request: Request) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { email?: string };
  if (!body.email?.trim()) {
    return NextResponse.json({ message: "Email wajib diisi." }, { status: 400 });
  }

  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const account = await createWd2Account({ email: body.email, passwordHash });
    return NextResponse.json({ account, password });
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 });
  }
}
