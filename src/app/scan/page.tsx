import { redirect } from "next/navigation";
import { resolveEvent } from "@/lib/event";

export const dynamic = "force-dynamic";

/** /scan lama: arahkan ke layar scanner acara aktif (satu tampilan untuk semua). */
export default async function ScanRedirect() {
  const event = await resolveEvent();
  redirect(`/events/${event.id}/scan`);
}
