import { NextRequest, NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";
import { getEvent } from "@/lib/event";
import { readAttendees, updateAttendee } from "@/lib/storage";
import { sendInvitationEmail, isEmailConfigured } from "@/lib/email";

type Body = {
  attendeeIds: string[] | "all";
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id: eventId } = await params;
  const event = await getEvent(eventId);
  if (!event) {
    return NextResponse.json({ message: "Acara tidak ditemukan" }, { status: 404 });
  }

  const body = (await req.json()) as Partial<Body>;
  const allAttendees = await readAttendees(eventId);

  let targets = allAttendees;
  if (body.attendeeIds !== "all" && Array.isArray(body.attendeeIds)) {
    const idSet = new Set(body.attendeeIds);
    targets = allAttendees.filter((a) => idSet.has(a.id));
  }

  // Only send to those with an email
  targets = targets.filter((a) => a.email && a.email.trim());

  const results = { sent: 0, failed: 0, errors: [] as string[] };

  for (const attendee of targets) {
    try {
      await sendInvitationEmail(attendee, event);
      await updateAttendee(attendee.id, (current) => ({
        ...current,
        emailSent: true,
        sentAt: new Date().toISOString(),
        status: current.status === "draft" ? "sent" : current.status,
      }));
      results.sent++;
    } catch (err) {
      results.failed++;
      results.errors.push(`${attendee.name}: ${(err as Error).message}`);
    }
  }

  return NextResponse.json({
    message: `${results.sent} undangan berhasil dikirim${results.failed ? `, ${results.failed} gagal` : ""}.`,
    ...results,
  });
}
