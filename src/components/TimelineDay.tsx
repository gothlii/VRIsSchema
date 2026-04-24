import { useRef, useState, useCallback, useEffect } from "react";
import { type TimeSlot, type SlotCategory, getCategory } from "@/data/schedule";
import { DAY_START_MIN, DAY_END_MIN, toMin, toTime, snap, MIN_SLOT_LEN } from "@/lib/scheduleEdit";
import { Check, Pencil, X } from "lucide-react";

const PX_PER_MIN = 1.15;
const HOUR_LABEL_EVERY = 60;

const categoryStyles: Record<SlotCategory, string> = {
  booking: "bg-schedule-booking text-schedule-booking-text border-l-2 border-l-muted-foreground/30",
  public: "bg-schedule-public text-schedule-public-text border-l-2 border-l-emerald-400/60",
  team: "bg-schedule-team text-schedule-team-text border-l-2 border-l-sky-400/60",
  maintenance: "bg-schedule-maintenance text-schedule-maintenance-text",
  match: "bg-schedule-match text-schedule-match-text border-l-2 border-l-rose-400/70",
  school: "bg-schedule-school text-schedule-school-text border-l-2 border-l-purple-400/60",
  event: "bg-schedule-event text-schedule-event-text border-l-2 border-l-amber-400/60",
};

const categoryOptions: SlotCategory[] = [
  "booking",
  "public",
  "team",
  "maintenance",
  "match",
  "school",
  "event",
];

type DragState =
  | { kind: "move"; index: number; pointerStart: number; origStart: number; origEnd: number }
  | { kind: "resize-top"; index: number; pointerStart: number; origStart: number; origEnd: number }
  | { kind: "resize-bottom"; index: number; pointerStart: number; origStart: number; origEnd: number }
  | { kind: "create"; pointerStart: number; origMin: number }
  | null;

type Props = {
  day: string;
  dateLabel?: string;
  slots: TimeSlot[];
  isAdmin?: boolean;
  onRemoveSlot?: (index: number) => void;
  onResize: (index: number, newStartMin: number, newEndMin: number) => void;
  onMove: (index: number, newStartMin: number) => void;
  onMoveToDay?: (index: number, targetDay: string, newStartMin: number) => void;
  onCreate?: (newStartMin: number, newEndMin: number) => void;
  onRenameSlot?: (index: number, newActivity: string) => void;
  onChangeCategory?: (index: number, newCategory: SlotCategory) => void;
  registerColumn?: (day: string, el: HTMLDivElement | null) => void;
  getDayAtPoint?: (clientX: number, clientY: number) => { day: string; min: number } | null;
};

export function TimelineDay({
  day,
  dateLabel,
  slots,
  isAdmin,
  onRemoveSlot,
  onResize,
  onMove,
  onMoveToDay,
  onCreate,
  onRenameSlot,
  onChangeCategory,
  registerColumn,
  getDayAtPoint,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState>(null);
  const [preview, setPreview] = useState<{ index: number; start: number; end: number; targetDay?: string } | null>(null);
  const [createPreview, setCreatePreview] = useState<{ start: number; end: number } | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftText, setDraftText] = useState("");
  const [draftCategory, setDraftCategory] = useState<SlotCategory>("team");

  useEffect(() => {
    if (registerColumn) {
      registerColumn(day, ref.current);
      return () => registerColumn(day, null);
    }
  }, [day, registerColumn]);

  useEffect(() => {
    if (editingIndex === null) return;
    const slot = slots[editingIndex];
    if (!slot) {
      setEditingIndex(null);
      return;
    }
    setDraftText(slot.activity);
    setDraftCategory(getCategory(slot));
  }, [editingIndex, slots]);

  const totalMin = DAY_END_MIN - DAY_START_MIN;
  const height = totalMin * PX_PER_MIN;

  const openEditor = (index: number) => {
    const slot = slots[index];
    if (!slot) return;
    setDraftText(slot.activity);
    setDraftCategory(getCategory(slot));
    setEditingIndex(index);
  };

  const commitEditor = () => {
    if (editingIndex === null) return;
    const slot = slots[editingIndex];
    if (!slot) {
      setEditingIndex(null);
      return;
    }

    const nextText = draftText.trim();
    if (nextText && nextText !== slot.activity && onRenameSlot) {
      onRenameSlot(editingIndex, nextText);
    }

    if (draftCategory !== getCategory(slot) && onChangeCategory) {
      onChangeCategory(editingIndex, draftCategory);
    }

    setEditingIndex(null);
  };

  const onPointerDown = useCallback(
    (e: React.PointerEvent, kind: "move" | "resize-top" | "resize-bottom", index: number) => {
      if (!isAdmin) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      const slot = slots[index];
      setDrag({
        kind,
        index,
        pointerStart: e.clientY,
        origStart: toMin(slot.start),
        origEnd: toMin(slot.end),
      });
    },
    [slots, isAdmin],
  );

  useEffect(() => {
    if (!drag) return;

    const onMoveEvt = (e: PointerEvent) => {
      if (drag.kind === "create") {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        const curMin = DAY_START_MIN + (e.clientY - rect.top) / PX_PER_MIN;
        const a = Math.min(drag.origMin, curMin);
        const b = Math.max(drag.origMin, curMin);
        const s = Math.max(DAY_START_MIN, snap(a));
        const en = Math.min(DAY_END_MIN, snap(b));
        setCreatePreview({ start: s, end: Math.max(s + MIN_SLOT_LEN, en) });
        return;
      }

      const deltaPx = e.clientY - drag.pointerStart;
      const deltaMin = deltaPx / PX_PER_MIN;

      if (drag.kind === "move") {
        if (getDayAtPoint && onMoveToDay) {
          const hit = getDayAtPoint(e.clientX, e.clientY);
          if (hit && hit.day !== day) {
            const dur = drag.origEnd - drag.origStart;
            const s = Math.max(DAY_START_MIN, snap(hit.min - dur / 2));
            setPreview({ index: drag.index, start: s, end: s + dur, targetDay: hit.day });
            return;
          }
        }

        const dur = drag.origEnd - drag.origStart;
        const s = Math.max(DAY_START_MIN, snap(drag.origStart + deltaMin));
        setPreview({ index: drag.index, start: s, end: s + dur });
      } else if (drag.kind === "resize-top") {
        const s = Math.max(DAY_START_MIN, Math.min(drag.origEnd - MIN_SLOT_LEN, snap(drag.origStart + deltaMin)));
        setPreview({ index: drag.index, start: s, end: drag.origEnd });
      } else if (drag.kind === "resize-bottom") {
        const en = Math.max(drag.origStart + MIN_SLOT_LEN, snap(drag.origEnd + deltaMin));
        setPreview({ index: drag.index, start: drag.origStart, end: en });
      }
    };

    const onUp = () => {
      if (drag.kind === "create") {
        if (createPreview && onCreate && createPreview.end - createPreview.start >= MIN_SLOT_LEN * 2) {
          onCreate(createPreview.start, createPreview.end);
        }
      } else if (preview) {
        if (drag.kind === "move") {
          if (preview.targetDay && preview.targetDay !== day && onMoveToDay) {
            onMoveToDay(drag.index, preview.targetDay, preview.start);
          } else {
            onMove(drag.index, preview.start);
          }
        } else {
          onResize(drag.index, preview.start, preview.end);
        }
      }
      setDrag(null);
      setPreview(null);
      setCreatePreview(null);
    };

    window.addEventListener("pointermove", onMoveEvt);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMoveEvt);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [drag, preview, createPreview, onMove, onResize, onMoveToDay, onCreate, day, getDayAtPoint]);

  const hourLines: number[] = [];
  for (let m = DAY_START_MIN; m <= DAY_END_MIN; m += HOUR_LABEL_EVERY) hourLines.push(m);

  return (
    <div className="min-w-0">
      <div className="sticky top-0 z-10 mb-2 rounded-lg bg-secondary px-4 py-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-secondary-foreground">{day}</h3>
        {dateLabel ? <p className="mt-1 text-xs text-muted-foreground">{dateLabel}</p> : null}
      </div>
      <div
        ref={ref}
        data-day={day}
        className="relative rounded-md border border-border/40 bg-card/30"
        style={{ height, touchAction: "none" }}
        onPointerDown={(e) => {
          if (!isAdmin || !onCreate) return;
          if (e.target !== e.currentTarget) return;
          e.preventDefault();
          (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
          const rect = ref.current?.getBoundingClientRect();
          if (!rect) return;
          const min = DAY_START_MIN + (e.clientY - rect.top) / PX_PER_MIN;
          const s = snap(min);
          setDrag({ kind: "create", pointerStart: e.clientY, origMin: s });
          setCreatePreview({ start: s, end: s + 50 });
        }}
      >
        {hourLines.map((m) => {
          const top = (m - DAY_START_MIN) * PX_PER_MIN;
          return (
            <div
              key={m}
              className="pointer-events-none absolute left-0 right-0 border-t border-border/30"
              style={{ top }}
            >
              <span className="absolute -top-2 left-1 bg-card/30 px-1 text-[10px] tabular-nums text-muted-foreground">
                {toTime(m)}
              </span>
            </div>
          );
        })}

        {slots.map((slot, i) => {
          const isPreviewSlot = preview?.index === i;
          const isMovingAway = isPreviewSlot && preview?.targetDay && preview.targetDay !== day;
          const startMin = isPreviewSlot && !isMovingAway ? preview!.start : toMin(slot.start);
          const endMin = isPreviewSlot && !isMovingAway ? preview!.end : toMin(slot.end);
          const top = (startMin - DAY_START_MIN) * PX_PER_MIN;
          const h = Math.max(10, (endMin - startMin) * PX_PER_MIN);
          const cat = editingIndex === i ? draftCategory : getCategory(slot);
          const isMaintenance = cat === "maintenance";
          const isEditing = editingIndex === i;

          return (
            <div
              key={`${slot.start}-${i}`}
              className={`absolute left-1 right-1 select-none overflow-hidden rounded-md px-2 py-1 shadow-sm ${categoryStyles[cat]} ${
                isMaintenance ? "text-[10px] opacity-70" : "text-xs"
              } ${isPreviewSlot && !isMovingAway ? "ring-2 ring-primary z-30" : ""} ${
                isMovingAway ? "opacity-30" : ""
              }`}
              style={{
                top,
                height: h,
                touchAction: "none",
                cursor: isAdmin ? (drag?.kind === "move" && drag.index === i ? "grabbing" : "grab") : "default",
                zIndex: isEditing ? 40 : isPreviewSlot ? 30 : 1,
              }}
              onPointerDown={(e) => onPointerDown(e, "move", i)}
            >
              {isAdmin && (
                <div
                  className="absolute left-0 right-0 top-0 h-1.5 cursor-ns-resize bg-foreground/0 hover:bg-foreground/20"
                  onPointerDown={(e) => onPointerDown(e, "resize-top", i)}
                />
              )}

              <div className="flex items-start justify-between gap-1 leading-tight">
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <div
                      className="flex flex-col gap-1 rounded-md bg-background/90 p-1 text-foreground shadow-lg"
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <input
                        value={draftText}
                        onChange={(e) => setDraftText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && commitEditor()}
                        className="rounded border border-input bg-background px-1.5 py-1 text-xs outline-none"
                        autoFocus
                      />
                      <select
                        value={draftCategory}
                        onChange={(e) => setDraftCategory(e.target.value as SlotCategory)}
                        className="rounded border border-input bg-background px-1.5 py-1 text-xs outline-none"
                      >
                        {categoryOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center gap-1">
                        <button
                          className="rounded bg-primary px-1.5 py-1 text-[10px] text-primary-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            commitEditor();
                          }}
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          className="rounded bg-secondary px-1.5 py-1 text-[10px] text-secondary-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingIndex(null);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span className="truncate font-medium">{slot.activity}</span>
                  )}
                </div>
                <div className="flex shrink-0 items-start gap-1">
                  {isAdmin && !isEditing && onRemoveSlot && (
                    <button
                      className="rounded bg-destructive/15 p-1 text-destructive hover:bg-destructive/25"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveSlot(i);
                      }}
                      title="Ta bort pass och gor tiden bokningsbar"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                  {isAdmin && !isEditing && (
                    <button
                      className="rounded bg-background/50 p-1 text-foreground/80 hover:bg-background/80"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditor(i);
                      }}
                      title="Redigera pass"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                  <span className="shrink-0 tabular-nums text-[10px] opacity-75">
                    {toTime(startMin)}-{toTime(endMin)}
                  </span>
                </div>
              </div>

              {isAdmin && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize bg-foreground/0 hover:bg-foreground/20"
                  onPointerDown={(e) => onPointerDown(e, "resize-bottom", i)}
                />
              )}
            </div>
          );
        })}

        {preview?.targetDay === day && drag?.kind === "move" && (
          <div
            className="pointer-events-none absolute left-1 right-1 rounded-md ring-2 ring-primary bg-primary/20"
            style={{
              top: (preview.start - DAY_START_MIN) * PX_PER_MIN,
              height: Math.max(8, (preview.end - preview.start) * PX_PER_MIN),
            }}
          />
        )}

        {createPreview && drag?.kind === "create" && (
          <div
            className="pointer-events-none absolute left-1 right-1 rounded-md bg-primary/30 ring-2 ring-primary px-2 py-1 text-xs font-medium text-foreground"
            style={{
              top: (createPreview.start - DAY_START_MIN) * PX_PER_MIN,
              height: Math.max(8, (createPreview.end - createPreview.start) * PX_PER_MIN),
            }}
          >
            <span className="tabular-nums">
              {toTime(createPreview.start)}-{toTime(createPreview.end)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export const TIMELINE_PX_PER_MIN = PX_PER_MIN;
