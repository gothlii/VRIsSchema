import { days as weekDays, type TimeSlot, type WeekSchedule } from "@/data/schedule";

export type ParsedExcelWeek = {
  sheetName: string;
  label: string;
  sort_order: number;
  data: WeekSchedule;
  slotCount: number;
  dateRange?: string;
  warnings: string[];
};

type WorkbookSheet = {
  name: string;
  path: string;
};

type CellMatrix = string[][];

type DayColumn = {
  day: string;
  col: number;
};

type TimeRange = {
  start: string;
  end: string;
  startMinutes: number;
  endMinutes: number;
};

const ZIP_LOCAL_FILE_HEADER = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;

const XML_FILE_RE = /(?:^|\/)(?:workbook|sharedStrings|sheet\d+)\.xml$|\.rels$/;
const TIME_RANGE_RE = /(^|[^\d])([0-2]?\d)[.:]([0-5]\d)\s*[-–—]\s*([0-2]?\d)[.:]([0-5]\d)(?!\d)/g;
const TIME_RE = /(^|[^\d])([0-2]?\d)[.:]([0-5]\d)(?!\d)/g;

const dayAliases: Record<string, string> = {
  mandag: weekDays[0],
  monday: weekDays[0],
  tisdag: weekDays[1],
  tuesday: weekDays[1],
  onsdag: weekDays[2],
  wednesday: weekDays[2],
  torsdag: weekDays[3],
  thursday: weekDays[3],
  fredag: weekDays[4],
  friday: weekDays[4],
  lordag: weekDays[5],
  saturday: weekDays[5],
  sondag: weekDays[6],
  sunday: weekDays[6],
};

export async function parseScheduleExcelWorkbook(buffer: ArrayBuffer): Promise<ParsedExcelWeek[]> {
  const files = await unzipTextFiles(buffer, (name) => name.startsWith("xl/") && XML_FILE_RE.test(name));
  const workbookXml = files["xl/workbook.xml"];

  if (!workbookXml) {
    throw new Error("Excel-filen saknar workbook.xml och kunde inte läsas.");
  }

  const workbook = parseXml(workbookXml, "xl/workbook.xml");
  const workbookRels = parseWorkbookRelationships(files["xl/_rels/workbook.xml.rels"] ?? "");
  const sharedStrings = parseSharedStrings(files["xl/sharedStrings.xml"]);
  const sheets = parseWorkbookSheets(workbook, workbookRels);

  const parsedWeeks = sheets
    .map((sheet) => {
      const xml = files[sheet.path];
      if (!xml) return null;
      const matrix = parseWorksheetMatrix(xml, sharedStrings);
      return parseSheetSchedule(sheet.name, matrix);
    })
    .filter((week): week is ParsedExcelWeek => Boolean(week));

  if (parsedWeeks.length === 0) {
    throw new Error("Hittade inga veckoflikar med måndag-söndag i Excel-filen.");
  }

  return parsedWeeks;
}

export function parseSheetSchedule(sheetName: string, matrix: CellMatrix): ParsedExcelWeek | null {
  const weekNumber = inferWeekNumber(sheetName, matrix);
  if (weekNumber === null) return null;

  const dayHeader = findDayHeader(matrix);
  if (!dayHeader) return null;

  const endRow = findScheduleEndRow(matrix, dayHeader.row + 1);
  const data: WeekSchedule = {};
  const warnings: string[] = [];

  for (const day of weekDays) {
    data[day] = [];
  }

  for (const { day, col } of dayHeader.columns) {
    data[day] = parseDayColumn(matrix, col, dayHeader.row + 1, endRow);
  }

  const slotCount = Object.values(data).reduce((sum, slots) => sum + slots.length, 0);
  if (slotCount === 0) {
    warnings.push("Inga pass med tydligt tidsintervall hittades på fliken.");
  }

  return {
    sheetName,
    label: `Vecka ${weekNumber}`,
    sort_order: weekNumber,
    data,
    slotCount,
    dateRange: inferDateRange(matrix, dayHeader.row, dayHeader.columns),
    warnings,
  };
}

async function unzipTextFiles(buffer: ArrayBuffer, shouldRead: (name: string) => boolean) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const eocdOffset = findEndOfCentralDirectory(view);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  let centralOffset = view.getUint32(eocdOffset + 16, true);
  const files: Record<string, string> = {};

  for (let i = 0; i < entryCount; i += 1) {
    if (view.getUint32(centralOffset, true) !== ZIP_CENTRAL_DIRECTORY) {
      throw new Error("Excel-filens zip-index kunde inte läsas.");
    }

    const method = view.getUint16(centralOffset + 10, true);
    const compressedSize = view.getUint32(centralOffset + 20, true);
    const nameLength = view.getUint16(centralOffset + 28, true);
    const extraLength = view.getUint16(centralOffset + 30, true);
    const commentLength = view.getUint16(centralOffset + 32, true);
    const localOffset = view.getUint32(centralOffset + 42, true);
    const name = decodeUtf8(bytes.slice(centralOffset + 46, centralOffset + 46 + nameLength));

    if (shouldRead(name)) {
      if (view.getUint32(localOffset, true) !== ZIP_LOCAL_FILE_HEADER) {
        throw new Error(`Excel-filen innehåller en ogiltig post: ${name}`);
      }

      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.slice(dataStart, dataStart + compressedSize);
      const data = method === 0 ? compressed : await inflateZipEntry(compressed, method, name);
      files[name] = decodeUtf8(data);
    }

    centralOffset += 46 + nameLength + extraLength + commentLength;
  }

  return files;
}

function findEndOfCentralDirectory(view: DataView) {
  const minOffset = Math.max(0, view.byteLength - 0xffff - 22);
  for (let offset = view.byteLength - 22; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) === ZIP_END_OF_CENTRAL_DIRECTORY) {
      return offset;
    }
  }
  throw new Error("Excel-filen ser inte ut som en giltig .xlsx-fil.");
}

async function inflateZipEntry(data: Uint8Array, method: number, name: string) {
  if (method !== 8) {
    throw new Error(`Excel-posten ${name} använder en komprimering som inte stöds.`);
  }

  if (typeof DecompressionStream === "undefined") {
    throw new Error("Den här webbläsaren kan inte packa upp Excel-filer.");
  }

  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function decodeUtf8(data: Uint8Array) {
  return new TextDecoder("utf-8").decode(data);
}

function parseXml(xml: string, path: string) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error(`Kunde inte läsa XML inuti Excel-filen: ${path}`);
  }
  return doc;
}

function byLocalName(parent: Document | Element, name: string) {
  return Array.from(parent.getElementsByTagNameNS("*", name));
}

function parseWorkbookRelationships(xml: string) {
  if (!xml) return new Map<string, string>();

  const rels = parseXml(xml, "xl/_rels/workbook.xml.rels");
  const map = new Map<string, string>();

  for (const rel of byLocalName(rels, "Relationship")) {
    const id = rel.getAttribute("Id");
    const target = rel.getAttribute("Target");
    if (id && target) {
      map.set(id, resolveRelationshipTarget("xl/workbook.xml", target));
    }
  }

  return map;
}

function parseWorkbookSheets(workbook: Document, rels: Map<string, string>): WorkbookSheet[] {
  return byLocalName(workbook, "sheet")
    .map((sheet) => {
      const name = sheet.getAttribute("name")?.trim();
      const relationshipId = sheet.getAttribute("r:id") ?? sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
      const path = relationshipId ? rels.get(relationshipId) : undefined;
      return name && path ? { name, path } : null;
    })
    .filter((sheet): sheet is WorkbookSheet => Boolean(sheet));
}

function parseSharedStrings(xml: string | undefined) {
  if (!xml) return [];

  const doc = parseXml(xml, "xl/sharedStrings.xml");
  return byLocalName(doc, "si").map((item) =>
    byLocalName(item, "t")
      .map((textNode) => textNode.textContent ?? "")
      .join("")
      .trim(),
  );
}

function parseWorksheetMatrix(xml: string, sharedStrings: string[]) {
  const doc = parseXml(xml, "worksheet");
  const matrix: CellMatrix = [];

  for (const row of byLocalName(doc, "row")) {
    const rowNumber = parseInt(row.getAttribute("r") ?? "", 10);
    const rowIndex = Number.isNaN(rowNumber) ? matrix.length : rowNumber - 1;
    matrix[rowIndex] ??= [];

    let fallbackCol = 0;
    for (const cell of byLocalName(row, "c")) {
      const ref = cell.getAttribute("r");
      const parsedRef = ref ? parseCellRef(ref) : null;
      const colIndex = parsedRef?.col ?? fallbackCol;
      matrix[rowIndex][colIndex] = readCellValue(cell, sharedStrings);
      fallbackCol = colIndex + 1;
    }
  }

  return matrix;
}

function readCellValue(cell: Element, sharedStrings: string[]) {
  const type = cell.getAttribute("t");

  if (type === "inlineStr") {
    return byLocalName(cell, "t")
      .map((textNode) => textNode.textContent ?? "")
      .join("")
      .trim();
  }

  const value = byLocalName(cell, "v")[0]?.textContent?.trim() ?? "";
  if (type === "s") {
    const index = parseInt(value, 10);
    return Number.isNaN(index) ? "" : sharedStrings[index] ?? "";
  }

  return value;
}

function parseCellRef(ref: string) {
  const match = ref.match(/^([A-Z]+)(\d+)$/i);
  if (!match) return null;

  return {
    col: columnNameToIndex(match[1]),
    row: parseInt(match[2], 10) - 1,
  };
}

function columnNameToIndex(name: string) {
  return name
    .toUpperCase()
    .split("")
    .reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function resolveRelationshipTarget(baseFile: string, target: string) {
  if (target.startsWith("/")) {
    return normalizePath(target.slice(1));
  }

  const baseDir = baseFile.slice(0, baseFile.lastIndexOf("/") + 1);
  return normalizePath(`${baseDir}${target}`);
}

function normalizePath(path: string) {
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function inferWeekNumber(sheetName: string, matrix: CellMatrix) {
  const candidates = [sheetName, matrix[0]?.[0] ?? ""];

  for (const candidate of candidates) {
    const match = String(candidate).match(/\bv\s*\.?\s*(\d{1,2})\b/i);
    if (!match) continue;

    const weekNumber = parseInt(match[1], 10);
    if (weekNumber >= 1 && weekNumber <= 53) {
      return weekNumber;
    }
  }

  return null;
}

function findDayHeader(matrix: CellMatrix): { row: number; columns: DayColumn[] } | null {
  const visbyRow = matrix.findIndex((row) =>
    row?.some((cell) => normalizeText(cell).includes("visbyishall")),
  );
  const startRow = Math.max(0, visbyRow);

  for (let rowIndex = startRow; rowIndex < matrix.length; rowIndex += 1) {
    const columns = (matrix[rowIndex] ?? [])
      .map((cell, col) => ({ day: resolveDayName(cell), col }))
      .filter((entry): entry is DayColumn => Boolean(entry.day));

    if (columns.length >= 5) {
      return { row: rowIndex, columns };
    }
  }

  return null;
}

function findScheduleEndRow(matrix: CellMatrix, startRow: number) {
  for (let rowIndex = startRow; rowIndex < matrix.length; rowIndex += 1) {
    const firstCell = matrix[rowIndex]?.[0] ?? "";
    const rowText = matrix[rowIndex]?.join(" ") ?? "";
    const normalizedFirst = normalizeText(firstCell);
    const normalizedRow = normalizeText(rowText);

    if (normalizedFirst.startsWith("bortresta") || normalizedFirst.startsWith("lediga")) {
      return rowIndex;
    }

    if (rowIndex > startRow && (normalizedRow.includes("sliteishall") || normalizedRow.includes("visbyishall"))) {
      return rowIndex;
    }
  }

  return matrix.length;
}

function parseDayColumn(matrix: CellMatrix, col: number, startRow: number, endRow: number) {
  const lines = new Map<number, string>();

  for (let row = startRow; row < endRow; row += 1) {
    const text = normalizeCell(matrix[row]?.[col] ?? "");
    if (text) {
      lines.set(row, text);
    }
  }

  const slots: TimeSlot[] = [];

  for (const [row, text] of lines) {
    const ranges = extractTimeRanges(text);
    for (const range of ranges) {
      const activity = chooseActivity(lines, row, text);
      if (!activity) continue;
      slots.push({ start: range.start, end: range.end, activity });
    }
  }

  for (const [row, text] of lines) {
    if (extractTimeRanges(text).length > 0) continue;

    const standaloneTimes = extractStandaloneTimes(text);
    if (standaloneTimes.length === 0) continue;

    const cleaned = cleanActivityLine(text);
    if (isMaintenanceActivity(cleaned)) {
      for (const time of standaloneTimes) {
        slots.push({
          start: time.time,
          end: minutesToTime(Math.min(time.minutes + 10, 24 * 60 - 1)),
          activity: cleaned.toLowerCase().includes("isvård") || cleaned.toLowerCase().includes("isvard") ? "Isvård" : "Spolning",
        });
      }
      continue;
    }

    const context = [
      ...collectActivity(lines, row, -1, 4),
      cleaned,
      ...collectActivity(lines, row, 1, 4),
    ]
      .filter(Boolean)
      .join(" ");

    if (!normalizeText(context).includes("match")) continue;

    for (const time of standaloneTimes) {
      const nextStart = findNextRangeStart(lines, row, time.minutes);
      const endMinutes = nextStart ?? Math.min(time.minutes + 150, 24 * 60 - 1);
      if (endMinutes <= time.minutes) continue;

      slots.push({
        start: time.time,
        end: minutesToTime(endMinutes),
        activity: normalizeActivity(context),
      });
    }
  }

  return dedupeAndSortSlots(slots);
}

function chooseActivity(lines: Map<number, string>, row: number, text: string) {
  const own = cleanActivityLine(text);
  if (own) return normalizeActivity(own);

  const before = collectActivity(lines, row, -1, 6).join(" ");
  const after = collectActivity(lines, row, 1, 6).join(" ");

  if (!before && !after) return "";
  if (!before) return normalizeActivity(after);
  if (!after) return normalizeActivity(before);
  if (isMaintenanceActivity(before) && !isMaintenanceActivity(after)) return normalizeActivity(after);

  return normalizeActivity(before);
}

function collectActivity(lines: Map<number, string>, row: number, direction: 1 | -1, maxDistance: number) {
  const pieces: string[] = [];
  let blankCount = 0;

  for (let step = 1; step <= maxDistance; step += 1) {
    const text = lines.get(row + direction * step);

    if (!text) {
      if (pieces.length > 0) break;
      blankCount += 1;
      if (blankCount > 4) break;
      continue;
    }

    if (extractTimeRanges(text).length > 0) break;

    const cleaned = cleanActivityLine(text);
    if (!cleaned) continue;
    if (resolveDayName(cleaned) || normalizeText(cleaned).includes("ishall")) break;

    if (isMaintenanceActivity(cleaned) && extractStandaloneTimes(text).length > 0) {
      continue;
    }

    pieces.push(cleaned);
    if (pieces.length >= 4) break;
  }

  return direction === -1 ? pieces.reverse() : pieces;
}

function findNextRangeStart(lines: Map<number, string>, row: number, afterMinutes: number) {
  for (let step = 1; step <= 8; step += 1) {
    const text = lines.get(row + step);
    if (!text) continue;

    const next = extractTimeRanges(text).find((range) => range.startMinutes > afterMinutes);
    if (next) return next.startMinutes;
  }

  return null;
}

function extractTimeRanges(text: string) {
  const ranges: TimeRange[] = [];

  for (const match of text.matchAll(TIME_RANGE_RE)) {
    const start = normalizeTime(match[2], match[3]);
    const end = normalizeTime(match[4], match[5]);
    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);

    if (startMinutes >= 0 && endMinutes > startMinutes) {
      ranges.push({ start, end, startMinutes, endMinutes });
    }
  }

  return ranges;
}

function extractStandaloneTimes(text: string) {
  const withoutRanges = stripTimeRanges(text);
  const times: { time: string; minutes: number }[] = [];

  for (const match of withoutRanges.matchAll(TIME_RE)) {
    const time = normalizeTime(match[2], match[3]);
    const minutes = timeToMinutes(time);
    if (minutes >= 0) {
      times.push({ time, minutes });
    }
  }

  return times;
}

function stripTimeRanges(text: string) {
  return text.replace(TIME_RANGE_RE, "$1");
}

function cleanActivityLine(text: string) {
  const withoutRanges = stripTimeRanges(text);
  const withoutStandaloneTimes = withoutRanges.replace(TIME_RE, "$1");
  const cleaned = normalizeActivity(withoutStandaloneTimes);

  if (!cleaned || /^[,.;:!?-]+$/.test(cleaned)) return "";
  if (/^(a|lediga|bortresta)$/i.test(cleaned)) return "";

  return cleaned;
}

function normalizeActivity(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/^[,.;:!?-]+|[,.;:!?-]+$/g, "")
    .trim();
}

function normalizeCell(value: unknown) {
  return String(value ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDayName(value: string) {
  return normalizeText(value).replace(/[^a-z]/g, "");
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/å/g, "a")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/Å/g, "a")
    .replace(/Ä/g, "a")
    .replace(/Ö/g, "o")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function resolveDayName(value: string) {
  return dayAliases[normalizeDayName(value)] ?? "";
}

function isMaintenanceActivity(value: string) {
  const normalized = normalizeText(value);
  return normalized.includes("spol") || normalized.includes("isvard") || normalized.includes("curlingspolning");
}

function normalizeTime(hour: string, minute: string) {
  const h = parseInt(hour, 10);
  const m = parseInt(minute, 10);
  if (Number.isNaN(h) || Number.isNaN(m) || h > 23 || m > 59) {
    return "00:00";
  }

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function timeToMinutes(time: string) {
  const match = time.match(/^(\d{2}):(\d{2})$/);
  if (!match) return -1;

  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

function minutesToTime(minutes: number) {
  const clamped = Math.max(0, Math.min(minutes, 24 * 60 - 1));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function dedupeAndSortSlots(slots: TimeSlot[]) {
  const unique = new Map<string, TimeSlot>();

  for (const slot of slots) {
    const key = `${slot.start}|${slot.end}|${normalizeText(slot.activity)}`;
    unique.set(key, slot);
  }

  return Array.from(unique.values()).sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
}

function inferDateRange(matrix: CellMatrix, dayHeaderRow: number, columns: DayColumn[]) {
  const dateRow = matrix[dayHeaderRow - 1];
  if (!dateRow || columns.length === 0) return undefined;

  const first = formatPossibleExcelDate(dateRow[columns[0].col]);
  const last = formatPossibleExcelDate(dateRow[columns[columns.length - 1].col]);

  return first && last ? `${first} - ${last}` : undefined;
}

function formatPossibleExcelDate(value: string | undefined) {
  if (!value) return "";

  const asNumber = Number(value);
  if (!Number.isNaN(asNumber) && asNumber > 20000 && asNumber < 60000) {
    const date = new Date(Date.UTC(1899, 11, 30) + asNumber * 86400000);
    return `${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getDate()}/${parsed.getMonth() + 1}`;
  }

  return "";
}
