import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { findWd2ByEmail, getWd2ById, type ReviewerType, type Wd2AccountRecord } from "@/lib/graduation";
import { getUserFromSession } from "@/lib/auth";

const SESSION_COOKIE = "wd2_session";

export async function getWd2FromSession(): Promise<Wd2AccountRecord | null> {
  const cookieStore = await Promise.resolve(cookies());
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  if (!session) return null;
  return getWd2ById(session);
}

export async function requireWd2(): Promise<Wd2AccountRecord> {
  const wd2 = await getWd2FromSession();
  if (!wd2) {
    redirect("/wd2/login");
  }
  return wd2;
}

export async function signInWd2(email: string, password: string): Promise<Wd2AccountRecord> {
  const row = await findWd2ByEmail(email);
  if (!row) {
    throw new Error("Akun tidak ditemukan");
  }
  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) {
    throw new Error("Password salah");
  }

  const cookieStore = await Promise.resolve(cookies());
  cookieStore.set(SESSION_COOKIE, row.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  return { id: row.id, email: row.email, createdAt: row.created_at };
}

export async function signOutWd2() {
  const cookieStore = await Promise.resolve(cookies());
  cookieStore.delete(SESSION_COOKIE);
}

export type Reviewer = { type: ReviewerType; id: string; label: string };

/** WD2 or admin (admin has every role). */
export async function getReviewerFromSession(): Promise<Reviewer | null> {
  const wd2 = await getWd2FromSession();
  if (wd2) return { type: "wd2", id: wd2.id, label: wd2.email };
  const admin = await getUserFromSession();
  if (admin) return { type: "admin", id: admin.id, label: admin.email };
  return null;
}

export async function requireReviewer(): Promise<Reviewer> {
  const reviewer = await getReviewerFromSession();
  if (!reviewer) {
    redirect("/wd2/login");
  }
  return reviewer;
}
