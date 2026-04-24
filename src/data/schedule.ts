export type SlotCategory = "booking" | "public" | "team" | "maintenance" | "match" | "school" | "event";

export type TimeSlot = {
  start: string;
  end: string;
  activity: string;
  category?: SlotCategory;
};

export type WeekSchedule = Record<string, TimeSlot[]>;

const toSlots = (raw: [string, string, string][]): TimeSlot[] =>
  raw.map(([start, end, activity]) => ({ start, end, activity }));

export const week18: WeekSchedule = {
  Måndag: toSlots([
    ["08:00","14:00","BOKNINGSBAR"],
    ["14:00","15:00","Allmänhet (med klubba/puck)"],
    ["15:00","15:50","Allmänhet (utan klubba/puck)"],
    ["15:50","16:00","Spolning"],
    ["16:00","16:50","VR A-lag"],
    ["16:50","17:00","Spolning"],
    ["17:00","17:50","U8 + U9 (delad is)"],
    ["17:50","18:00","Spolning"],
    ["18:00","18:50","U10 + U11 (delad is)"],
    ["18:50","19:00","Spolning"],
    ["19:00","19:50","U13 (helplan)"],
    ["19:50","20:00","Spolning"],
    ["20:00","20:50","BJ (helplan)"],
    ["20:50","22:00","BOKNINGSBAR"],
  ]),
  Tisdag: toSlots([
    ["08:00","14:00","BOKNINGSBAR"],
    ["14:00","15:00","Allmänhet (utan klubba/puck)"],
    ["15:00","15:50","Allmänhet (med klubba/puck)"],
    ["15:50","16:00","Spolning"],
    ["16:00","16:50","VR A-lag"],
    ["16:50","17:00","Spolning"],
    ["17:00","17:50","Hockeyskolan"],
    ["17:50","18:00","Spolning"],
    ["18:00","18:50","Hockeyskolan"],
    ["18:50","19:00","Spolning"],
    ["19:00","19:50","U14 (helplan)"],
    ["19:50","20:00","Spolning"],
    ["20:00","20:50","U16 (helplan)"],
    ["20:50","22:00","BOKNINGSBAR"],
  ]),
  Onsdag: toSlots([
    ["08:00","14:00","BOKNINGSBAR"],
    ["14:00","15:00","Allmänhet (med klubba/puck)"],
    ["15:00","15:50","Allmänhet (utan klubba/puck)"],
    ["15:50","16:00","Spolning"],
    ["16:00","16:50","U12"],
    ["16:50","17:00","Spolning"],
    ["17:00","17:30","BOKNINGSBAR"],
    ["17:30","18:00","Isvård (inför match)"],
    ["18:00","19:00","Värmning på is (VR A-lag)"],
    ["19:00","22:00","MATCH: VR A-lag – Hudiksvall (hela isen)"],
    ["22:00","22:10","Spolning"],
  ]),
  Torsdag: toSlots([
    ["08:00","14:00","BOKNINGSBAR"],
    ["14:00","15:00","Allmänhet (utan klubba/puck)"],
    ["15:00","15:50","Allmänhet (med klubba/puck)"],
    ["15:50","16:00","Spolning"],
    ["16:00","16:50","VR A-lag"],
    ["16:50","17:00","Spolning"],
    ["17:00","17:50","U15 (helplan)"],
    ["17:50","18:00","Spolning"],
    ["18:00","18:50","U11 + U12 (delad is)"],
    ["18:50","19:00","Spolning"],
    ["19:00","19:50","U13 (helplan)"],
    ["19:50","20:00","Spolning"],
    ["20:00","20:50","BJ (helplan)"],
    ["20:50","22:00","BOKNINGSBAR"],
  ]),
  Fredag: toSlots([
    ["08:00","14:00","BOKNINGSBAR"],
    ["14:00","15:00","Allmänhet (med klubba/puck)"],
    ["15:00","15:50","Allmänhet (utan klubba/puck)"],
    ["15:50","16:00","Spolning"],
    ["16:00","16:50","VR A-lag"],
    ["16:50","17:00","Spolning"],
    ["17:00","17:50","U8 + U9 (delad is)"],
    ["17:50","18:00","Spolning"],
    ["18:00","18:50","U10 + U11 (delad is)"],
    ["18:50","19:00","Spolning"],
    ["19:00","19:50","U14 (helplan)"],
    ["19:50","20:00","Spolning"],
    ["20:00","20:50","U16 (helplan)"],
    ["20:50","22:00","BOKNINGSBAR"],
  ]),
  Lördag: toSlots([
    ["08:00","08:50","Hockeyskolan"],
    ["08:50","09:00","Spolning"],
    ["09:00","09:50","Hockeyskolan"],
    ["09:50","10:00","Spolning"],
    ["10:00","10:50","U12"],
    ["10:50","11:00","Spolning"],
    ["11:00","11:50","U15 (helplan)"],
    ["11:50","12:00","Spolning"],
    ["12:00","12:50","U13 (helplan)"],
    ["12:50","13:00","Spolning"],
    ["13:00","13:50","U14 (helplan)"],
    ["13:50","14:00","Spolning"],
    ["14:00","15:00","Allmänhet (utan klubba/puck)"],
    ["15:00","15:50","Allmänhet (med klubba/puck)"],
    ["15:50","16:00","Spolning"],
    ["16:00","16:50","U16 (helplan)"],
    ["16:50","17:00","Spolning"],
    ["17:00","17:50","BJ (helplan)"],
    ["17:50","22:00","BOKNINGSBAR"],
  ]),
  Söndag: toSlots([
    ["08:00","10:00","BOKNINGSBAR"],
    ["10:00","10:50","VR A-lag"],
    ["10:50","11:00","Spolning"],
    ["11:00","11:50","VR A-lag"],
    ["11:50","12:00","Spolning"],
    ["12:00","12:50","VR A-lag"],
    ["12:50","13:00","Spolning"],
    ["13:00","14:00","BOKNINGSBAR"],
    ["14:00","15:00","Allmänhet (med klubba/puck)"],
    ["15:00","15:50","Allmänhet (utan klubba/puck)"],
    ["15:50","22:00","BOKNINGSBAR"],
  ]),
};

export const week19: WeekSchedule = {
  Måndag: toSlots([
    ["08:00","14:00","BOKNINGSBAR"],
    ["14:00","15:00","Allmänhet (med klubba/puck)"],
    ["15:00","15:50","Allmänhet (utan klubba/puck)"],
    ["15:50","16:00","Spolning"],
    ["16:00","16:50","VR A-lag"],
    ["16:50","17:00","Spolning"],
    ["17:00","17:50","U8 + U9 (delad is)"],
    ["17:50","18:00","Spolning"],
    ["18:00","18:50","U10 + U11 (delad is)"],
    ["18:50","19:00","Spolning"],
    ["19:00","19:50","U13 (helplan)"],
    ["19:50","20:00","Spolning"],
    ["20:00","20:50","BJ (helplan)"],
    ["20:50","22:00","BOKNINGSBAR"],
  ]),
  Tisdag: toSlots([
    ["08:00","14:00","BOKNINGSBAR"],
    ["14:00","15:00","Allmänhet (utan klubba/puck)"],
    ["15:00","15:50","Allmänhet (med klubba/puck)"],
    ["15:50","16:00","Spolning"],
    ["16:00","16:50","VR A-lag"],
    ["16:50","17:00","Spolning"],
    ["17:00","17:50","Hockeyskolan"],
    ["17:50","18:00","Spolning"],
    ["18:00","18:50","Hockeyskolan"],
    ["18:50","19:00","Spolning"],
    ["19:00","19:50","U14 (helplan)"],
    ["19:50","20:00","Spolning"],
    ["20:00","20:50","U16 (helplan)"],
    ["20:50","22:00","BOKNINGSBAR"],
  ]),
  Onsdag: toSlots([
    ["08:00","14:00","BOKNINGSBAR"],
    ["14:00","15:00","Allmänhet (med klubba/puck)"],
    ["15:00","15:50","Allmänhet (utan klubba/puck)"],
    ["15:50","16:00","Spolning"],
    ["16:00","16:50","U12"],
    ["16:50","17:00","Spolning"],
    ["17:00","17:50","U15 (helplan)"],
    ["17:50","19:00","BOKNINGSBAR"],
    ["19:00","22:00","MATCH: VR U15 – Sudret HC U15 (hela isen)"],
    ["22:00","22:10","Spolning"],
  ]),
  Torsdag: toSlots([
    ["08:00","14:00","BOKNINGSBAR"],
    ["14:00","15:00","Allmänhet (utan klubba/puck)"],
    ["15:00","15:50","Allmänhet (med klubba/puck)"],
    ["15:50","16:00","Spolning"],
    ["16:00","16:50","VR A-lag"],
    ["16:50","17:00","Spolning"],
    ["17:00","17:50","U11 + U12 (delad is)"],
    ["17:50","18:00","Spolning"],
    ["18:00","18:50","U13 (helplan)"],
    ["18:50","19:00","Spolning"],
    ["19:00","19:50","U14 (helplan)"],
    ["19:50","20:00","Spolning"],
    ["20:00","20:50","BJ (helplan)"],
    ["20:50","22:00","BOKNINGSBAR"],
  ]),
  Fredag: toSlots([
    ["08:00","14:00","BOKNINGSBAR"],
    ["14:00","15:00","Allmänhet (med klubba/puck)"],
    ["15:00","15:50","Allmänhet (utan klubba/puck)"],
    ["15:50","16:00","Spolning"],
    ["16:00","16:50","VR A-lag"],
    ["16:50","17:00","Spolning"],
    ["17:00","21:00","Skridskodisko (hela isen)"],
    ["21:00","22:00","BOKNINGSBAR"],
  ]),
  Lördag: toSlots([
    ["08:00","08:50","Hockeyskolan"],
    ["08:50","09:00","Spolning"],
    ["09:00","09:50","Hockeyskolan"],
    ["09:50","10:00","Spolning"],
    ["10:00","10:50","U10 + U11 (delad is)"],
    ["10:50","11:00","Spolning"],
    ["11:00","11:50","U8 + U9 (delad is)"],
    ["11:50","12:00","Spolning"],
    ["12:00","12:50","U12"],
    ["12:50","13:00","Spolning"],
    ["13:00","13:50","U15 (helplan)"],
    ["13:50","14:00","Spolning"],
    ["14:00","15:00","Allmänhet (utan klubba/puck)"],
    ["15:00","15:50","Allmänhet (med klubba/puck)"],
    ["15:50","16:00","Spolning"],
    ["16:00","16:50","U16 (helplan)"],
    ["16:50","17:00","Spolning"],
    ["17:00","17:50","U13 (helplan)"],
    ["17:50","18:00","Spolning"],
    ["18:00","18:50","U14 (helplan)"],
    ["18:50","19:00","Spolning"],
    ["19:00","19:50","BJ (helplan)"],
    ["19:50","22:00","BOKNINGSBAR"],
  ]),
  Söndag: toSlots([
    ["08:00","08:50","U16 (helplan)"],
    ["08:50","09:00","Spolning"],
    ["09:00","09:50","U15 (helplan)"],
    ["09:50","14:00","BOKNINGSBAR"],
    ["14:00","15:00","Allmänhet (med klubba/puck)"],
    ["15:00","15:50","Allmänhet (utan klubba/puck)"],
    ["15:50","22:00","BOKNINGSBAR"],
  ]),
};

export const weeks = [
  { label: "Vecka 18", data: week18 },
  { label: "Vecka 19", data: week19 },
];

export const days = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"];

export function getCategory(activityOrSlot: string | TimeSlot | undefined | null): SlotCategory {
  if (activityOrSlot && typeof activityOrSlot === "object" && "activity" in activityOrSlot) {
    if (activityOrSlot.category) return activityOrSlot.category;
    return getCategoryFromActivity(activityOrSlot.activity);
  }
  return getCategoryFromActivity(activityOrSlot as string | undefined | null);
}

function getCategoryFromActivity(activity: string | undefined | null): SlotCategory {
  if (typeof activity !== "string" || !activity) return "booking";
  const lower = activity.toLowerCase();
  if (activity === "BOKNINGSBAR") return "booking";
  if (lower.startsWith("allmänhet")) return "public";
  if (lower === "spolning" || lower.startsWith("isvård")) return "maintenance";
  if (lower.startsWith("match") || lower.includes("match") || lower.startsWith("värmning") || lower.startsWith("uppvärmning")) return "match";
  if (lower === "hockeyskolan") return "school";
  if (lower.startsWith("skridskodisko")) return "event";
  if (lower.includes("a-lagsmatch")) return "match";
  return "team";
}
