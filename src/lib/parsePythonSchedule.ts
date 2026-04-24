import { type WeekSchedule, type TimeSlot } from "@/data/schedule";

/**
 * Parse Python-style schedule code into a WeekSchedule.
 * Accepts formats like:
 *   "Måndag": [
 *     ("08:00","14:00","BOKNINGSBAR"),
 *   ],
 */
export function parsePythonSchedule(code: string): { weekLabel: string; data: WeekSchedule } | string {
  try {
    // Try to extract a week label like "v18", "Vecka 18", or from function name like "def v18():"
    let weekLabel = "Ny vecka";
    const funcMatch = code.match(/def\s+v(\d+)/);
    const weekMatch = code.match(/[Vv]ecka\s*(\d+)/i);
    if (funcMatch) {
      weekLabel = `Vecka ${funcMatch[1]}`;
    } else if (weekMatch) {
      weekLabel = `Vecka ${weekMatch[1]}`;
    }

    const schedule: WeekSchedule = {};

    // Match each day block: "DayName": [ ... ]
    const dayPattern = /"([^"]+)"\s*:\s*\[([\s\S]*?)\]/g;
    let dayMatch: RegExpExecArray | null;

    while ((dayMatch = dayPattern.exec(code)) !== null) {
      const dayName = dayMatch[1];
      const slotsBlock = dayMatch[2];

      const slots: TimeSlot[] = [];
      // Match tuples: ("HH:MM","HH:MM","Activity text")
      const tuplePattern = /\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)/g;
      let tupleMatch: RegExpExecArray | null;

      while ((tupleMatch = tuplePattern.exec(slotsBlock)) !== null) {
        slots.push({
          start: tupleMatch[1],
          end: tupleMatch[2],
          activity: tupleMatch[3],
        });
      }

      if (slots.length > 0) {
        schedule[dayName] = slots;
      }
    }

    const dayCount = Object.keys(schedule).length;
    if (dayCount === 0) {
      return "Kunde inte hitta några dagar i koden. Kontrollera formatet.";
    }

    return { weekLabel, data: schedule };
  } catch {
    return "Kunde inte tolka koden. Kontrollera formatet.";
  }
}
