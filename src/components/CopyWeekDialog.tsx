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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { WeekSchedule } from "@/data/schedule";
import { createWeek, hasRemoteStore } from "@/lib/weeksStore";

type Props = {
  sourceLabel: string;
  sourceData: WeekSchedule;
  existingLabels: string[];
  onCopied: (label: string, data: WeekSchedule, id: string, sortOrder: number) => void;
};

export function CopyWeekDialog({ sourceLabel, sourceData, existingLabels, onCopied }: Props) {
  const [open, setOpen] = useState(false);
  const [weekNumber, setWeekNumber] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(weekNumber, 10);
    if (isNaN(n) || n < 1 || n > 53) {
      toast({ title: "Ogiltigt veckonummer", description: "Ange ett tal mellan 1 och 53.", variant: "destructive" });
      return;
    }

    const newLabel = `Vecka ${n}`;
    if (existingLabels.includes(newLabel)) {
      toast({ title: "Veckan finns redan", description: `${newLabel} finns redan i schemat.`, variant: "destructive" });
      return;
    }

    if (!hasRemoteStore) {
      toast({
        title: "Firebase saknas",
        description: "Lagg in Firebase-nycklar for att spara nya veckor.",
        variant: "destructive",
      });
      return;
    }

    setBusy(true);
    const dataClone = JSON.parse(JSON.stringify(sourceData)) as WeekSchedule;

    try {
      const created = await createWeek({ label: newLabel, sort_order: n, data: dataClone });
      onCopied(created.label, created.data, created.id, created.sort_order);
      toast({ title: "Veckan kopierades", description: `${sourceLabel} -> ${newLabel}` });
      setWeekNumber("");
      setOpen(false);
    } catch (error) {
      toast({
        title: "Kunde inte kopiera veckan",
        description: error instanceof Error ? error.message : "Okant fel",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="flex items-center gap-1 rounded-md bg-secondary px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          title={`Kopiera ${sourceLabel} till ny vecka`}
        >
          <Copy className="h-4 w-4" />
          Kopiera vecka
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kopiera {sourceLabel}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="week-number">Nytt veckonummer</Label>
            <Input
              id="week-number"
              type="number"
              min={1}
              max={53}
              placeholder="t.ex. 27"
              value={weekNumber}
              onChange={(e) => setWeekNumber(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              En ny vecka skapas med samma pass som {sourceLabel}. Du kan redigera den efterat.
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">Avbryt</Button>
            </DialogClose>
            <Button type="submit" disabled={busy || !weekNumber}>
              {busy ? "Kopierar..." : "Kopiera"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
