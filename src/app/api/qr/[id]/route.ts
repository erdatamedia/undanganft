import { NextRequest } from "next/server";
import QRCode from "qrcode";
import { buildInviteLink, getEvent } from "@/lib/event";
import { getAttendee } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params; // Next.js 16: params adalah Promise
    const attendee = await getAttendee(id);
    const event = attendee ? await getEvent(attendee.eventId) : null;
    const url = buildInviteLink(id, event?.linkPrefix);
    const png = await QRCode.toBuffer(url, {
      errorCorrectionLevel: "M",
      width: 800,
      margin: 2,
      color: { dark: "#000000", light: "#FFFFFF" },
    });

    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ message: "QR generate failed", error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
