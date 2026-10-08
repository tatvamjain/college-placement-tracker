import { api } from "@/lib/api";
import { ROUND_NAMES } from "@/lib/format";

// iCalendar text: one all-day event per scheduled round. Lines end in CRLF, as the spec requires.
function escape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

const compact = (isoDate: string) => isoDate.replaceAll("-", "");

function nextDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: Request, { params }: RouteContext<"/drives/[id]/calendar">) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return new Response("Not found", { status: 404 });
  const drive = await api.drive(id);
  if (drive === null) return new Response("Not found", { status: 404 });

  const origin = process.env.SITE_URL ?? new URL(request.url).origin;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const events = drive.rounds
    .filter((r) => r.scheduled_on)
    .map((r) =>
      [
        "BEGIN:VEVENT",
        `UID:drive-${drive.id}-round-${r.round_order}@placement-board`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${compact(r.scheduled_on!)}`,
        `DTEND;VALUE=DATE:${compact(nextDay(r.scheduled_on!))}`,
        `SUMMARY:${escape(`${drive.company.name}: ${ROUND_NAMES[r.round_type]} (round ${r.round_order})`)}`,
        `DESCRIPTION:${escape(`Live updates: ${origin}/drives/${drive.id}`)}`,
        `URL:${origin}/drives/${drive.id}`,
        "END:VEVENT",
      ].join("\r\n"),
    );

  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Placement Board//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escape(drive.company.name)} drive`,
    ...events,
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  const filename = `${drive.company.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-rounds.ics`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
