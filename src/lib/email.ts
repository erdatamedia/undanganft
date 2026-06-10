import nodemailer from "nodemailer";
import QRCode from "qrcode";
import type { AttendeeRecord } from "@/lib/storage";
import type { EventRecord } from "@/lib/event";

const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = Number(process.env.EMAIL_PORT || "587");
const EMAIL_USER = process.env.EMAIL_USER ?? "";
const EMAIL_PASS = process.env.EMAIL_PASS ?? "";
const EMAIL_FROM =
  process.env.EMAIL_FROM ?? "Fakultas Teknik UNISMA <noreply@ftunisma.ac.id>";
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://undangan.ftunisma.online";

export function isEmailConfigured() {
  return Boolean(EMAIL_HOST && EMAIL_PASS);
}

function buildInviteUrl(token: string) {
  return `${APP_URL}/invite/${encodeURIComponent(token)}`;
}

async function generateQrDataUrl(content: string): Promise<string> {
  return QRCode.toDataURL(content, {
    margin: 2,
    width: 280,
    color: { dark: "#1B4332", light: "#FFFFFF" },
  });
}

function htmlTemplate(
  attendee: AttendeeRecord,
  event: EventRecord,
  inviteUrl: string,
  qrDataUrl: string
): string {
  const gateInfo = event.gate ? `<p style="margin:4px 0;color:#6B7280;font-size:13px;">${event.gate}</p>` : "";
  const timeRange = event.timeEnd
    ? `${event.time} – ${event.timeEnd}`
    : event.time;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Undangan — ${event.name}</title>
</head>
<body style="margin:0;padding:0;background:#F8FAF9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAF9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#1B4332;padding:28px 32px;">
              <p style="margin:0;color:#74C69D;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">Fakultas Teknik</p>
              <h1 style="margin:6px 0 0;color:#FFFFFF;font-size:22px;font-weight:700;line-height:1.3;">Universitas Islam Malang</h1>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.6);font-size:13px;">Undangan Digital Resmi</p>
            </td>
          </tr>
          <!-- Greeting -->
          <tr>
            <td style="padding:28px 32px 0;">
              <p style="margin:0 0 8px;color:#6B7280;font-size:13px;">Kepada Yth,</p>
              <h2 style="margin:0;color:#1A1A2E;font-size:20px;font-weight:700;">${attendee.name}</h2>
              <p style="margin:4px 0 0;color:#40916C;font-size:14px;">${attendee.program}${attendee.npm !== "-" ? ` &bull; ${attendee.npm}` : ""}</p>
            </td>
          </tr>
          <!-- Event details -->
          <tr>
            <td style="padding:20px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAF9;border-radius:12px;padding:20px;">
                <tr>
                  <td>
                    <p style="margin:0 0 12px;color:#1B4332;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Detail Acara</p>
                    <h3 style="margin:0 0 12px;color:#1A1A2E;font-size:16px;font-weight:700;line-height:1.4;">${event.name}</h3>
                    <p style="margin:4px 0;color:#374151;font-size:14px;">📅 ${event.date}</p>
                    <p style="margin:4px 0;color:#374151;font-size:14px;">🕐 ${timeRange}</p>
                    <p style="margin:4px 0;color:#374151;font-size:14px;">📍 ${event.venue}</p>
                    ${gateInfo}
                    ${attendee.seat !== "-" ? `<p style="margin:8px 0 0;color:#40916C;font-size:13px;font-weight:700;">Nomor Kursi: ${attendee.seat}</p>` : ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- QR Code -->
          <tr>
            <td style="padding:0 32px 20px;" align="center">
              <p style="margin:0 0 16px;color:#6B7280;font-size:13px;text-align:center;">Tunjukkan QR ini kepada petugas di meja registrasi</p>
              <div style="display:inline-block;background:#FFFFFF;border:2px solid #E5E7EB;border-radius:12px;padding:16px;">
                <img src="${qrDataUrl}" alt="QR Konfirmasi Kehadiran" width="220" height="220" style="display:block;" />
              </div>
            </td>
          </tr>
          <!-- CTA -->
          <tr>
            <td style="padding:0 32px 28px;" align="center">
              <a href="${inviteUrl}" style="display:inline-block;background:#1B4332;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:14px;padding:14px 32px;border-radius:10px;">
                Buka Halaman Undangan →
              </a>
              <p style="margin:12px 0 0;color:#9CA3AF;font-size:12px;">Simpan tautan ini untuk ditunjukkan saat registrasi:<br/><a href="${inviteUrl}" style="color:#40916C;">${inviteUrl}</a></p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#F8FAF9;padding:16px 32px;border-top:1px solid #E5E7EB;">
              <p style="margin:0;color:#9CA3AF;font-size:11px;text-align:center;">
                Email ini dikirim otomatis oleh Sistem Undangan Digital Fakultas Teknik UNISMA.<br/>
                Jangan membalas email ini secara langsung.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function textFallback(
  attendee: AttendeeRecord,
  event: EventRecord,
  inviteUrl: string
): string {
  const timeRange = event.timeEnd ? `${event.time} – ${event.timeEnd}` : event.time;
  return [
    `Kepada Yth. ${attendee.name}`,
    ``,
    `Anda diundang untuk hadir pada:`,
    ``,
    `${event.name}`,
    `Tanggal : ${event.date}`,
    `Waktu   : ${timeRange}`,
    `Tempat  : ${event.venue}`,
    event.gate ? `Info    : ${event.gate}` : "",
    attendee.seat !== "-" ? `Kursi   : ${attendee.seat}` : "",
    ``,
    `Buka halaman undangan & QR di: ${inviteUrl}`,
    ``,
    `Terima kasih atas kehadiran Anda.`,
    ``,
    `— Panitia Fakultas Teknik UNISMA`,
  ]
    .filter((l) => l !== undefined)
    .join("\n");
}

export async function sendInvitationEmail(
  attendee: AttendeeRecord,
  event: EventRecord
): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error("Konfigurasi SMTP belum lengkap (EMAIL_HOST & EMAIL_PASS diperlukan).");
  }

  const inviteUrl = buildInviteUrl(attendee.token);
  const qrDataUrl = await generateQrDataUrl(inviteUrl);

  const transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_PORT === 465,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });

  await transporter.sendMail({
    from: EMAIL_FROM,
    to: attendee.email,
    subject: `Undangan • ${event.name}`,
    text: textFallback(attendee, event, inviteUrl),
    html: htmlTemplate(attendee, event, inviteUrl, qrDataUrl),
  });
}
