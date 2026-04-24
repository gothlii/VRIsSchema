import { useRef, useState, useCallback, useEffect } from "react";
import { type TimeSlot, type SlotCategory, getCategory } from "@/data/schedule";
import { DAY_START_MIN, DAY_END_MIN, toMin, toTime, snap, MIN_SLOT_LEN } from "@/lib/scheduleEdit";

const PX_PER_MIN = 1.4; // ~14h * 60 * 1.4 ≈ 1180 px tall
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

type DragState =
  | { kind: "move"; index: number; pointerStart: number; origStart: number; origEnd: number }
  | { kind: "resize-top"; index: number; pointerStart: number; origStart: number; origEnd: number }
  | { kind: "resize-bottom"; index: number; pointerStart: number; origStart: number; origEnd: number }
  | { kind: "create"; pointerStart: number; origMin: number }
  | null;

type Props = {
  day: string;
  slots: TimeSlot[];
  onResize: (index: number, newStartMin: number, newEndMin: number) => void;
  onMove: (index: number, newStartMin: number) => void;
  onMoveToDay?: (index: number, targetDay: string, newStartMin: number) => void;
  onCreate?: (newStartMin: number, newEndMin: number) => void;
  registerColumn?: (day: string, el: HTMLDivElement | null) => void;
  getDayAtPoint?: (clientX: number, clientY: number) => { day: string; min: number } | null;
};

export function TimelineDay({ day, slots, onResize, onMove, onMoveToDay, onCreate, registerColumn, getDayAtPoint }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState>(null);
  const [preview, setPreview] = useState<{ index: number; start: number; end: number; targetDay?: string } | null>(null);
  const [createPreview, setCreatePreview] = useState<{ start: number; end: number } | null>(null);

  useEffect(() => {
    if (registerColumn) {
      registerColumn(day, ref.current);
      return () => registerColumn(day, null);
    }
  }, [day, registerColumn]);

  const totalMin = DAY_END_MIN - DAY_START_MIN;
  const height = totalMin * PX_PER_MIN;

  const onPointerDown = useCallback(
    (e: React.PointerEvent, kind: "move" | "resize-top" | "resize-bottom", index: number) => {
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
    [slots],
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
        // Cross-day support
        if (getDayAtPoint && onMoveToDay) {
          const hit = getDayAtPoint(e.clientX, e.clientY);
          if (hit && hit.day !== day) {
            const dur = drag.origEnd - drag.origStart;
            const s = Math.max(DAY_START_MIN, Math.min(DAY_END_MIN - dur, snap(hit.min - dur / 2)));
            setPreview({ index: drag.index, start: s, end: s + dur, targetDay: hit.day });
            return;
          }
        }
        const dur = drag.origEnd - drag.origStart;
        let s = snap(drag.origStart + deltaMin);
        s = Math.max(DAY_START_MIN, Math.min(DAY_END_MIN - dur, s));
        setPreview({ index: drag.index, start: s, end: s + dur });
      } else if (drag.kind === "resize-top") {
        let s = snap(drag.origStart + deltaMin);
        s = Math.max(DAY_START_MIN, Math.min(drag.origEnd - MIN_SLOT_LEN, s));
        setPreview({ index: drag.index, start: s, end: drag.origEnd });
      } else if (drag.kind === "resize-bottom") {
        let en = snap(drag.origEnd + deltaMin);
        en = Math.max(drag.origStart + MIN_SLOT_LEN, Math.min(DAY_END_MIN, en));
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

  // Hour grid lines
  const hourLines: number[] = [];
  for (let m = DAY_START_MIN; m <= DAY_END_MIN; m += HOUR_LABEL_EVERY) hourLines.push(m);

  return (
    <div className="min-w-0">
      <div className="sticky top-0 z-10 mb-2 rounded-lg bg-secondary px-4 py-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-secondary-foreground">{day}</h3>
      </div>
      <div
        ref={ref}
        data-day={day}
        className="relative rounded-md border border-border/40 bg-card/30"
        style={{ height, touchAction: "none" }}
        onPointerDown={(e) => {
          if (!onCreate) return;
          // Only fire on the background itself (not on a slot)
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
        {/* hour grid */}
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

        {/* slots */}
        {slots.map((slot, i) => {
          const isPreviewSlot = preview?.index === i;
          const isMovingAway = isPreviewSlot && preview?.targetDay && preview.targetDay !== day;
          const startMin = isPreviewSlot && !isMovingAway ? preview!.start : toMin(slot.start);
          const endMin = isPreviewSlot && !isMovingAway ? preview!.end : toMin(slot.end);
          const top = (startMin - DAY_START_MIN) * PX_PER_MIN;
          const h = Math.max(8, (endMin - startMin) * PX_PER_MIN);
          const cat = getCategory(slot);
          const isMaintenance = cat === "maintenance";
          return (
            <div
              key={`${slot.start}-${i}`}
              className={`absolute left-1 right-1 select-none overflow-hidden rounded-md px-2 py-1 shadow-sm ${categoryStyles[cat]} ${
                isMaintenance ? "text-[10px] opacity-70" : "text-xs"
              } ${isPreviewSlot && !isMovingAway ? "ring-2 ring-primary z-30" : ""} ${
                isMovingAway ? "opacity-30" : ""
              }`}
              style={{ top, height: h, touchAction: "none", cursor: drag?.kind === "move" && drag.index === i ? "grabbing" : "grab" }}
              onPointerDown={(e) => onPointerDown(e, "move", i)}
            >
              {/* top resize handle */}
              <div
                className="absolute left-0 right-0 top-0 h-1.5 cursor-ns-resize bg-foreground/0 hover:bg-foreground/20"
                onPointerDown={(e) => onPointerDown(e, "resize-top", i)}
              />
              <div className="flex items-start justify-between gap-1 leading-tight">
                <span className="truncate font-medium">{slot.activity}</span>
                <span className="shrink-0 tabular-nums text-[10px] opacity-75">
                  {toTime(startMin)}–{toTime(endMin)}
                </span>
              </div>
              {/* bottom resize handle */}
              <div
                className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize bg-foreground/0 hover:bg-foreground/20"
                onPointerDown={(e) => onPointerDown(e, "resize-bottom", i)}
              />
            </div>
          );
        })}

        {/* cross-day move ghost */}
        {preview?.targetDay === day && drag?.kind === "move" && (
          <div
            className="pointer-events-none absolute left-1 right-1 rounded-md ring-2 ring-primary bg-primary/20"
            style={{
              top: (preview.start - DAY_START_MIN) * PX_PER_MIN,
              height: Math.max(8, (preview.end - preview.start) * PX_PER_MIN),
            }}
          />
        )}

        {/* create preview */}
        {createPreview && drag?.kind === "create" && (
          <div
            className="pointer-events-none absolute left-1 right-1 rounded-md bg-primary/30 ring-2 ring-primary px-2 py-1 text-xs font-medium text-foreground"
            style={{
              top: (createPreview.start - DAY_START_MIN) * PX_PER_MIN,
              height: Math.max(8, (createPreview.end - createPreview.start) * PX_PER_MIN),
            }}
          >
            <span className="tabular-nums">
              {toTime(createPreview.start)}–{toTime(createPreview.end)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export const TIMELINE_PX_PER_MIN = PX_PER_MIN;