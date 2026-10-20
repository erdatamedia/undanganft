import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import { getVideotronPhotoByNpm } from "@/lib/graduation";

export async function GET(req: Request, { params }: { params: Promise<{ id: string; npm: string }> }) {
  const user = await getUserFromSession();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { npm } = await params;
  const photo = await getVideotronPhotoByNpm(decodeURIComponent(npm));
  const match = photo?.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!match) return NextResponse.json({ message: "Belum ada foto" }, { status: 404 });
  const ext = match[1].split("/")[1].replace("jpeg", "jpg");
  const download = new URL(req.url).searchParams.get("download") === "1";
  return new NextResponse(new Uint8Array(Buffer.from(match[2], "base64")), {
    headers: {
      "Content-Type": match[1],
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${npm}.${ext}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
