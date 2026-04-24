import { days as weekDays, getCategory, type WeekSchedule } from "@/data/schedule";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Build an XML document representing a single week's schedule.
 * Mirrors the JSON contract used for SQL imports so the format round-trips:
 *   <week label="Vecka 24" sortOrder="240">
 *     <day name="Måndag">
 *       <slot start="16:00" end="17:00" category="team">VR A-lag</slot>
 *       ...
 *     </day>
 *     ...
 *   </week>
 */
export function buildWeekXml(label: string, sortOrder: number, data: WeekSchedule): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    `<week label="${escapeXml(label)}" sortOrder="${sortOrder}">`
  );

  // Use the canonical day order, then append any extra day keys the data may contain.
  const orderedDays = [
    ...weekDays,
    ...Object.keys(data).filter((d) => !weekDays.includes(d)),
  ];

  for (const day of orderedDays) {
    const slots = data[day] || [];
    lines.push(`  <day name="${escapeXml(day)}">`);
    for (const slot of slots) {
      const category = getCategory(slot);
      lines.push(
        `    <slot start="${escapeXml(slot.start)}" end="${escapeXml(slot.end)}" category="${escapeXml(category)}">${escapeXml(slot.activity)}</slot>`
      );
    }
    lines.push(`  </day>`);
  }

  lines.push(`</week>`);
  return lines.join("\n");
}

function sanitizeFilename(label: string): string {
  return label
    .replace(/[^a-zA-Z0-9åäöÅÄÖ_-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "vecka";
}

export function downloadWeekXml(label: string, sortOrder: number, data: WeekSchedule): void {
  const xml = buildWeekXml(label, sortOrder, data);
  const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeFilename(label)}.xml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}