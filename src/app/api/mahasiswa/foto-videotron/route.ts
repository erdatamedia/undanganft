import { NextResponse } from "next/server";
import { getMahasiswaFromSession } from "@/lib/mahasiswa-auth";
import { getVideotronPhotoById, setVideotronPhoto } from "@/lib/graduation";

const MAX_LEN = 2_500_000; // ~1.8MB data URI

export async function GET() {
  const mhs = await getMahasiswaFromSession();
  if (!mhs) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ photo: await getVideotronPhotoById(mhs.id) });
}

export async function POST(request: Request) {
  const mhs = await getMahasiswaFromSession();
  if (!mhs) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { photo?: string };
  const photo = body.photo ?? "";
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo)) {
    return NextResponse.json({ message: "Format foto tidak valid (JPEG/PNG/WebP)." }, { status: 400 });
  }
  if (photo.length > MAX_LEN) {
    return NextResponse.json({ message: "Ukuran foto terlalu besar." }, { status: 400 });
  }
  await setVideotronPhoto(mhs.id, photo);
  return NextResponse.json({ photo });
}

export async function DELETE() {
  const mhs = await getMahasiswaFromSession();
  if (!mhs) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  await setVideotronPhoto(mhs.id, null);
  return NextResponse.json({ photo: null });
}
