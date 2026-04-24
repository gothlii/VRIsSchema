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
import { type WeekSchedule, days as weekDays } from "@/data/schedule";
import { Plus, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Props = {
  // Called after a successful insert with the new row's id, label and data so the parent can update its in-memory list.
  onImport: (label: string, data: WeekSchedule, id: string, sortOrder: number) => void;
};

const SQL_EXAMPLE = `INSERT INTO weeks (label, sort_order, data) VALUES (
  'Vecka 24',
  100,
  '{
    "Måndag": [
      {"start":"16:00","end":"17:00","activity":"VR A-lag"},
      {"start":"17:00","end":"17:15","activity":"Spolning"},
      {"start":"17:15","end":"18:15","activity":"U13","category":"team"}
    ],
    "Tisdag": [],
    "Onsdag": [],
    "Torsdag": [],
    "Fredag": [],
    "Lördag": [],
    "Söndag": []
  }'::jsonb
);`;

type ParsedInsert = {
  label: string;
  sort_order: number | null;
  data: WeekSchedule;
};

// Parses a single INSERT INTO weeks (...) VALUES (...) statement.
// Accepts column orders that include any subset of: label, sort_order, data.
function parseInsertStatement(raw: string): ParsedInsert | string {
  const sql = raw.trim().replace(/;$/, "").trim();

  const m = sql.match(/^insert\s+into\s+(?:public\.)?weeks\s*\(([^)]+)\)\s*values\s*\(([\s\S]+)\)\s*$/i);
  if (!m) {
    return "Förväntade en sats på formen: INSERT INTO weeks (label, sort_order, data) VALUES (...);";
  }

  const cols = m[1].split(",").map((c) => c.trim().toLowerCase().replace(/^"|"$/g, ""));
  const valuesRaw = m[2];

  // Tokenize values: strings (single-quoted with '' escape), numbers, NULL.
  const tokens: string[] = [];
  let i = 0;
  while (i < valuesRaw.length) {
    const ch = valuesRaw[i];
    if (ch === " " || ch === "\n" || ch === "\t" || ch === "\r" || ch === ",") {
      i++;
      continue;
    }
    if (ch === "'") {
      let s = "";
      i++;
      while (i < valuesRaw.length) {
        if (valuesRaw[i] === "'" && valuesRaw[i + 1] === "'") {
          s += "'";
          i += 2;
        } else if (valuesRaw[i] === "'") {
          i++;
          break;
        } else {
          s += valuesRaw[i];
          i++;
        }
      }
      // Optional ::type cast — skip it
      if (valuesRaw.slice(i, i + 2) === "::") {
        i += 2;
        while (i < valuesRaw.length && /[a-zA-Z0-9_]/.test(valuesRaw[i])) i++;
      }
      tokens.push(s);
    } else if (/[0-9-]/.test(ch)) {
      let n = "";
      while (i < valuesRaw.length && /[0-9.-]/.test(valuesRaw[i])) {
        n += valuesRaw[i];
        i++;
      }
      tokens.push(n);
    } else if (/[a-zA-Z]/.test(ch)) {
      let w = "";
      while (i < valuesRaw.length && /[a-zA-Z_]/.test(valuesRaw[i])) {
        w += valuesRaw[i];
        i++;
      }
      tokens.push(w);
    } else {
      i++;
    }
  }

  if (tokens.length !== cols.length) {
    return `Antal kolumner (${cols.length}) matchar inte antal värden (${tokens.length}).`;
  }

  const row: Record<string, string> = {};
  cols.forEach((c, idx) => {
    row[c] = tokens[idx];
  });

  if (!row.label) return "Saknar kolumnen 'label'.";
  if (!row.data) return "Saknar kolumnen 'data'.";

  let data: WeekSchedule;
  try {
    data = JSON.parse(row.data);
  } catch (e) {
    return "Kolumnen 'data' är inte giltig JSON: " + (e as Error).message;
  }

  // Sanity check: each day key should map to an array of slot objects.
  for (const [day, slots] of Object.entries(data)) {
    if (!Array.isArray(slots)) {
      return `Dagen "${day}" är inte en array.`;
    }
    for (const s of slots) {
      if (!s || typeof s !== "object" || !("start" in s) || !("end" in s) || !("activity" in s)) {
        return `Ett pass under "${day}" saknar start/end/activity.`;
      }
    }
  }

  // Ensure all 7 day keys exist (fill with [] if missing) so the UI renders correctly.
  const filled: WeekSchedule = {};
  for (const d of weekDays) filled[d] = data[d] || [];
  // Keep any extra keys the user provided (in case of custom day labels)
  for (const [k, v] of Object.entries(data)) {
    if (!(k in filled)) filled[k] = v;
  }

  const sort_order =
    row.sort_order && row.sort_order.toLowerCase() !== "null"
      ? parseInt(row.sort_order, 10)
      : null;

  return { label: row.label, sort_order, data: filled };
}

export function ImportScheduleDialog({ onImport }: Props) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleImport = async () => {
    setError("");
    const parsed = parseInsertStatement(code);
    if (typeof parsed === "string") {
      setError(parsed);
      return;
    }

    setBusy(true);
    const insertRow = {
      label: parsed.label,
      data: JSON.parse(JSON.stringify(parsed.data)),
      ...(parsed.sort_order !== null ? { sort_order: parsed.sort_order } : {}),
    };

    const { data: inserted, error: dbError } = await supabase
      .from("weeks")
      .insert([insertRow])
      .select()
      .single();
    setBusy(false);

    if (dbError || !inserted) {
      setError(dbError?.message || "Kunde inte spara veckan.");
      return;
    }

    onImport(
      inserted.label,
      inserted.data as unknown as WeekSchedule,
      inserted.id,
      inserted.sort_order
    );
    toast({ title: "Vecka importerad", description: inserted.label });
    setCode("");
    setOpen(false);
  };

  const copyExample = async () => {
    await navigator.clipboard.writeText(SQL_EXAMPLE);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1 rounded-md bg-secondary px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          <Plus className="h-4 w-4" />
          Lägg till vecka
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importera vecka från SQL</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-sm font-medium text-foreground">
                INSERT-sats
              </label>
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
              placeholder={SQL_EXAMPLE}
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError("");
              }}
              rows={14}
              className="font-mono text-xs"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Förväntat format: <code className="rounded bg-muted px-1">INSERT INTO weeks (label, sort_order, data) VALUES (...);</code>
              {" "}Kolumnen <code>data</code> ska vara JSON med svenska veckodagar som nycklar.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Avbryt</Button>
          </DialogClose>
          <Button onClick={handleImport} disabled={!code.trim() || busy}>
            {busy ? "Importerar…" : "Importera"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
