import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { days as weekDays, type SlotCategory, type WeekSchedule } from "@/data/schedule";
import { Plus, Copy, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { createWeek, hasRemoteStore } from "@/lib/weeksStore";

type Props = {
  onImport: (label: string, data: WeekSchedule, id: string, sortOrder: number) => void;
};

const XML_EXAMPLE = `<week label="Vecka 27" sortOrder="27">
  <day name="Måndag">
    <slot start="08:00" end="14:00" category="booking">BOKNINGSBAR</slot>
    <slot start="14:00" end="15:00" category="public">Allmänhet (med klubba/puck)</slot>
    <slot start="15:00" end="15:50" category="public">Allmänhet (utan klubba/puck)</slot>
    <slot start="15:50" end="16:00" category="maintenance">Spolning</slot>
  </day>
  <day name="Tisdag">
    <slot start="08:00" end="14:00" category="booking">BOKNINGSBAR</slot>
    <slot start="14:00" end="15:00" category="public">Allmänhet (utan klubba/puck)</slot>
  </day>
</week>`;

type ParsedWeek = {
  label: string;
  sort_order: number;
  data: WeekSchedule;
};

const xmlDayAliases: Record<string, string> = {
  mandag: weekDays[0],
  tisdag: weekDays[1],
  onsdag: weekDays[2],
  torsdag: weekDays[3],
  fredag: weekDays[4],
  lordag: weekDays[5],
  sondag: weekDays[6],
};

function normalizeDayName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toLowerCase();
}

function resolveDayName(dayName: string) {
  const normalized = normalizeDayName(dayName);
  const aliasedDay = xmlDayAliases[normalized];
  if (aliasedDay) {
    return aliasedDay;
  }

  return dayName;
}

function isSlotCategory(value: string): value is SlotCategory {
  return ["booking", "public", "team", "maintenance", "match", "school", "event"].includes(value);
}

function parseWeekXml(raw: string): ParsedWeek | string {
  const parser = new DOMParser();
  const xml = parser.parseFromString(raw.trim(), "application/xml");
  const parseError = xml.querySelector("parsererror");

  if (parseError) {
    return "XML-koden kunde inte lasas. Kontrollera att alla taggar ar stangda korrekt.";
  }

  const week = xml.querySelector("week");
  if (!week) {
    return "Saknar <week>-tagg i XML-importen.";
  }

  const label = week.getAttribute("label")?.trim();
  if (!label) {
    return "Attributet label saknas pa <week>.";
  }

  const sortOrderRaw = week.getAttribute("sortOrder")?.trim();
  const sort_order = sortOrderRaw ? parseInt(sortOrderRaw, 10) : NaN;
  if (Number.isNaN(sort_order)) {
    return "Attributet sortOrder pa <week> maste vara ett heltal.";
  }

  const data: WeekSchedule = {};
  for (const day of weekDays) data[day] = [];

  const dayElements = Array.from(week.querySelectorAll(":scope > day"));
  if (dayElements.length === 0) {
    return "XML-importen innehaller inga <day>-element.";
  }

  for (const dayElement of dayElements) {
    const rawDayName = dayElement.getAttribute("name")?.trim();
    if (!rawDayName) {
      return "Ett <day>-element saknar attributet name.";
    }

    const resolvedDayName = resolveDayName(rawDayName);
    const slots = Array.from(dayElement.querySelectorAll(":scope > slot")).map((slotElement) => {
      const start = slotElement.getAttribute("start")?.trim();
      const end = slotElement.getAttribute("end")?.trim();
      const category = slotElement.getAttribute("category")?.trim() ?? undefined;
      const activity = slotElement.textContent?.trim() ?? "";

      if (!start || !end || !activity) {
        throw new Error(`Pass under "${rawDayName}" saknar start, end eller textinnehall.`);
      }

      if (category && !isSlotCategory(category)) {
        throw new Error(`Ogiltig kategori "${category}" under "${rawDayName}".`);
      }

      return {
        start,
        end,
        activity,
        ...(category ? { category } : {}),
      };
    });

    data[resolvedDayName] = slots;
  }

  return { label, sort_order, data };
}

export function ImportScheduleDialog({ onImport }: Props) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleImport = async () => {
    setError("");
    const parsed = parseWeekXml(code);
    if (typeof parsed === "string") {
      setError(parsed);
      return;
    }

    if (!hasRemoteStore) {
      setError("Firebase ar inte konfigurerat. Lagg in Firebase-nycklar i GitHub och lokalt.");
      return;
    }

    setBusy(true);
    try {
      const created = await createWeek({
        label: parsed.label,
        sort_order: parsed.sort_order,
        data: JSON.parse(JSON.stringify(parsed.data)),
      });
      onImport(created.label, created.data, created.id, created.sort_order);
      toast({ title: "Vecka importerad", description: created.label });
      setCode("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte spara veckan.");
    } finally {
      setBusy(false);
    }
  };

  const copyExample = async () => {
    await navigator.clipboard.writeText(XML_EXAMPLE);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1 rounded-md bg-secondary px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          <Plus className="h-4 w-4" />
          Lagg till vecka
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importera vecka fran XML</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-sm font-medium text-foreground">XML-format</label>
              <button
                type="button"
                onClick={copyExample}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                Kopiera exempel
              </button>
            </div>
            <Textarea
              placeholder={XML_EXAMPLE}
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError("");
              }}
              rows={18}
              className="font-mono text-xs"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Forvantat format: <code className="rounded bg-muted px-1">{`<week label="Vecka 27" sortOrder="27">...</week>`}</code>
              {" "}med <code>day</code>- och <code>slot</code>-taggar enligt XML-strukturen ovan.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Avbryt</Button>
          </DialogClose>
          <Button onClick={handleImport} disabled={!code.trim() || busy}>
            {busy ? "Importerar..." : "Importera XML"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
