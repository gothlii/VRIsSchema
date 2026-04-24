import { useState, useRef, useEffect } from "react";
import { type TimeSlot, getCategory, type SlotCategory } from "@/data/schedule";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const categoryStyles: Record<SlotCategory, string> = {
  booking: "bg-schedule-booking text-schedule-booking-text border-l-2 border-l-muted-foreground/20",
  public: "bg-schedule-public text-schedule-public-text border-l-2 border-l-emerald-400/50",
  team: "bg-schedule-team text-schedule-team-text border-l-2 border-l-sky-400/50",
  maintenance: "bg-schedule-maintenance text-schedule-maintenance-text",
  match: "bg-schedule-match text-schedule-match-text border-l-2 border-l-rose-400/60",
  school: "bg-schedule-school text-schedule-school-text border-l-2 border-l-purple-400/50",
  event: "bg-schedule-event text-schedule-event-text border-l-2 border-l-amber-400/50",
};

const categoryDotStyles: Record<SlotCategory, string> = {
  booking: "bg-schedule-booking",
  public: "bg-schedule-public",
  team: "bg-schedule-team",
  maintenance: "bg-schedule-maintenance",
  match: "bg-schedule-match",
  school: "bg-schedule-school",
  event: "bg-schedule-event",
};

const categoryLabels: Record<SlotCategory, string> = {
  booking: "Bokningsbar",
  public: "Allmänhet",
  team: "Lagträning",
  maintenance: "Spolning",
  match: "Match",
  school: "Hockeyskolan",
  event: "Event",
};

const selectableCategories: SlotCategory[] = ["team", "public", "match", "school", "event", "maintenance", "booking"];

type Props = {
  slot: TimeSlot;
  index: number;
  isAdmin?: boolean;
  onRemove?: () => void;
  onRename?: (newActivity: string) => void;
  onChangeCategory?: (newCategory: SlotCategory) => void;
};

export function ScheduleSlot({ slot, index, isAdmin, onRemove, onRename, onChangeCategory }: Props) {
  const cat = getCategory(slot);
  const isMaintenance = cat === "maintenance";
  const isBooking = cat === "booking";
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(slot.activity);
  const [catOpen, setCatOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    setLabel(slot.activity);
  }, [slot.activity]);

  const commit = () => {
    setEditing(false);
    const trimmed = label.trim();
    if (!trimmed) {
      setLabel(slot.activity);
      return;
    }
    if (trimmed !== slot.activity && onRename) {
      onRename(trimmed);
    }
  };

  const canRemove = !isBooking;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      className={`group/slot rounded-md px-2 py-1.5 ${categoryStyles[cat]} ${isMaintenance ? "py-0.5 text-xs opacity-60" : ""}`}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {isAdmin && onChangeCategory && (
            <Popover open={catOpen} onOpenChange={setCatOpen}>
              <PopoverTrigger asChild>
                <button
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-foreground/20 ${categoryDotStyles[cat]}`}
                  title="Ändra kategori"
                />
              </PopoverTrigger>
              <PopoverContent className="z-[100] w-40 p-1" align="start">
                {selectableCategories.map((c) => (
                  <button
                    key={c}
                    onClick={() => { onChangeCategory(c); setCatOpen(false); }}
                    className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground ${
                      cat === c ? "bg-accent/50 font-medium" : ""
                    }`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${categoryDotStyles[c]} ring-1 ring-foreground/20`} />
                    {categoryLabels[c]}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          )}
          {editing && isAdmin ? (
            <input
              ref={inputRef}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => e.key === "Enter" && commit()}
              className="min-w-0 flex-1 rounded bg-background/50 px-1 text-xs font-medium outline-none"
            />
          ) : (
            <span
              onClick={() => isAdmin && setEditing(true)}
              className={`truncate font-medium ${isAdmin ? "cursor-pointer hover:underline" : ""} ${isMaintenance ? "text-[10px]" : "text-xs"}`}
              title={isAdmin ? "Klicka för att redigera" : undefined}
            >
              {label}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isAdmin && canRemove && onRemove && (
            <button
              onClick={onRemove}
              className="rounded-full p-0.5 opacity-0 transition-opacity hover:text-destructive group-hover/slot:opacity-100"
              title={isMaintenance ? "Ta bort spolning (förläng föregående pass)" : "Ta bort (gör bokningsbar)"}
            >
              <X className="h-3 w-3" />
            </button>
          )}
          <span className="tabular-nums text-[10px] opacity-75">
            {slot.start}–{slot.end}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
