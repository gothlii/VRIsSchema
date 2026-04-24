import { type TimeSlot, type SlotCategory, getCategory } from "@/data/schedule";
import { type TeamFilter } from "./Legend";
import { ScheduleSlot } from "./ScheduleSlot";

type Props = {
  day: string;
  dateLabel?: string;
  isToday?: boolean;
  slots: TimeSlot[];
  activeCategories: Set<SlotCategory>;
  teamFilter?: TeamFilter;
  isAdmin?: boolean;
  onRemoveSlot?: (slotIndex: number) => void;
  onRenameSlot?: (slotIndex: number, newActivity: string) => void;
  onChangeCategory?: (slotIndex: number, newCategory: SlotCategory) => void;
};

function matchesTeamFilter(activity: string, team: string): boolean {
  const upper = activity.toUpperCase();
  const teamUpper = team.toUpperCase();
  
  // Direct match for teams like "U12", "BJ (helplan)", "VR A-lag"
  if (team === "VR A-lag") return upper.includes("VR A-LAG");
  if (team === "BJ") return upper.startsWith("BJ");
  if (team === "Oldtimers") return upper.includes("OLDTIMERS");
  
  // For U-teams, match the team name as a word boundary
  // "U10 + U11 (delad is)" should match both U10 and U11
  const regex = new RegExp(`\\b${teamUpper}\\b`);
  return regex.test(upper);
}

export function DayColumn({ day, dateLabel, isToday, slots, activeCategories, teamFilter, isAdmin, onRemoveSlot, onRenameSlot, onChangeCategory }: Props) {
  const filtered = slots
    .map((slot, originalIndex) => ({ slot, originalIndex }))
    .filter(({ slot }) => {
      const cat = getCategory(slot);
      if (teamFilter) {
        return cat === "team" && matchesTeamFilter(slot.activity, teamFilter);
      }
      return activeCategories.has(cat);
    });

  return (
    <div className="min-w-0">
      <div className={`sticky top-0 z-10 mb-2 rounded-lg px-4 py-3 ${isToday ? "bg-primary/15 ring-1 ring-primary/40" : "bg-secondary"}`}>
        <h3 className={`text-sm font-bold tracking-wide uppercase ${isToday ? "text-primary" : "text-secondary-foreground"}`}>
          {day}
        </h3>
        {dateLabel ? <p className={`mt-1 text-xs ${isToday ? "text-primary/80" : "text-muted-foreground"}`}>{dateLabel}</p> : null}
      </div>
      <div className="flex flex-col gap-1">
        {filtered.map(({ slot, originalIndex }, i) => (
          <ScheduleSlot
            key={`${slot.start}-${slot.activity}-${originalIndex}`}
            slot={slot}
            index={i}
            isAdmin={isAdmin}
            onRemove={onRemoveSlot ? () => onRemoveSlot(originalIndex) : undefined}
            onRename={onRenameSlot ? (val) => onRenameSlot(originalIndex, val) : undefined}
            onChangeCategory={onChangeCategory ? (cat) => onChangeCategory(originalIndex, cat) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
