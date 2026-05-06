import { getCategory, type SlotCategory, type TimeSlot, type WeekSchedule } from "@/data/schedule";

export type TeamFilter = string | null;

export type IndexedSlot = {
  slot: TimeSlot;
  originalIndex: number;
};

const U_TEAM_RE = /\bU\s*0?([8-9]|1[0-6])\b/gi;
const VRU_TEAM_RE = /\bVRU(?:\s+Team)?\s+([0-9]{1,2}(?:\s*[-+&]\s*[0-9]{1,2})*)/gi;
const TEAM_NUMBER_RE = /\bTeam\s+([0-9]{1,2}(?:\s*[-+&]\s*[0-9]{1,2})*)/gi;
const TEAM_NUMBER_PART_RE = /[0-9]{1,2}/g;

const knownTeamOrder = [
  "U8",
  "U9",
  "U10",
  "U11",
  "U12",
  "U13",
  "U14",
  "U15",
  "U16",
  "BJ",
  "VR A-lag",
  "Oldtimers",
];

const ignoredTeamLabels = new Set([
  "bokningsbar",
  "ejtvputtagna",
  "hockeygymnasiet",
  "hockeyskolan",
  "isvard",
  "spolning",
  "spolning?",
  "tvp",
]);

export function getTeamFilterOptions(data: WeekSchedule | undefined): string[] {
  if (!data) return [];

  const options = new Set<string>();

  for (const slots of Object.values(data)) {
    for (const slot of slots ?? []) {
      for (const team of extractTeamsFromActivity(slot.activity, getCategory(slot))) {
        options.add(team);
      }
    }
  }

  return Array.from(options).sort(compareTeamLabels);
}

export function filterSlots(slots: TimeSlot[], activeCategories: Set<SlotCategory>, teamFilter?: TeamFilter): IndexedSlot[] {
  return slots
    .map((slot, originalIndex) => ({ slot, originalIndex }))
    .filter(({ slot }) => {
      if (teamFilter) {
        return matchesTeamFilter(slot.activity, teamFilter);
      }

      return activeCategories.has(getCategory(slot));
    });
}

export function matchesTeamFilter(activity: string, team: string): boolean {
  if (!activity || !team) return false;

  const normalizedTeam = normalizeText(team);
  if (!normalizedTeam) return false;

  if (/^u([8-9]|1[0-6])$/i.test(team)) {
    return matchesUTeam(activity, team);
  }

  if (normalizedTeam === "vralag") {
    const normalizedActivity = normalizeText(activity);
    return /\bVR\s*A[-\s]?lag\b/i.test(activity) || normalizedActivity === "vr" || normalizedActivity.includes("vralagsmatch");
  }

  if (normalizedTeam === "bj") {
    return /\bBJ\b/i.test(activity);
  }

  if (normalizedTeam === "oldtimers") {
    return normalizeText(activity).includes("oldtimers");
  }

  return normalizeText(activity).includes(normalizedTeam);
}

function extractTeamsFromActivity(activity: string, category: SlotCategory) {
  const teams = new Set<string>();
  const normalized = normalizeText(activity);

  for (const match of activity.matchAll(U_TEAM_RE)) {
    teams.add(`U${parseInt(match[1], 10)}`);
  }

  for (const match of activity.matchAll(VRU_TEAM_RE)) {
    addNumberedTeams(teams, match[1]);
  }

  for (const match of activity.matchAll(TEAM_NUMBER_RE)) {
    addNumberedTeams(teams, match[1]);
  }

  if (/\bBJ\b/i.test(activity)) teams.add("BJ");
  if (/\bVR\s*A[-\s]?lag\b/i.test(activity) || normalized === "vr" || normalized.includes("vralagsmatch")) teams.add("VR A-lag");
  if (normalized.includes("oldtimers")) teams.add("Oldtimers");

  const fallback = cleanFallbackTeamLabel(activity);
  if (fallback && (category === "team" || category === "match") && teams.size === 0) {
    teams.add(fallback);
  }

  return Array.from(teams);
}

function addNumberedTeams(teams: Set<string>, value: string) {
  for (const match of value.matchAll(TEAM_NUMBER_PART_RE)) {
    const number = parseInt(match[0], 10);
    if (number >= 8 && number <= 16) {
      teams.add(`U${number}`);
    }
  }
}

function matchesUTeam(activity: string, team: string) {
  const number = parseInt(team.replace(/\D/g, ""), 10);
  if (Number.isNaN(number)) return false;

  U_TEAM_RE.lastIndex = 0;
  for (const match of activity.matchAll(U_TEAM_RE)) {
    if (parseInt(match[1], 10) === number) return true;
  }

  for (const match of activity.matchAll(VRU_TEAM_RE)) {
    if (numberListIncludes(match[1], number)) return true;
  }

  for (const match of activity.matchAll(TEAM_NUMBER_RE)) {
    if (numberListIncludes(match[1], number)) return true;
  }

  return false;
}

function numberListIncludes(value: string, number: number) {
  for (const match of value.matchAll(TEAM_NUMBER_PART_RE)) {
    if (parseInt(match[0], 10) === number) return true;
  }
  return false;
}

function cleanFallbackTeamLabel(activity: string) {
  const label = activity
    .replace(/(^|[^\d])([0-2]?\d)[.:]([0-5]\d)\s*[-–—]\s*([0-2]?\d)[.:]([0-5]\d)(?!\d)/g, "$1")
    .replace(/\bmatch\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^[,.;:!?-]+|[,.;:!?-]+$/g, "")
    .trim();

  const normalized = normalizeText(label);
  if (!label || ignoredTeamLabels.has(normalized)) return "";
  if (label.length > 28) return "";

  return label;
}

function compareTeamLabels(a: string, b: string) {
  const aKnown = knownTeamOrder.indexOf(a);
  const bKnown = knownTeamOrder.indexOf(b);

  if (aKnown >= 0 || bKnown >= 0) {
    if (aKnown < 0) return 1;
    if (bKnown < 0) return -1;
    return aKnown - bKnown;
  }

  return a.localeCompare(b, "sv");
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}
