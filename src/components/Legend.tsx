import { useState, useRef, useEffect } from "react";
import { type SlotCategory } from "@/data/schedule";
import { ChevronDown } from "lucide-react";

const teams = ["U8", "U9", "U10", "U11", "U12", "U13", "U14", "U15", "U16", "BJ", "VR A-lag", "Oldtimers"] as const;
export type TeamFilter = typeof teams[number] | null;

const items: { label: string; category: SlotCategory; className: string; hasDropdown?: boolean }[] = [
  { label: "Lagträning", category: "team", className: "bg-schedule-team", hasDropdown: true },
  { label: "Allmänhet", category: "public", className: "bg-schedule-public" },
  { label: "Match", category: "match", className: "bg-schedule-match" },
  { label: "Hockeyskolan", category: "school", className: "bg-schedule-school" },
  { label: "Event", category: "event", className: "bg-schedule-event" },
  { label: "Bokningsbar", category: "booking", className: "bg-schedule-booking" },
  { label: "Spolning", category: "maintenance", className: "bg-schedule-maintenance" },
];

type LegendProps = {
  activeCategories: Set<SlotCategory>;
  onToggle: (cat: SlotCategory) => void;
  onShowAll: () => void;
  teamFilter: TeamFilter;
  onTeamFilter: (team: TeamFilter) => void;
};

export function Legend({ activeCategories, onToggle, onShowAll, teamFilter, onTeamFilter }: LegendProps) {
  const allActive = activeCategories.size === items.length && !teamFilter;
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleTeamSelect = (team: typeof teams[number]) => {
    onTeamFilter(team);
    setDropdownOpen(false);
  };

  const handleTeamCategoryClick = () => {
    if (teamFilter) {
      onTeamFilter(null);
      onToggle("team");
    } else {
      onToggle("team");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={() => { onTeamFilter(null); onShowAll(); }}
        className={`rounded-md px-2 py-1 text-xs font-medium transition-all ${
          allActive
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-muted-foreground hover:text-foreground"
        }`}
      >
        Alla
      </button>
      {items.map((item) => {
        const active = activeCategories.has(item.category);
        const isTeamWithFilter = item.category === "team" && teamFilter;

        if (item.hasDropdown) {
          return (
            <div key={item.label} className="relative" ref={dropdownRef}>
              <div className="flex items-center">
                <button
                  onClick={handleTeamCategoryClick}
                  className={`flex items-center gap-2 rounded-l-md px-2 py-1 transition-all ${
                    active ? "" : "opacity-40"
                  }`}
                >
                  <div className={`h-3 w-3 rounded-sm ${item.className}`} />
                  <span className="text-xs text-muted-foreground">
                    {isTeamWithFilter ? teamFilter : item.label}
                  </span>
                </button>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className={`rounded-r-md px-1 py-1 transition-all ${
                    active ? "" : "opacity-40"
                  }`}
                >
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
              {dropdownOpen && (
                <div className="absolute left-0 top-full z-[100] mt-1 min-w-[140px] rounded-md border border-border bg-popover p-1 shadow-lg">
                  <button
                    onClick={() => {
                      onTeamFilter(null);
                      if (!(activeCategories.size === 1 && activeCategories.has("team"))) {
                        onToggle("team");
                      }
                      setDropdownOpen(false);
                    }}
                    className={`w-full rounded-sm px-3 py-1.5 text-left text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${
                      !teamFilter && active ? "bg-accent/50 text-accent-foreground" : "text-popover-foreground"
                    }`}
                  >
                    Alla lag
                  </button>
                  {teams.map((team) => (
                    <button
                      key={team}
                      onClick={() => handleTeamSelect(team)}
                      className={`w-full rounded-sm px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground ${
                        teamFilter === team ? "bg-accent/50 font-medium text-accent-foreground" : "text-popover-foreground"
                      }`}
                    >
                      {team}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        }

        return (
          <button
            key={item.label}
            onClick={() => { onTeamFilter(null); onToggle(item.category); }}
            className={`flex items-center gap-2 rounded-md px-2 py-1 transition-all ${
              active ? "" : "opacity-40"
            }`}
          >
            <div className={`h-3 w-3 rounded-sm ${item.className}`} />
            <span className="text-xs text-muted-foreground">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
