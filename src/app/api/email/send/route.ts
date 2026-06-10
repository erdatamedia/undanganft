import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import { getEvent, resolveEvent } from "@/lib/event";
import { getAttendee, updateAttendee } from "@/lib/storage";
import { sendInvitationEmail, isEmailConfigured } from "@/lib/email";

export async function POST(req: Request) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!isEmailConfigured()) {
    return NextResponse.json(
      { message: "Konfigurasi email belum lengkap (EMAIL_HOST & EMAIL_PASS diperlukan)." },
      { status: 500 }
    );
  }

  const body = (await req.json()) as { attendeeId?: string };
  if (!body.attendeeId) {
    return NextResponse.json({ message: "attendeeId wajib diisi" }, { status: 400 });
  }

  const attendee = await getAttendee(body.attendeeId);
  if (!attendee) {
    return NextResponse.json({ message: "Data undangan tidak ditemukan" }, { status: 404 });
  }
  if (!attendee.email) {
    return NextResponse.json({ message: "Email peserta belum tersedia." }, { status: 400 });
  }

  const event = (await getEvent(attendee.eventId)) ?? (await resolveEvent());

  await sendInvitationEmail(attendee, event);

  const updated = await updateAttendee(attendee.id, (current) => ({
    ...current,
    emailSent: true,
    sentAt: new Date().toISOString(),
    status: current.status === "draft" ? "sent" : current.status,
  }));

  return NextResponse.json({
    status: "sent",
    message: "Undangan berhasil dikirim via email.",
    attendee: updated,
  });
}
