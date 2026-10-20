import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import {
  createMahasiswa,
  findActiveEvent,
  findMahasiswaByNpm,
  getMahasiswaById,
  normalizeNpm,
  setMahasiswaPasswordHash,
  type MahasiswaRecord,
} from "@/lib/graduation";

const SESSION_COOKIE = "mahasiswa_session";

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function getMahasiswaFromSession(): Promise<MahasiswaRecord | null> {
  const cookieStore = await Promise.resolve(cookies());
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  if (!session) return null;
  return getMahasiswaById(session);
}

export async function requireMahasiswa(): Promise<MahasiswaRecord> {
  const mhs = await getMahasiswaFromSession();
  if (!mhs) {
    redirect("/mahasiswa/login");
  }
  return mhs;
}

export async function registerMahasiswa(payload: {
  npm: string;
  name: string;
  email: string;
}): Promise<{ mahasiswa: MahasiswaRecord; password: string; eventId: string }> {
  const npm = normalizeNpm(payload.npm);
  const name = payload.name.trim();
  const email = payload.email.trim();

  if (!npm || !name || !email) {
    throw new Error("Nama, NPM, dan email wajib diisi.");
  }

  const active = await findActiveEvent();
  if (!active) {
    throw new Error("Tidak ada acara aktif untuk pendaftaran saat ini.");
  }

  const existing = await findMahasiswaByNpm(npm);
  if (existing) {
    throw new Error(
      "NPM ini sudah terdaftar. Jika lupa password, silakan hubungi panitia untuk reset."
    );
  }

  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, 10);
  const mahasiswa = await createMahasiswa({ npm, name, email, passwordHash });

  return { mahasiswa, password, eventId: active.eventId };
}

export async function signInMahasiswa(npm: string, password: string): Promise<MahasiswaRecord> {
  const row = await findMahasiswaByNpm(npm);
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
    maxAge: 60 * 60 * 24 * 7,
  });

  return { id: row.id, npm: row.npm, name: row.name, email: row.email, createdAt: row.created_at };
}

export async function signOutMahasiswa() {
  const cookieStore = await Promise.resolve(cookies());
  cookieStore.delete(SESSION_COOKIE);
}

/** Admin-assisted password reset: generates and sets a new password, returns it once. */
export async function resetMahasiswaPassword(npm: string): Promise<{ password: string }> {
  const row = await findMahasiswaByNpm(npm);
  if (!row) {
    throw new Error("Mahasiswa dengan NPM tersebut tidak ditemukan.");
  }
  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, 10);
  await setMahasiswaPasswordHash(row.id, passwordHash);
  return { password };
}

/** Admin desk walk-in: creates the account directly (no eligible list), returns the generated password once. */
export async function registerMahasiswaByAdmin(payload: {
  npm: string;
  name: string;
  email?: string;
}): Promise<{ mahasiswa: MahasiswaRecord; password: string }> {
  const npm = normalizeNpm(payload.npm);
  const name = payload.name.trim();
  if (!npm || !name) {
    throw new Error("Nama dan NPM wajib diisi.");
  }
  const existing = await findMahasiswaByNpm(npm);
  if (existing) {
    throw new Error("NPM ini sudah terdaftar. Cari lewat kolom pencarian.");
  }
  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, 10);
  const mahasiswa = await createMahasiswa({ npm, name, email: payload.email?.trim() || "", passwordHash });
  return { mahasiswa, password };
}
