import { describe, expect, it } from "vitest";
import { getTeamFilterOptions, matchesTeamFilter } from "./scheduleFilters";
import type { WeekSchedule } from "@/data/schedule";

describe("scheduleFilters", () => {
  it("builds team filters from the actual schedule fields", () => {
    const data: WeekSchedule = {
      Måndag: [
        { start: "16:00", end: "17:00", activity: "VRU 09-11-10-12" },
        { start: "17:00", end: "18:00", activity: "GRAIP KÅ" },
        { start: "18:00", end: "19:00", activity: "Allmänhetens åkning" },
      ],
    };

    expect(getTeamFilterOptions(data)).toEqual(["U9", "U10", "U11", "U12", "GRAIP KÅ"]);
  });

  it("matches a selected team in both training and match activities", () => {
    expect(matchesTeamFilter("U13-U14", "U13")).toBe(true);
    expect(matchesTeamFilter("Match 12.30 Visby Roma U13 Boo", "U13")).toBe(true);
    expect(matchesTeamFilter("Match 12.30 Visby Roma U13 Boo", "U12")).toBe(false);
  });
});
