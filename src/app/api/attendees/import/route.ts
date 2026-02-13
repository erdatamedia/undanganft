import { NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { getUserFromSession } from "@/lib/auth";
import { resolveEvent } from "@/lib/event";
import {
  addAttendee,
  clearAttendees,
  normalizeAttendeeId,
  type AttendeePayload,
} from "@/lib/storage";

export async function POST(req: Request) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json(
      { message: "File CSV wajib diunggah." },
      { status: 400 }
    );
  }

  const defaultProgram =
    (formData.get("defaultProgram") as string)?.trim() || "Lainnya";
  const defaultSeat = (formData.get("defaultSeat") as string)?.trim() || "-";
  const selectedEvent = await resolveEvent(
    (formData.get("eventId") as string | null) ?? null
  );

  const text = await file.text();
  let rows: Record<string, string>[] = [];
  try {
    rows = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
      relax_quotes: true,
      delimiter: [",", ";", "\t"],
    }) as Record<string, string>[];

    // Normalisasi nama kolom menjadi snake_case lowercase
    rows = rows.map(
      (r) =>
        Object.fromEntries(
          Object.entries(r).map(([k, v]) => [
            k
              .toLowerCase()
              .trim()
              .replace(/[^a-z0-9]+/g, "_")
              .replace(/^_+|_+$/g, ""),
            v as string,
          ])
        ) as Record<string, string>
    );
  } catch (error) {
    return NextResponse.json(
      { message: `CSV tidak valid: ${(error as Error).message}` },
      { status: 400 }
    );
  }

  await clearAttendees(selectedEvent.id);

  const inserted: string[] = [];
  const errors: { row: number; message: string }[] = [];
  const idCounts = new Map<string, number>();

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] as Record<string, string>;
    const pickValue = (candidates: string[]) => {
      for (const key of candidates) {
        if (row[key]) return row[key];
      }
      return "";
    };

    const nameCandidates = [
      "name",
      "nama",
      "full_name",
      "nama_lengkap",
      "peserta",
      "guest",
    ];
    let name = pickValue(nameCandidates);
    if (!name) {
      name = Object.values(row).find((value) => value?.trim()) ?? "";
    }
    name = name.trim().replace(/\s+/g, " ");

    const emailCandidates = ["email", "email_address", "alamat_email"];
    let email = pickValue(emailCandidates);
    if (!email) {
      email =
        Object.values(row).find(
          (value) => value && value.includes("@")
        ) ?? "";
    }
    email = (email || "").trim();

    const program =
      row.program ||
      row.program_studi ||
      row.prodi ||
      row.prodi_studi ||
      defaultProgram;
    const npm =
      (
        row.npm ||
        row.nomor_pokok_mahasiswa ||
        row.nomor_pokok ||
        row.nomor_induk ||
        "-"
      )
        .toString()
        .trim() || "-";
    const seatSource = row.seat || row.kursi || "";
    const seat =
      seatSource && seatSource.length <= 10
        ? seatSource
        : seatSource
          ? seatSource.slice(0, 10)
          : defaultSeat;

    if (!name || !email) {
      errors.push({
        row: index + 2,
        message: "Kolom name dan email wajib diisi.",
      });
      continue;
    }

    const payload: AttendeePayload = {
      name,
      program,
      phone: "-",
      email,
      npm,
      seat,
      eventId: selectedEvent.id,
    };

    try {
      const baseId = normalizeAttendeeId(`${selectedEvent.id}-${name}`);
      const nextCount = (idCounts.get(baseId) ?? 0) + 1;
      idCounts.set(baseId, nextCount);
      const uniqueId = nextCount === 1 ? baseId : `${baseId}-${nextCount}`;

      const attendee = await addAttendee(payload, selectedEvent.id, uniqueId);
      inserted.push(attendee.id);
    } catch (error) {
      errors.push({
        row: index + 2,
        message: (error as Error).message,
      });
    }
  }

  return NextResponse.json({ inserted: inserted.length, errors });
}
