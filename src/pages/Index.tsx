import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { days, weeks, type SlotCategory, type WeekSchedule, type TimeSlot } from "@/data/schedule";
import { DayColumn } from "@/components/DayColumn";
import { type TeamFilter } from "@/components/Legend";
import { Legend } from "@/components/Legend";
import { AdminButton } from "@/components/AdminButton";
import { useAdmin } from "@/contexts/AdminContext";
import { X, ChevronLeft, ChevronRight, Undo2, Download } from "lucide-react";
import { ImportScheduleDialog } from "@/components/ImportScheduleDialog";
import { CopyWeekDialog } from "@/components/CopyWeekDialog";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { downloadWeekXml } from "@/lib/exportScheduleXml";
import { TimelineDay, TIMELINE_PX_PER_MIN } from "@/components/TimelineDay";
import { resizeSlot, moveSlot, moveSlotToDay, insertSlot, DAY_START_MIN } from "@/lib/scheduleEdit";
import {
  deleteWeek,
  fetchWeeks as fetchRemoteWeeks,
  hasRemoteStore,
  type WeekRow,
  updateWeekData,
} from "@/lib/weeksStore";

const allCategories: SlotCategory[] = ["booking", "public", "team", "maintenance", "match", "school", "event"];
const allTeams = ["U8", "U9", "U10", "U11", "U12", "U13", "U14", "U15", "U16", "BJ", "VR A-lag", "Oldtimers"];

function getIsoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function extractWeekNumber(label: string): number | null {
  const m = label.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

const fallbackWeeksList: WeekRow[] = weeks.map((week, index) => ({
  id: `fallback-${index + 1}`,
  label: week.label,
  data: week.data,
  sort_order: index + 1,
}));

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [weeksList, setWeeksList] = useState<WeekRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAdmin } = useAdmin();
  const isMobile = useIsMobile();

  const weekParam = searchParams.get("w");
  const weekIdx = useMemo(() => {
    if (!weekParam || weeksList.length === 0) return 0;
    const byLabel = weeksList.findIndex((w) => w.label === weekParam);
    if (byLabel >= 0) return byLabel;
    const asNum = parseInt(weekParam, 10);
    if (!Number.isNaN(asNum) && asNum >= 0 && asNum < weeksList.length) return asNum;
    return 0;
  }, [weekParam, weeksList]);

  const catsParam = searchParams.get("cats");
  const activeCategories = useMemo<Set<SlotCategory>>(() => {
    if (!catsParam) return new Set(allCategories);
    const parts = catsParam.split(",").filter((c) => allCategories.includes(c as SlotCategory)) as SlotCategory[];
    return parts.length > 0 ? new Set(parts) : new Set(allCategories);
  }, [catsParam]);

  const teamParam = searchParams.get("team");
  const teamFilter: TeamFilter = (teamParam && allTeams.includes(teamParam) ? teamParam : null) as TeamFilter;

  const dayParam = searchParams.get("d");
  const selectedDay = useMemo(() => {
    const n = dayParam ? parseInt(dayParam, 10) : 0;
    return !Number.isNaN(n) && n >= 0 && n < days.length ? n : 0;
  }, [dayParam]);

  const updateParams = useCallback((updates: Record<string, string | null>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setWeekIdx = (i: number) => {
    const w = weeksList[i];
    updateParams({ w: w ? w.label : String(i) });
  };
  const setSelectedDay = (i: number) => updateParams({ d: i === 0 ? null : String(i) });
  const setTeamFilter = (t: TeamFilter) => updateParams({ team: t });

  const week = weeksList[weekIdx];

  useEffect(() => {
    const loadWeeks = async () => {
      if (!hasRemoteStore) {
        setWeeksList(fallbackWeeksList);
        setLoading(false);
        return;
      }

      try {
        const remoteWeeks = await fetchRemoteWeeks();
        setWeeksList(remoteWeeks.length > 0 ? remoteWeeks : fallbackWeeksList);
      } catch (error) {
        toast({
          title: "Kunde inte ladda schemat",
          description: error instanceof Error ? error.message : "Okant fel",
          variant: "destructive",
        });
        setWeeksList(fallbackWeeksList);
      } finally {
        setLoading(false);
      }
    };

    loadWeeks();
  }, []);

  const toggleCategory = (cat: SlotCategory) => {
    if (activeCategories.size === 1 && activeCategories.has(cat)) {
      updateParams({ cats: null });
    } else {
      updateParams({ cats: cat });
    }
  };

  const showAllCategories = () => {
    updateParams({ cats: null, team: null });
  };

  const handleImport = (label: string, data: WeekSchedule, id: string, sort_order: number) => {
    const newWeek: WeekRow = { id, label, data, sort_order };
    setWeeksList((prev) => [...prev, newWeek].sort((a, b) => a.sort_order - b.sort_order));
    updateParams({ w: label });
  };

  const handleRemove = async (i: number) => {
    if (!hasRemoteStore || weeksList.length <= 1) return;
    const weekToRemove = weeksList[i];

    try {
      await deleteWeek(weekToRemove.id);
    } catch (error) {
      toast({
        title: "Kunde inte ta bort veckan",
        description: error instanceof Error ? error.message : "Okant fel",
        variant: "destructive",
      });
      return;
    }

    setWeeksList((prev) => prev.filter((_, idx) => idx !== i));
    if (weekIdx >= i) {
      const newIdx = Math.max(0, weekIdx - 1);
      const remaining = weeksList.filter((_, idx) => idx !== i);
      const target = remaining[newIdx];
      updateParams({ w: target ? target.label : null });
    }
  };

  const handleRemoveSlot = useCallback(async (day: string, slotIndex: number) => {
    if (!hasRemoteStore) return;
    const currentWeek = weeksList[weekIdx];
    if (!currentWeek) return;

    const daySlots = [...(currentWeek.data[day] || [])];
    const removed = daySlots[slotIndex];
    const activity = (removed?.activity || "").toLowerCase();
    const isMaintenance = activity === "spolning" || activity.startsWith("isvard");

    let newDaySlots: TimeSlot[];
    if (isMaintenance) {
      if (slotIndex > 0) {
        newDaySlots = daySlots.filter((_, i) => i !== slotIndex);
        newDaySlots[slotIndex - 1] = {
          ...newDaySlots[slotIndex - 1],
          end: removed.end,
        };
      } else {
        newDaySlots = daySlots.filter((_, i) => i !== slotIndex);
      }
    } else {
      daySlots[slotIndex] = { start: removed.start, end: removed.end, activity: "BOKNINGSBAR" };
      newDaySlots = daySlots;
    }

    const merged: TimeSlot[] = [];
    for (const slot of newDaySlots) {
      const last = merged[merged.length - 1];
      if (last && last.activity === "BOKNINGSBAR" && slot.activity === "BOKNINGSBAR" && last.end === slot.start) {
        last.end = slot.end;
      } else {
        merged.push({ ...slot });
      }
    }

    const newData = { ...currentWeek.data, [day]: merged };

    try {
      await updateWeekData(currentWeek.id, JSON.parse(JSON.stringify(newData)));
    } catch (error) {
      toast({
        title: "Kunde inte uppdatera schemat",
        description: error instanceof Error ? error.message : "Okant fel",
        variant: "destructive",
      });
      return;
    }

    setWeeksList((prev) => {
      const updated = [...prev];
      updated[weekIdx] = { ...currentWeek, data: newData };
      return updated;
    });
  }, [weekIdx, weeksList]);

  const handleRenameSlot = useCallback(async (day: string, slotIndex: number, newActivity: string) => {
    if (!hasRemoteStore) return;
    const currentWeek = weeksList[weekIdx];
    if (!currentWeek) return;

    const daySlots = [...(currentWeek.data[day] || [])];
    if (!daySlots[slotIndex]) return;
    daySlots[slotIndex] = { ...daySlots[slotIndex], activity: newActivity };
    const newData = { ...currentWeek.data, [day]: daySlots };

    try {
      await updateWeekData(currentWeek.id, JSON.parse(JSON.stringify(newData)));
    } catch (error) {
      toast({
        title: "Kunde inte spara andringen",
        description: error instanceof Error ? error.message : "Okant fel",
        variant: "destructive",
      });
      return;
    }

    setWeeksList((prev) => {
      const updated = [...prev];
      updated[weekIdx] = { ...currentWeek, data: newData };
      return updated;
    });
  }, [weekIdx, weeksList]);

  const handleChangeCategory = useCallback(async (day: string, slotIndex: number, newCategory: SlotCategory) => {
    if (!hasRemoteStore) return;
    const currentWeek = weeksList[weekIdx];
    if (!currentWeek) return;

    const daySlots = [...(currentWeek.data[day] || [])];
    if (!daySlots[slotIndex]) return;
    daySlots[slotIndex] = { ...daySlots[slotIndex], category: newCategory };
    const newData = { ...currentWeek.data, [day]: daySlots };

    try {
      await updateWeekData(currentWeek.id, JSON.parse(JSON.stringify(newData)));
    } catch (error) {
      toast({
        title: "Kunde inte andra kategori",
        description: error instanceof Error ? error.message : "Okant fel",
        variant: "destructive",
      });
      return;
    }

    setWeeksList((prev) => {
      const updated = [...prev];
      updated[weekIdx] = { ...currentWeek, data: newData };
      return updated;
    });
  }, [weekIdx, weeksList]);

  const undoStackRef = useRef<{ weekId: string; data: WeekSchedule }[]>([]);
  const [undoVersion, setUndoVersion] = useState(0);
  const currentWeekId = weeksList[weekIdx]?.id;

  const persistWeekData = useCallback(async (newData: WeekSchedule, recordUndo = true) => {
    if (!hasRemoteStore) return;
    const currentWeek = weeksList[weekIdx];
    if (!currentWeek) return;

    if (recordUndo) {
      undoStackRef.current.push({ weekId: currentWeek.id, data: currentWeek.data });
      if (undoStackRef.current.length > 50) undoStackRef.current.shift();
      setUndoVersion((v) => v + 1);
    }

    setWeeksList((prev) => {
      const updated = [...prev];
      updated[weekIdx] = { ...currentWeek, data: newData };
      return updated;
    });

    try {
      await updateWeekData(currentWeek.id, JSON.parse(JSON.stringify(newData)));
    } catch (error) {
      toast({
        title: "Kunde inte spara andringen",
        description: error instanceof Error ? error.message : "Okant fel",
        variant: "destructive",
      });
    }
  }, [weekIdx, weeksList]);

  const handleResizeSlot = useCallback((day: string, slotIndex: number, newStartMin: number, newEndMin: number) => {
    const currentWeek = weeksList[weekIdx];
    if (!currentWeek) return;
    const updatedDay = resizeSlot(currentWeek.data[day] || [], slotIndex, newStartMin, newEndMin);
    persistWeekData({ ...currentWeek.data, [day]: updatedDay });
  }, [weekIdx, weeksList, persistWeekData]);

  const handleMoveSlot = useCallback((day: string, slotIndex: number, newStartMin: number) => {
    const currentWeek = weeksList[weekIdx];
    if (!currentWeek) return;
    const updatedDay = moveSlot(currentWeek.data[day] || [], slotIndex, newStartMin);
    persistWeekData({ ...currentWeek.data, [day]: updatedDay });
  }, [weekIdx, weeksList, persistWeekData]);

  const handleMoveSlotToDay = useCallback((fromDay: string, slotIndex: number, toDay: string, newStartMin: number) => {
    const currentWeek = weeksList[weekIdx];
    if (!currentWeek) return;
    const { from, to } = moveSlotToDay(
      currentWeek.data[fromDay] || [],
      slotIndex,
      currentWeek.data[toDay] || [],
      newStartMin,
    );
    persistWeekData({ ...currentWeek.data, [fromDay]: from, [toDay]: to });
  }, [weekIdx, weeksList, persistWeekData]);

  const handleCreateSlot = useCallback((day: string, newStartMin: number, newEndMin: number) => {
    const currentWeek = weeksList[weekIdx];
    if (!currentWeek) return;
    const updatedDay = insertSlot(currentWeek.data[day] || [], newStartMin, newEndMin, "Nytt pass");
    persistWeekData({ ...currentWeek.data, [day]: updatedDay });
  }, [weekIdx, weeksList, persistWeekData]);

  const canUndo = useMemo(
    () => undoStackRef.current.some((s) => s.weekId === currentWeekId),
    [currentWeekId, undoVersion],
  );

  const handleUndo = useCallback(() => {
    for (let i = undoStackRef.current.length - 1; i >= 0; i--) {
      if (undoStackRef.current[i].weekId === currentWeekId) {
        const [snap] = undoStackRef.current.splice(i, 1);
        setUndoVersion((v) => v + 1);
        persistWeekData(snap.data, false);
        return;
      }
    }
  }, [currentWeekId, persistWeekData]);

  const dayColumnsRef = useRef<Record<string, HTMLDivElement | null>>({});
  const registerColumn = useCallback((day: string, el: HTMLDivElement | null) => {
    dayColumnsRef.current[day] = el;
  }, []);

  const getDayAtPoint = useCallback((clientX: number, clientY: number) => {
    for (const [day, el] of Object.entries(dayColumnsRef.current)) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
        const min = DAY_START_MIN + (clientY - r.top) / TIMELINE_PX_PER_MIN;
        return { day, min };
      }
    }
    return null;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Laddar schema...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="relative z-50 border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Ishallsschema
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Visby Roma Ishall - Veckoschema
              </p>
            </div>
            <div className="flex items-center gap-2">
              {(() => {
                const currentIso = getIsoWeek(new Date());
                const primaryIdxs: number[] = [];
                const currentWeekIdx = weeksList.findIndex((w) => extractWeekNumber(w.label) === currentIso);
                const nextWeekIdx = weeksList.findIndex((w) => extractWeekNumber(w.label) === currentIso + 1);
                if (currentWeekIdx >= 0) primaryIdxs.push(currentWeekIdx);
                if (nextWeekIdx >= 0) primaryIdxs.push(nextWeekIdx);
                if (primaryIdxs.length < 2) {
                  const upcomingIdxs = weeksList
                    .map((w, idx) => ({ idx, num: extractWeekNumber(w.label) }))
                    .filter((x) => x.num !== null && x.num >= currentIso && !primaryIdxs.includes(x.idx))
                    .sort((a, b) => a.num! - b.num!)
                    .map((x) => x.idx);
                  for (const idx of upcomingIdxs) {
                    if (primaryIdxs.length >= 2) break;
                    primaryIdxs.push(idx);
                  }
                  if (primaryIdxs.length === 0 && weeksList.length > 0) {
                    const sortedDesc = [...weeksList.keys()].sort(
                      (a, b) => (extractWeekNumber(weeksList[b].label) ?? 0) - (extractWeekNumber(weeksList[a].label) ?? 0),
                    );
                    primaryIdxs.push(sortedDesc[0]);
                    if (sortedDesc.length > 1) primaryIdxs.push(sortedDesc[1]);
                  }
                }

                primaryIdxs.sort((a, b) => (extractWeekNumber(weeksList[a].label) ?? 0) - (extractWeekNumber(weeksList[b].label) ?? 0));
                const isPrimary = primaryIdxs.includes(weekIdx);
                const canPrev = weekIdx > 0;
                const canNext = weekIdx < weeksList.length - 1;

                return (
                  <div className="flex items-center gap-2 rounded-lg bg-secondary p-1">
                    <button
                      onClick={() => canPrev && setWeekIdx(weekIdx - 1)}
                      disabled={!canPrev}
                      className="rounded-md p-2 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Foregaende vecka"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    {primaryIdxs.map((i) => {
                      const w = weeksList[i];
                      return (
                        <div key={w.id} className="relative flex items-center group">
                          <button
                            onClick={() => setWeekIdx(i)}
                            className={`rounded-md px-4 py-2 text-sm font-semibold transition-all ${
                              weekIdx === i
                                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {w.label}
                          </button>
                          {isAdmin && hasRemoteStore && weeksList.length > 1 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRemove(i); }}
                              className="ml-0.5 rounded-full p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                              title="Ta bort vecka"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {!isPrimary && week && (
                      <div className="relative flex items-center group">
                        <span className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25">
                          {week.label}
                        </span>
                        {isAdmin && hasRemoteStore && weeksList.length > 1 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemove(weekIdx); }}
                            className="ml-0.5 rounded-full p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                            title="Ta bort vecka"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => canNext && setWeekIdx(weekIdx + 1)}
                      disabled={!canNext}
                      className="rounded-md p-2 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Nasta vecka"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                );
              })()}
              {isAdmin && <ImportScheduleDialog onImport={handleImport} />}
              {isAdmin && week && (
                <CopyWeekDialog
                  sourceLabel={week.label}
                  sourceData={week.data}
                  existingLabels={weeksList.map((w) => w.label)}
                  onCopied={handleImport}
                />
              )}
              {isAdmin && hasRemoteStore && (
                <button
                  onClick={handleUndo}
                  disabled={!canUndo}
                  className="flex items-center gap-1 rounded-md bg-secondary px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Angra senaste andring"
                >
                  <Undo2 className="h-4 w-4" />
                  Angra
                </button>
              )}
              {isAdmin && week && (
                <button
                  onClick={() => downloadWeekXml(week.label, week.sort_order, week.data)}
                  className="flex items-center gap-1 rounded-md bg-secondary px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  title={`Ladda ner ${week.label} som XML`}
                >
                  <Download className="h-4 w-4" />
                  Exportera XML
                </button>
              )}
              <AdminButton />
            </div>
          </div>
          <div className="mt-4">
            <Legend
              activeCategories={activeCategories}
              onToggle={toggleCategory}
              onShowAll={showAllCategories}
              teamFilter={teamFilter}
              onTeamFilter={setTeamFilter}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <AnimatePresence mode="wait">
          {week && (
            <motion.div
              key={week.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              {isMobile ? (
                (teamFilter || activeCategories.size < allCategories.length) ? (
                  <div className="flex flex-col gap-4">
                    {days.map((day) => (
                      <DayColumn
                        key={day}
                        day={day}
                        slots={week.data[day] || []}
                        activeCategories={activeCategories}
                        teamFilter={teamFilter}
                        isAdmin={isAdmin}
                        onRemoveSlot={isAdmin && hasRemoteStore ? (slotIdx) => handleRemoveSlot(day, slotIdx) : undefined}
                        onRenameSlot={isAdmin && hasRemoteStore ? (slotIdx, val) => handleRenameSlot(day, slotIdx, val) : undefined}
                        onChangeCategory={isAdmin && hasRemoteStore ? (slotIdx, cat) => handleChangeCategory(day, slotIdx, cat) : undefined}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-1 overflow-x-auto rounded-lg bg-secondary p-1">
                      {days.map((day, i) => (
                        <button
                          key={day}
                          onClick={() => setSelectedDay(i)}
                          className={`flex-1 min-w-0 rounded-md px-2 py-2 text-xs font-bold uppercase transition-all ${
                            selectedDay === i
                              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {day.slice(0, 3)}
                        </button>
                      ))}
                    </div>
                    <DayColumn
                      day={days[selectedDay]}
                      slots={week.data[days[selectedDay]] || []}
                      activeCategories={activeCategories}
                      teamFilter={teamFilter}
                      isAdmin={isAdmin}
                      onRemoveSlot={isAdmin && hasRemoteStore ? (slotIdx) => handleRemoveSlot(days[selectedDay], slotIdx) : undefined}
                      onRenameSlot={isAdmin && hasRemoteStore ? (slotIdx, val) => handleRenameSlot(days[selectedDay], slotIdx, val) : undefined}
                      onChangeCategory={isAdmin && hasRemoteStore ? (slotIdx, cat) => handleChangeCategory(days[selectedDay], slotIdx, cat) : undefined}
                    />
                  </div>
                )
              ) : (
                isAdmin && hasRemoteStore ? (
                  <div className="grid grid-cols-7 gap-2">
                    {days.map((day) => (
                      <TimelineDay
                        key={day}
                        day={day}
                        slots={week.data[day] || []}
                        onResize={(idx, s, e) => handleResizeSlot(day, idx, s, e)}
                        onMove={(idx, s) => handleMoveSlot(day, idx, s)}
                        onMoveToDay={(idx, toDay, s) => handleMoveSlotToDay(day, idx, toDay, s)}
                        onCreate={(s, e) => handleCreateSlot(day, s, e)}
                        registerColumn={registerColumn}
                        getDayAtPoint={getDayAtPoint}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-7 gap-2">
                    {days.map((day) => (
                      <DayColumn
                        key={day}
                        day={day}
                        slots={week.data[day] || []}
                        activeCategories={activeCategories}
                        teamFilter={teamFilter}
                        isAdmin={isAdmin}
                      />
                    ))}
                  </div>
                )
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Index;
