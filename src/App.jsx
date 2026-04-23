import { useEffect, useMemo, useState } from "react";
import { loadSchedule } from "./lib/scheduleStore";
import { CATEGORIES, DAYS } from "./data/defaultSchedule";

function durationInHours(start, end) {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const minutes = endHour * 60 + endMinute - (startHour * 60 + startMinute);
  return minutes / 60;
}

function getCategoryMeta(categoryKey) {
  return CATEGORIES.find((category) => category.key === categoryKey);
}

function collectTeams(weeks) {
  const teams = new Set();

  weeks.forEach((week) => {
    Object.values(week.days).forEach((slots) => {
      slots.forEach((slot) => {
        if (slot.team) {
          teams.add(slot.team);
        }
      });
    });
  });

  return [...teams].sort((left, right) => left.localeCompare(right));
}

function App() {
  const [weeks, setWeeks] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: "", source: "local" });
  const [weekIndex, setWeekIndex] = useState(0);
  const [activeCategories, setActiveCategories] = useState(() =>
    new Set(CATEGORIES.map((category) => category.key))
  );
  const [teamFilter, setTeamFilter] = useState("");
  const [mobileDay, setMobileDay] = useState(DAYS[0].key);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      setStatus({ loading: true, error: "", source: "local" });
      try {
        const result = await loadSchedule();
        if (!mounted) {
          return;
        }
        setWeeks(result.weeks);
        setStatus({
          loading: false,
          error: result.error ? "Supabase kunde inte laddas, lokal fallback visas." : "",
          source: result.source,
        });
      } catch (error) {
        if (!mounted) {
          return;
        }
        setStatus({
          loading: false,
          error: error instanceof Error ? error.message : "Kunde inte ladda schema.",
          source: "local",
        });
      }
    }

    bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (weekIndex >= weeks.length) {
      setWeekIndex(0);
    }
  }, [weekIndex, weeks.length]);

  const currentWeek = weeks[weekIndex];
  const teams = useMemo(() => collectTeams(weeks), [weeks]);

  const visibleSlotsForDay = (dayKey) => {
    if (!currentWeek) {
      return [];
    }

    return (currentWeek.days[dayKey] || []).filter((slot) => {
      const categoryAllowed = activeCategories.has(slot.category);
      const teamAllowed = !teamFilter || slot.team === teamFilter;
      return categoryAllowed && teamAllowed;
    });
  };

  const visibleSlotsForWeek = useMemo(
    () => DAYS.flatMap((day) => visibleSlotsForDay(day.key)),
    [currentWeek, activeCategories, teamFilter]
  );

  const overviewCards = useMemo(() => {
    const publicHours = visibleSlotsForWeek
      .filter((slot) => slot.category === "public")
      .reduce((sum, slot) => sum + durationInHours(slot.start, slot.end), 0);
    const matchCount = visibleSlotsForWeek.filter((slot) => slot.category === "match").length;
    const teamCount = new Set(visibleSlotsForWeek.map((slot) => slot.team).filter(Boolean)).size;

    return [
      { label: "Visade pass", value: visibleSlotsForWeek.length, meta: "Efter valda filter" },
      { label: "Allmanhet", value: `${publicHours.toFixed(1)} h`, meta: "Tillganglig aktid" },
      { label: "Matcher", value: matchCount, meta: "Matcher under veckan" },
      { label: "Aktiva lag", value: teamCount, meta: "Lag i aktuell vy" },
    ];
  }, [visibleSlotsForWeek]);

  function toggleCategory(categoryKey) {
    setActiveCategories((current) => {
      const next = new Set(current);
      const isOnlyOneActive = next.size === 1 && next.has(categoryKey);

      if (isOnlyOneActive) {
        return new Set(CATEGORIES.map((category) => category.key));
      }

      if (next.has(categoryKey)) {
        next.delete(categoryKey);
      } else {
        next.add(categoryKey);
      }

      return next;
    });
  }

  function resetFilters() {
    setActiveCategories(new Set(CATEGORIES.map((category) => category.key)));
    setTeamFilter("");
  }

  if (status.loading) {
    return <div className="screen-message">Laddar schema...</div>;
  }

  if (!currentWeek) {
    return <div className="screen-message">Ingen veckodata hittades.</div>;
  }

  return (
    <div className="page-shell">
      <header className="topbar">
        <div className="topbar__inner">
          <div className="brand-block">
            <div className="brand-row">
              <span className="brand-mark" aria-hidden="true" />
              <h1>Ishallsschema</h1>
            </div>
            <p className="eyebrow">Ice Time Tamer</p>
            <p className="subtitle">Visby Roma Ishall - Veckoschema</p>
          </div>

          <div className="badge-panel badge-panel--compact">
            <span className="badge-label">Datakalla</span>
            <strong>{status.source === "supabase" ? "Supabase" : "Lokal fallback"}</strong>
            <span className="badge-meta">Schema redo for GitHub Pages</span>
          </div>
        </div>
        {status.error ? <p className="status-banner">{status.error}</p> : null}
      </header>

      <main className="main-content">
        <section className="controls">
          <div className="week-switcher">
            <button
              className="icon-button"
              type="button"
              aria-label="Foregaende vecka"
              disabled={weekIndex === 0}
              onClick={() => setWeekIndex((value) => Math.max(0, value - 1))}
            >
              {"<"}
            </button>

            <div className="week-list week-list--center" aria-label="Veckoval">
              {weeks.map((week, index) => (
                <button
                  key={week.id}
                  type="button"
                  className={`week-button${index === weekIndex ? " is-active" : ""}`}
                  onClick={() => setWeekIndex(index)}
                >
                  {week.label}
                </button>
              ))}
            </div>

            <button
              className="icon-button"
              type="button"
              aria-label="Nasta vecka"
              disabled={weekIndex === weeks.length - 1}
              onClick={() => setWeekIndex((value) => Math.min(weeks.length - 1, value + 1))}
            >
              {">"}
            </button>
          </div>

          <div className="filter-toolbar filter-toolbar--inline">
            <div className="filter-group filter-group--chips">
              <span className="filter-title">Filter</span>
              <div className="chip-list">
                <button
                  type="button"
                  className={`chip${activeCategories.size === CATEGORIES.length ? " is-active" : ""}`}
                  onClick={resetFilters}
                >
                  Alla
                </button>
                {CATEGORIES.map((category) => (
                  <button
                    key={category.key}
                    type="button"
                    className={`chip${activeCategories.has(category.key) ? " is-active" : ""}`}
                    onClick={() => toggleCategory(category.key)}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="filter-group filter-group--select filter-group--inline-select">
              <span className="filter-title">Lag</span>
              <select
                className="select-input"
                value={teamFilter}
                onChange={(event) => setTeamFilter(event.target.value)}
              >
                <option value="">Alla lag</option>
                {teams.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="overview-grid" aria-label="Veckooversikt">
          {overviewCards.map((card) => (
            <article key={card.label} className="overview-card">
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <span>{card.meta}</span>
            </article>
          ))}
        </section>

        <section className="schedule-panel">
          <div className="schedule-panel__header">
            <div className="schedule-heading">
              <p className="eyebrow">Schema</p>
              <h2>{`${currentWeek.label} | ${currentWeek.subtitle}`}</h2>
            </div>

            <div className="legend legend--compact">
              {CATEGORIES.map((category) => (
                <span key={category.key} className="legend-item">
                  <span className="legend-dot" style={{ background: category.color }} />
                  {category.label}
                </span>
              ))}
            </div>
          </div>

          <div className="mobile-day-tabs" aria-label="Dagsval">
            {DAYS.map((day) => (
              <button
                key={day.key}
                type="button"
                className={`day-tab${mobileDay === day.key ? " is-active" : ""}`}
                onClick={() => setMobileDay(day.key)}
              >
                {day.label}
              </button>
            ))}
          </div>

          <div className="schedule-grid" aria-live="polite">
            {DAYS.map((day) => {
              const slots = visibleSlotsForDay(day.key);

              return (
                <section
                  key={day.key}
                  className={`day-column${mobileDay === day.key ? " is-mobile-active" : ""}`}
                >
                  <header className="day-header">
                    <h3>{day.label}</h3>
                    <span>{currentWeek.subtitle}</span>
                  </header>

                  {!slots.length ? (
                    <div className="empty-state">Inga pass matchar valda filter den har dagen.</div>
                  ) : (
                    <div className="slot-list">
                      {slots.map((slot, index) => {
                        const category = getCategoryMeta(slot.category);
                        return (
                          <article
                            key={`${day.key}-${slot.start}-${index}`}
                            className={`slot-card slot-card--compact ${category.css}`}
                          >
                            <div className="slot-card__meta">
                              <p className="slot-card__title">{slot.title}</p>
                              <span className="slot-card__time">{`${slot.start}-${slot.end}`}</span>
                            </div>
                            <div className="slot-card__details">
                              <span className="slot-pill">{category.label}</span>
                              {slot.team ? <span className="slot-pill">{slot.team}</span> : null}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
