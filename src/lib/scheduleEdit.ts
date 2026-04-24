import type { TimeSlot } from "@/data/schedule";

export const DAY_START_MIN = 8 * 60; // 08:00
export const DAY_END_MIN = 22 * 60 + 10; // 22:10 (allow late maintenance)
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

function mergeBookable(slots: TimeSlot[]): TimeSlot[] {
  const out: TimeSlot[] = [];
  for (const s of slots) {
    const last = out[out.length - 1];
    if (last && last.activity === "BOKNINGSBAR" && s.activity === "BOKNINGSBAR" && last.end === s.start) {
      last.end = s.end;
    } else {
      out.push({ ...s });
    }
  }
  return out;
}

function fillGaps(slots: TimeSlot[]): TimeSlot[] {
  // Ensure full coverage from DAY_START to last end with BOKNINGSBAR fillers
  if (slots.length === 0) return slots;
  const sorted = [...slots].sort((a, b) => toMin(a.start) - toMin(b.start));
  const out: TimeSlot[] = [];
  let cursor = Math.min(DAY_START_MIN, toMin(sorted[0].start));
  for (const s of sorted) {
    const sStart = toMin(s.start);
    if (sStart > cursor) {
      out.push({ start: toTime(cursor), end: s.start, activity: "BOKNINGSBAR" });
    }
    out.push({ ...s });
    cursor = Math.max(cursor, toMin(s.end));
  }
  return mergeBookable(out);
}

/**
 * Resize one slot: change its start/end. Adjacent slots are pushed/shrunk
 * to keep coverage. If neighbour would shrink below MIN_SLOT_LEN it is removed
 * (turned into bookable / absorbed).
 */
export function resizeSlot(
  slots: TimeSlot[],
  index: number,
  newStartMin: number,
  newEndMin: number,
): TimeSlot[] {
  const arr = slots.map((s) => ({ ...s }));
  const target = arr[index];
  if (!target) return slots;

  let s = snap(newStartMin);
  let e = snap(newEndMin);
  if (e - s < MIN_SLOT_LEN) e = s + MIN_SLOT_LEN;
  s = Math.max(DAY_START_MIN, s);
  e = Math.min(DAY_END_MIN, e);

  target.start = toTime(s);
  target.end = toTime(e);

  // Walk left: shrink/remove neighbours that overlap new start
  for (let i = index - 1; i >= 0; i--) {
    const n = arr[i];
    if (toMin(n.end) <= s) break;
    if (toMin(n.start) >= s) {
      // fully overlapped — remove
      arr.splice(i, 1);
      continue;
    }
    n.end = toTime(s);
    if (toMin(n.end) - toMin(n.start) < MIN_SLOT_LEN) {
      arr.splice(i, 1);
    }
    break;
  }

  // Recompute target index after potential left-removals
  const targetIdx = arr.indexOf(target);

  // Walk right
  for (let i = targetIdx + 1; i < arr.length; ) {
    const n = arr[i];
    if (toMin(n.start) >= e) break;
    if (toMin(n.end) <= e) {
      arr.splice(i, 1);
      continue;
    }
    n.start = toTime(e);
    if (toMin(n.end) - toMin(n.start) < MIN_SLOT_LEN) {
      arr.splice(i, 1);
      continue;
    }
    break;
  }

  return mergeBookable(fillGaps(arr));
}

/**
 * Move a slot to a new start time within the same day, preserving its duration.
 * Other slots get pushed/shrunk under "knuffa undan" logic.
 */
export function moveSlot(
  slots: TimeSlot[],
  index: number,
  newStartMin: number,
): TimeSlot[] {
  const target = slots[index];
  if (!target) return slots;
  const dur = toMin(target.end) - toMin(target.start);
  let s = snap(newStartMin);
  s = Math.max(DAY_START_MIN, Math.min(DAY_END_MIN - dur, s));
  return resizeSlot(slots, index, s, s + dur);
}

/**
 * Move a slot to a different day at given start. Removes from source day,
 * inserts on target day, then runs resize/push logic on the target.
 */
export function moveSlotToDay(
  fromSlots: TimeSlot[],
  fromIndex: number,
  toSlots: TimeSlot[],
  newStartMin: number,
): { from: TimeSlot[]; to: TimeSlot[] } {
  const target = fromSlots[fromIndex];
  if (!target) return { from: fromSlots, to: toSlots };
  const dur = toMin(target.end) - toMin(target.start);

  // Remove from source: replace with BOKNINGSBAR over its time so coverage stays
  const fromArr = fromSlots.map((s, i) =>
    i === fromIndex ? { start: target.start, end: target.end, activity: "BOKNINGSBAR" } : { ...s },
  );
  const fromMerged = mergeBookable(fromArr);

  // Insert into target at end first, then resize to desired window
  const inserted = [...toSlots.map((s) => ({ ...s })), { ...target }];
  const insertedIdx = inserted.length - 1;
  let s = snap(newStartMin);
  s = Math.max(DAY_START_MIN, Math.min(DAY_END_MIN - dur, s));
  const toResized = resizeSlot(inserted, insertedIdx, s, s + dur);

  return { from: fromMerged, to: toResized };
}

/**
 * Insert a new slot at given range (with knuffa-undan).
 * Activity defaults to "Nytt pass". Returns the new slot index in the result.
 */
export function insertSlot(
  slots: TimeSlot[],
  newStartMin: number,
  newEndMin: number,
  activity = "Nytt pass",
): TimeSlot[] {
  let s = snap(newStartMin);
  let e = snap(newEndMin);
  if (e - s < MIN_SLOT_LEN) e = s + MIN_SLOT_LEN;
  s = Math.max(DAY_START_MIN, s);
  e = Math.min(DAY_END_MIN, e);
  const inserted: TimeSlot = { start: toTime(s), end: toTime(e), activity };
  const arr = [...slots.map((x) => ({ ...x })), inserted];
  const idx = arr.length - 1;
  return resizeSlot(arr, idx, s, e);
}