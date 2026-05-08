import { describe, expect, it } from "vitest";
import {
  BOOKABLE_ACTIVITY,
  getGapActivity,
  normalizeShortBookablePauses,
  resizeSlot,
  SHORT_PAUSE_ACTIVITY,
} from "./scheduleEdit";

describe("scheduleEdit pause gaps", () => {
  it("labels gaps under 20 minutes as Isvård", () => {
    expect(getGapActivity(9 * 60, 9 * 60 + 19)).toBe(SHORT_PAUSE_ACTIVITY);
  });

  it("keeps gaps of 20 minutes or more bookable", () => {
    expect(getGapActivity(9 * 60, 9 * 60 + 20)).toBe(BOOKABLE_ACTIVITY);
  });

  it("renames imported short bookable slots to Isvård", () => {
    expect(
      normalizeShortBookablePauses([
        { start: "09:00", end: "09:19", activity: BOOKABLE_ACTIVITY, category: "booking" },
        { start: "09:20", end: "09:40", activity: BOOKABLE_ACTIVITY },
      ]),
    ).toEqual([
      { start: "09:00", end: "09:19", activity: SHORT_PAUSE_ACTIVITY, category: "maintenance" },
      { start: "09:20", end: "09:40", activity: BOOKABLE_ACTIVITY },
    ]);
  });

  it("uses Isvård when edit operations create a short pause", () => {
    const updated = resizeSlot(
      [
        { start: "08:00", end: "09:00", activity: "U13" },
        { start: "09:10", end: "10:00", activity: "U14" },
      ],
      0,
      8 * 60,
      8 * 60 + 55,
    );

    expect(updated).toContainEqual({ start: "08:55", end: "09:10", activity: SHORT_PAUSE_ACTIVITY });
  });
});
