import type { TimeSlot } from "@/data/schedule";

export const DAY_START_MIN = 8 * 60; // 08:00
export const DAY_END_MIN = 24 * 60; // allow pushed slots to stay visible later in the day
export const SNAP_MIN = 5;
export const MIN_SLOT_LEN = 5;

export function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function toTime(min: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, Math.round(min)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function snap(min: number): number {
  return Math.round(min / SNAP_MIN) * SNAP_MIN;
}

function cloneSlots(slots: TimeSlot[]) {
  return slots.map((slot) => ({ ...slot }));
}

function slotDuration(slot: TimeSlot) {
  return toMin(slot.end) - toMin(slot.start);
}

function mergeBookable(slots: TimeSlot[]): TimeSlot[] {
  const sorted = [...slots].sort((a, b) => toMin(a.start) - toMin(b.start));
  const out: TimeSlot[] = [];

  for (const slot of sorted) {
    const last = out[out.length - 1];
    if (
      last &&
      last.activity === "BOKNINGSBAR" &&
      slot.activity === "BOKNINGSBAR" &&
      last.end === slot.start
    ) {
      last.end = slot.end;
    } else {
      out.push({ ...slot });
    }
  }

  return out;
}

function normalizeAndFillDay(slots: TimeSlot[]) {
  const sorted = [...slots]
    .filter((slot) => toMin(slot.end) > toMin(slot.start))
    .sort((a, b) => toMin(a.start) - toMin(b.start));

  if (sorted.length === 0) {
    return [{ start: toTime(DAY_START_MIN), end: toTime(DAY_END_MIN), activity: "BOKNINGSBAR" }];
  }

  const out: TimeSlot[] = [];
  let cursor = DAY_START_MIN;

  for (const slot of sorted) {
    const start = Math.max(cursor, toMin(slot.start));
    const end = Math.max(start + MIN_SLOT_LEN, toMin(slot.end));

    if (start > cursor) {
      out.push({ start: toTime(cursor), end: toTime(start), activity: "BOKNINGSBAR" });
    }

    out.push({
      ...slot,
      start: toTime(start),
      end: toTime(end),
    });

    cursor = end;
  }

  if (cursor < DAY_END_MIN) {
    out.push({ start: toTime(cursor), end: toTime(DAY_END_MIN), activity: "BOKNINGSBAR" });
  }

  return mergeBookable(out);
}

function pushFollowingSlots(slots: TimeSlot[], changedIndex: number) {
  const arr = cloneSlots(slots).sort((a, b) => toMin(a.start) - toMin(b.start));
  const changed = arr[changedIndex];
  if (!changed) return normalizeAndFillDay(arr);

  let previousEnd = toMin(changed.end);

  for (let i = changedIndex + 1; i < arr.length; i += 1) {
    const current = arr[i];
    const duration = Math.max(MIN_SLOT_LEN, slotDuration(current));
    const currentStart = toMin(current.start);

    if (currentStart < previousEnd) {
      current.start = toTime(previousEnd);
      current.end = toTime(previousEnd + duration);
    }

    previousEnd = toMin(current.end);
  }

  return normalizeAndFillDay(arr);
}

function replaceWithBookable(slots: TimeSlot[], index: number) {
  const arr = cloneSlots(slots);
  const target = arr[index];
  if (!target) return normalizeAndFillDay(arr);

  arr[index] = {
    start: target.start,
    end: target.end,
    activity: "BOKNINGSBAR",
  };

  return normalizeAndFillDay(arr);
}

export function resizeSlot(
  slots: TimeSlot[],
  index: number,
  newStartMin: number,
  newEndMin: number,
): TimeSlot[] {
  const arr = cloneSlots(slots).sort((a, b) => toMin(a.start) - toMin(b.start));
  const target = arr[index];
  if (!target) return slots;

  let start = Math.max(DAY_START_MIN, snap(newStartMin));
  let end = Math.max(start + MIN_SLOT_LEN, snap(newEndMin));

  const prev = arr[index - 1];
  if (prev && toMin(prev.end) > start) {
    prev.end = toTime(start);
  }

  target.start = toTime(start);
  target.end = toTime(end);

  return pushFollowingSlots(arr, index);
}

export function moveSlot(
  slots: TimeSlot[],
  index: number,
  newStartMin: number,
): TimeSlot[] {
  const target = slots[index];
  if (!target) return slots;

  const duration = Math.max(MIN_SLOT_LEN, slotDuration(target));
  const start = Math.max(DAY_START_MIN, snap(newStartMin));
  return resizeSlot(slots, index, start, start + duration);
}

export function moveSlotToDay(
  fromSlots: TimeSlot[],
  fromIndex: number,
  toSlots: TimeSlot[],
  newStartMin: number,
): { from: TimeSlot[]; to: TimeSlot[] } {
  const target = fromSlots[fromIndex];
  if (!target) return { from: fromSlots, to: toSlots };

  const from = replaceWithBookable(fromSlots, fromIndex);
  const inserted = cloneSlots(toSlots).sort((a, b) => toMin(a.start) - toMin(b.start));
  inserted.push({ ...target });
  inserted.sort((a, b) => toMin(a.start) - toMin(b.start));
  const insertedIndex = inserted.findIndex(
    (slot) =>
      slot.activity === target.activity &&
      slot.start === target.start &&
      slot.end === target.end,
  );

  const duration = Math.max(MIN_SLOT_LEN, slotDuration(target));
  const start = Math.max(DAY_START_MIN, snap(newStartMin));
  const to = resizeSlot(inserted, insertedIndex, start, start + duration);

  return { from, to };
}

export function insertSlot(
  slots: TimeSlot[],
  newStartMin: number,
  newEndMin: number,
  activity = "Nytt pass",
): TimeSlot[] {
  let start = Math.max(DAY_START_MIN, snap(newStartMin));
  let end = Math.max(start + MIN_SLOT_LEN, snap(newEndMin));

  const arr = cloneSlots(slots).sort((a, b) => toMin(a.start) - toMin(b.start));
  arr.push({ start: toTime(start), end: toTime(end), activity });
  arr.sort((a, b) => toMin(a.start) - toMin(b.start));

  const index = arr.findIndex(
    (slot) => slot.start === toTime(start) && slot.end === toTime(end) && slot.activity === activity,
  );

  return pushFollowingSlots(arr, index);
}
