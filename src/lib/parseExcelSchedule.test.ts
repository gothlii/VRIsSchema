import { describe, expect, it } from "vitest";
import { parseSheetSchedule } from "./parseExcelSchedule";

describe("parseSheetSchedule", () => {
  it("parses a Visby week sheet with activity above time ranges", () => {
    const parsed = parseSheetSchedule("V 37", [
      ["V.37", "ISSCHEMA", "VISBY ISHALL"],
      ["", "45543", "45544", "45545", "45546", "45547", "45548", "45549"],
      ["", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"],
      ["8.00", "", "", "", "", "", "HS", ""],
      ["", "", "", "", "", "", "08.00-08.55", ""],
      ["9.00", "", "", "", "", "", "HS-U8-U9", ""],
      ["", "", "", "", "", "", "08.55-09.50", ""],
      ["10.00", "", "", "", "", "", "U14-U15", "GRAIP KÅ"],
      ["", "", "", "", "", "", "Ansv: U14", "10.00-11.00"],
      ["", "", "", "", "", "", "10.00-11.15", ""],
      ["Bortresta:"],
    ]);

    expect(parsed?.label).toBe("Vecka 37");
    expect(parsed?.data["Lördag"]).toEqual([
      { start: "08:00", end: "08:55", activity: "HS" },
      { start: "08:55", end: "09:50", activity: "HS-U8-U9" },
      { start: "10:00", end: "11:15", activity: "U14-U15 Ansv: U14" },
    ]);
    expect(parsed?.data["Söndag"]).toEqual([
      { start: "10:00", end: "11:00", activity: "GRAIP KÅ" },
    ]);
  });

  it("parses time-first public skating and standalone maintenance", () => {
    const parsed = parseSheetSchedule("V10", [
      ["V.10", "ISSCHEMA", "VISBY ISHALL"],
      ["", "45718", "45719", "45720", "45721", "45722", "45723", "45724"],
      ["", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"],
      ["13.00", "Spolning 13.50"],
      ["14.00", "14.00-15.45"],
      ["", "Allmänhetens"],
      ["15.00", "åkning"],
      ["", "utan klubba/puck"],
      ["Bortresta:"],
    ]);

    expect(parsed?.data["Måndag"]).toEqual([
      { start: "13:50", end: "14:00", activity: "Spolning" },
      { start: "14:00", end: "15:45", activity: "Allmänhetens åkning utan klubba/puck" },
    ]);
  });

  it("skips sparse empty rows while looking for the day header", () => {
    const matrix: string[][] = [];
    matrix[0] = ["V.31"];
    matrix[2] = ["", "ISSCHEMA", "VISBY ISHALL"];
    matrix[5] = ["", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"];
    matrix[6] = ["8.00", "BOKNINGSBAR"];
    matrix[7] = ["", "08.00-09.00"];

    const parsed = parseSheetSchedule("V31", matrix);

    expect(parsed?.data["Måndag"]).toEqual([
      { start: "08:00", end: "09:00", activity: "BOKNINGSBAR" },
    ]);
  });
});
