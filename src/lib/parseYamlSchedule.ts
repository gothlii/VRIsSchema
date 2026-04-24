import yaml from "js-yaml";
import { type WeekSchedule, type TimeSlot } from "@/data/schedule";

const dayMap: Record<string, string> = {
  monday: "Måndag",
  tuesday: "Tisdag",
  wednesday: "Onsdag",
  thursday: "Torsdag",
  friday: "Fredag",
  saturday: "Lördag",
  sunday: "Söndag",
  måndag: "Måndag",
  tisdag: "Tisdag",
  onsdag: "Onsdag",
  torsdag: "Torsdag",
  fredag: "Fredag",
  lördag: "Lördag",
  söndag: "Söndag",
};

// Supports both formats:
//   { start: "16:00", end: "16:50", title: "U13" }
//   { time: "16:00-16:50", activity: "U13" }
type YamlSlot = {
  start?: string;
  end?: string;
  title?: string;
  time?: string;
  activity?: string;
  note?: string;
};

// A day can be either an array of slots, or an object with a `blocks` array
type YamlDay = YamlSlot[] | { blocks?: YamlSlot[]; date?: string; exceptions?: string[] };

type YamlSchedule = {
  week?: number | string;
  venue?: string;
  rink?: string;
  notes?: string[];
  schedule?: Record<string, YamlDay>;
};

function normalizeSlot(s: YamlSlot): TimeSlot | null {
  if (!s || typeof s !== "object") return null;

  let start = s.start;
  let end = s.end;
  let title = s.title ?? s.activity;
  if (title && s.note) title = `${title} (${s.note})`;

  if ((!start || !end) && typeof s.time === "string") {
    // Accept "-", "–" (en dash) or "—" (em dash) as separator
    const parts = s.time.split(/\s*[-–—]\s*/);
    if (parts.length === 2) {
      start = parts[0].trim();
      end = parts[1].trim();
    }
  }

  if (!start || !end || !title) return null;
  return { start, end, activity: String(title) };
}

export function parseYamlSchedule(
  text: string
): { weekLabel: string; data: WeekSchedule } | string {
  let parsed: YamlSchedule;
  try {
    parsed = yaml.load(text) as YamlSchedule;
  } catch (e: any) {
    return `Kunde inte tolka YAML: ${e?.message || "okänt fel"}. Kontrollera indrag (använd mellanslag, inte tabbar) och att alla rader under en dag har samma indrag.`;
  }

  try {
    if (!parsed || typeof parsed !== "object") {
      return "Tom eller ogiltig YAML.";
    }
    if (!parsed.schedule || typeof parsed.schedule !== "object") {
      return "Kunde inte hitta 'schedule' i YAML-datan. Kontrollera formatet.";
    }

    const weekLabel = parsed.week ? `Vecka ${parsed.week}` : "Ny vecka";
    const data: WeekSchedule = {};
    const skipped: string[] = [];

    for (const [engDay, dayValue] of Object.entries(parsed.schedule)) {
      const svDay = dayMap[engDay.toLowerCase()];
      if (!svDay) {
        skipped.push(engDay);
        continue;
      }

      // Support both: array of slots, or { blocks: [...] }
      let slots: YamlSlot[] | undefined;
      if (Array.isArray(dayValue)) {
        slots = dayValue;
      } else if (dayValue && typeof dayValue === "object" && Array.isArray((dayValue as any).blocks)) {
        slots = (dayValue as any).blocks;
      }

      if (!slots) {
        skipped.push(engDay);
        continue;
      }

      const normalized: TimeSlot[] = [];
      slots.forEach((s, i) => {
        const slot = normalizeSlot(s);
        if (slot) normalized.push(slot);
        else skipped.push(`${engDay}[${i}]`);
      });

      if (normalized.length > 0) data[svDay] = normalized;
    }

    if (Object.keys(data).length === 0) {
      return `Kunde inte hitta några giltiga dagar/pass. Varje pass behöver antingen 'start'+'end'+'title' eller 'time'+'activity'. ${
        skipped.length ? `Hoppade över: ${skipped.slice(0, 5).join(", ")}` : ""
      }`;
    }

    return { weekLabel, data };
  } catch (e: any) {
    return `Oväntat fel vid tolkning: ${e?.message || "okänt fel"}`;
  }
}
