import { useState } from 'preact/hooks';
import {
  ZoomIn,
  StickyNote,
  Sparkles,
  Waves,
  Anchor,
  GraduationCap,
} from 'lucide-preact';
import {
  plannerState,
  activeHolidays,
  activeDayOverlays,
  bridgeHintDates,
  zoomLevel,
  focusedMonth,
  setDayNote,
} from '../store/plannerStore';
import {
  MONTH_NAMES,
  formatYMD,
  getDayOfWeek,
  getDaysInMonth,
  getDayPtoCost,
} from '../lib/dateUtils';
import {
  showDayTooltip,
  moveDayTooltip,
  hideDayTooltip,
} from './DayTooltip';
import type { DayEntry, Holiday, ResolvedDayOverlay } from '../types/planner';

interface CalendarGridProps {
  selectedRangeSet: Set<string>;
  onDayPointerDown: (ymd: string, e: MouseEvent) => void;
  onDayPointerEnter: (ymd: string) => void;
}

const WEEKDAYS_MON = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const WEEKDAYS_SUN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function getOverlayIconColor(ov: ResolvedDayOverlay, isPlanned: boolean): string {
  if (isPlanned) return 'text-slate-950';
  const q = ov.span.quality;
  if (q === 'good') return 'text-emerald-400';
  if (q === 'shoulder') return 'text-amber-400';
  if (q === 'bad') return 'text-rose-400';
  return 'text-orange-400';
}

export function CalendarGrid({
  selectedRangeSet,
  onDayPointerDown,
  onDayPointerEnter,
}: CalendarGridProps) {
  const state = plannerState.value;
  const holidays = activeHolidays.value;
  const dayOverlaysMap = activeDayOverlays.value;
  const bridgeDates = bridgeHintDates.value;
  const currentZoom = zoomLevel.value;
  const [editingNoteDate, setEditingNoteDate] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState<string>('');

  // Determine which months to render based on zoom level
  let visibleMonths: number[] = [];
  if (currentZoom === 'year-grid') {
    visibleMonths = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  } else if (currentZoom === '6-months') {
    const start = focusedMonth.value < 6 ? 0 : 6;
    visibleMonths = [start, start + 1, start + 2, start + 3, start + 4, start + 5];
  } else if (currentZoom === 'quarter') {
    const start = Math.min(9, focusedMonth.value);
    visibleMonths = [start, start + 1, start + 2];
  } else {
    visibleMonths = [focusedMonth.value];
  }

  const gridColsClass =
    currentZoom === 'year-grid'
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-6 gap-3.5 3xl:gap-4'
      : currentZoom === '6-months'
        ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 4xl:grid-cols-6 gap-4'
        : currentZoom === 'quarter'
          ? 'grid-cols-1 lg:grid-cols-3 gap-5'
          : 'grid-cols-1 max-w-4xl 3xl:max-w-6xl mx-auto';

  const weekdayLabels = state.weekStartsOnMonday ? WEEKDAYS_MON : WEEKDAYS_SUN;
  const todayYMD = new Date().toISOString().slice(0, 10);

  const openNoteEditor = (ymd: string, currentNote = '', e: MouseEvent) => {
    e.stopPropagation();
    setEditingNoteDate(ymd);
    setNoteInput(currentNote);
  };

  const saveNote = (ymd: string) => {
    setDayNote(ymd, noteInput);
    setEditingNoteDate(null);
  };

  return (
    <div data-testid="calendar-grid" class={`grid ${gridColsClass} select-none`}>
      {visibleMonths.map((monthIdx) => {
        const daysInMonth = getDaysInMonth(state.year, monthIdx);
        const firstYMD = formatYMD(state.year, monthIdx, 1);
        const rawFirstDow = getDayOfWeek(firstYMD); // 0=Sun..6=Sat
        const leadingBlanks = state.weekStartsOnMonday
          ? (rawFirstDow + 6) % 7
          : rawFirstDow;

        // Calculate monthly PTO summary & distinct overlays active in this month
        let monthConfirmed = 0;
        let monthDraft = 0;
        let monthHolidays = 0;
        const monthOverlaySummary = new Map<string, ResolvedDayOverlay>();

        for (let d = 1; d <= daysInMonth; d++) {
          const ymd = formatYMD(state.year, monthIdx, d);
          const cost = getDayPtoCost(ymd, state.days, holidays, state.workdays);
          monthConfirmed += cost.confirmed;
          monthDraft += cost.draft;
          if (holidays[ymd] && state.workdays.includes(getDayOfWeek(ymd))) {
            monthHolidays++;
          }
          const ovs = dayOverlaysMap[ymd] || [];
          for (const ov of ovs) {
            if (!monthOverlaySummary.has(ov.overlayId)) {
              monthOverlaySummary.set(ov.overlayId, ov);
            }
          }
        }

        const isDetailed = currentZoom === 'month';
        const isMedium = currentZoom === 'quarter' || currentZoom === '6-months';

        return (
          <div
            key={monthIdx}
            class="flex flex-col rounded-2xl border border-slate-800/80 bg-slate-900/60 p-3.5 shadow-sm hover:border-slate-700/80 transition-colors"
          >
            {/* Month Header */}
            <div class="mb-2 flex items-center justify-between gap-1">
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    focusedMonth.value = monthIdx;
                    zoomLevel.value =
                      currentZoom === 'year-grid'
                        ? 'quarter'
                        : currentZoom === 'quarter' || currentZoom === '6-months'
                          ? 'month'
                          : 'year-grid';
                  }}
                  class="group flex items-center gap-1.5 text-left font-bold text-slate-100 hover:text-indigo-300 transition-colors cursor-pointer"
                  title={
                    currentZoom === 'month'
                      ? 'Click to zoom back to Year Grid'
                      : 'Click to zoom into this month'
                  }
                >
                  <span class={isDetailed ? 'text-lg' : 'text-sm'}>
                    {MONTH_NAMES[monthIdx]}
                  </span>
                  <ZoomIn class="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 text-indigo-400 transition-opacity" />
                </button>
              </div>

              {/* Monthly mini counters & overlay icons */}
              <div class="flex flex-wrap items-center justify-end gap-1 text-[10px] font-medium">
                {Array.from(monthOverlaySummary.values()).map((ov) => {
                  const iconColor = getOverlayIconColor(ov, false);
                  return (
                    <span
                      key={ov.overlayId}
                      class="inline-flex items-center gap-1 rounded-md bg-slate-950/80 px-1.5 py-0.5 text-slate-300 border border-slate-800"
                    >
                      {ov.template === 'surfing' ? (
                        <Waves class={`h-3 w-3 ${iconColor}`} />
                      ) : ov.template === 'diving' ? (
                        <Anchor class={`h-3 w-3 ${iconColor}`} />
                      ) : (
                        <GraduationCap
                          class="h-3 w-3"
                          style={{ color: ov.color }}
                        />
                      )}
                      {ov.span.avgWaveHeight && (
                        <span class="hidden sm:inline text-[9px] text-slate-400">
                          {ov.span.avgWaveHeight.split(' ')[0]}
                        </span>
                      )}
                    </span>
                  );
                })}

                {monthConfirmed > 0 && (
                  <span class="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-emerald-300 border border-emerald-500/30">
                    {monthConfirmed}d off
                  </span>
                )}
                {monthDraft > 0 && (
                  <span class="rounded-md bg-amber-500/20 px-1.5 py-0.5 text-amber-300 border border-amber-500/30">
                    {monthDraft}d draft
                  </span>
                )}
                {monthHolidays > 0 && (
                  <span class="rounded-md bg-rose-500/15 px-1.5 py-0.5 text-rose-300 border border-rose-500/25">
                    {monthHolidays} hol
                  </span>
                )}
              </div>
            </div>

            {/* Weekday Header */}
            <div class="mb-1 grid grid-cols-7 gap-1 text-center">
              {weekdayLabels.map((lbl) => (
                <div
                  key={lbl}
                  class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 py-0.5"
                >
                  {lbl}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div class="grid grid-cols-7 gap-1 flex-1">
              {Array.from({ length: leadingBlanks }).map((_, i) => (
                <div key={`blank-${i}`} class="rounded-lg" />
              ))}

              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const dayNum = idx + 1;
                const ymd = formatYMD(state.year, monthIdx, dayNum);
                const dow = getDayOfWeek(ymd);
                const isWeekend = !state.workdays.includes(dow);
                const holiday: Holiday | undefined = holidays[ymd];
                const entry: DayEntry | undefined = state.days[ymd];
                const dayOverlays = dayOverlaysMap[ymd] || [];
                const primaryOverlays = dayOverlays.filter(
                  (o) => o.display === 'primary'
                );

                // Deduplicate overlays by overlayId for top-right icon display
                const uniqueOverlaysForIcons: ResolvedDayOverlay[] = [];
                const seenOverlayIds = new Set<string>();
                for (const ov of dayOverlays) {
                  if (!seenOverlayIds.has(ov.overlayId)) {
                    seenOverlayIds.add(ov.overlayId);
                    uniqueOverlaysForIcons.push(ov);
                  }
                }
                // In compact 12M view, show 1 icon (preferring surfing/diving or primary); in 6M/3M/1M show all active overlay icons!
                const visibleIcons =
                  isMedium || isDetailed
                    ? uniqueOverlaysForIcons
                    : uniqueOverlaysForIcons
                        .sort((a, b) =>
                          a.template === 'surfing' || a.template === 'diving'
                            ? -1
                            : b.template === 'surfing' || b.template === 'diving'
                              ? 1
                              : 0
                        )
                        .slice(0, 1);

                const isBridgeHint =
                  !entry && !holiday && !isWeekend && bridgeDates.has(ymd);
                const isBeingDragged = selectedRangeSet.has(ymd);
                const isToday = ymd === todayYMD;

                const cellHeightClass = isDetailed
                  ? 'min-h-[84px] sm:min-h-[104px] 3xl:min-h-[128px] p-1.5 sm:p-2 items-start justify-between'
                  : isMedium
                    ? 'min-h-[52px] sm:min-h-[58px] 3xl:min-h-[72px] p-1 sm:p-1.5 items-center justify-between'
                    : 'h-9 sm:h-8 3xl:h-10 items-center justify-center';

                let bgClass =
                  'bg-slate-950/60 text-slate-200 hover:bg-slate-800/80 border-slate-800/60';
                if (isWeekend) {
                  bgClass =
                    'bg-slate-900/35 text-slate-500 border-slate-800/30 hover:bg-slate-800/50';
                }
                if (holiday) {
                  bgClass =
                    'bg-rose-950/50 text-rose-200 border-rose-500/50 hover:bg-rose-900/60';
                }
                if (isBridgeHint) {
                  bgClass =
                    'bg-violet-950/35 text-violet-200 border-violet-400/60 border-dashed hover:bg-violet-900/45';
                }

                // Planned status overrides
                if (entry) {
                  if (entry.status === 'confirmed') {
                    bgClass =
                      'bg-emerald-500/85 text-slate-950 font-bold border-emerald-400 shadow-sm shadow-emerald-500/15 hover:bg-emerald-400';
                  } else if (entry.status === 'half-confirmed') {
                    bgClass =
                      'bg-emerald-500/45 text-emerald-100 font-semibold border-emerald-400/80 hover:bg-emerald-500/60';
                  } else if (entry.status === 'draft') {
                    bgClass =
                      'bg-amber-400/80 bg-stripes text-slate-950 font-bold border-amber-300 shadow-sm shadow-amber-500/15 hover:bg-amber-300';
                  } else if (entry.status === 'half-draft') {
                    bgClass =
                      'bg-amber-400/40 bg-stripes text-amber-100 font-semibold border-amber-400/80 hover:bg-amber-400/55';
                  }
                }

                const dragHighlightClass = isBeingDragged
                  ? 'ring-2 ring-indigo-400 ring-offset-1 ring-offset-slate-950 scale-[1.03] z-10'
                  : '';

                const todayRingClass = isToday ? 'ring-2 ring-sky-400' : '';

                const firstPrimary = primaryOverlays[0];
                const customCellStyle =
                  !entry && firstPrimary
                    ? {
                        boxShadow: `inset 0 0 0 1px ${firstPrimary.color}55`,
                        backgroundColor: `${firstPrimary.color}14`,
                      }
                    : undefined;

                return (
                  <div
                    key={ymd}
                    data-date={ymd}
                    data-status={entry?.status || 'none'}
                    style={customCellStyle}
                    onMouseDown={(e) => onDayPointerDown(ymd, e)}
                    onMouseEnter={(e) => {
                      onDayPointerEnter(ymd);
                      showDayTooltip(ymd, e);
                    }}
                    onMouseMove={moveDayTooltip}
                    onMouseLeave={hideDayTooltip}
                    class={`relative flex flex-col overflow-hidden rounded-lg border text-xs transition-all cursor-pointer ${cellHeightClass} ${bgClass} ${dragHighlightClass} ${todayRingClass}`}
                  >
                    {/* Top row inside cell */}
                    <div class="flex w-full items-center justify-between gap-0.5">
                      <span
                        class={`leading-none tabular-nums ${
                          isDetailed ? 'text-sm font-bold' : 'text-xs'
                        }`}
                      >
                        {dayNum}
                      </span>

                      <div class="flex items-center gap-0.5 flex-wrap justify-end">
                        {/* Overlay icons: 1 icon in 12M compact view, multiple icons in 6M / 3M / 1M */}
                        {visibleIcons.map((ov) => {
                          const iconCol = getOverlayIconColor(ov, Boolean(entry));
                          const iconSize = isDetailed ? 'h-3.5 w-3.5' : isMedium ? 'h-3 w-3' : 'h-2.5 w-2.5';
                          return (
                            <span
                              key={ov.overlayId}
                              class={`inline-flex items-center ${iconCol}`}
                            >
                              {ov.template === 'surfing' ? (
                                <Waves class={iconSize} />
                              ) : ov.template === 'diving' ? (
                                <Anchor class={iconSize} />
                              ) : (
                                <GraduationCap
                                  class={iconSize}
                                  style={
                                    entry ? undefined : { color: ov.color }
                                  }
                                />
                              )}
                            </span>
                          );
                        })}

                        {/* Half-day badge */}
                        {(entry?.status === 'half-confirmed' ||
                          entry?.status === 'half-draft') && (
                          <span class="rounded bg-slate-950/70 px-1 py-0.2 text-[9px] font-bold text-white">
                            ½
                          </span>
                        )}

                        {/* Holiday dot in compact mode */}
                        {!isDetailed && !isMedium && holiday && (
                          <span class="h-1.5 w-1.5 rounded-full bg-rose-400" />
                        )}

                        {/* Bridge sparkle in medium/detailed mode */}
                        {(isDetailed || isMedium) && isBridgeHint && (
                          <Sparkles class="h-3 w-3 text-violet-300 shrink-0" />
                        )}
                      </div>
                    </div>

                    {/* Medium / Detailed Holiday, Multi-Overlay & Note labels */}
                    {(isMedium || isDetailed) && (
                      <div class="mt-1 w-full overflow-hidden text-left space-y-0.5">
                        {holiday && (
                          <div
                            class={`truncate font-medium ${
                              entry ? 'text-slate-900/90' : 'text-rose-300'
                            } text-[10px] leading-tight`}
                          >
                            {holiday.name}
                          </div>
                        )}

                        {/* Show up to 2 overlay rows in 6M/3M and up to 4 in 1M Detailed */}
                        {dayOverlays
                          .slice(0, isDetailed ? 4 : 2)
                          .map((ov, i) => (
                            <div
                              key={`${ov.overlayId}-${i}`}
                              style={{
                                borderLeft: `2px solid ${ov.color}`,
                              }}
                              class={`truncate pl-1 text-[9px] leading-tight ${
                                entry
                                  ? 'text-slate-950 font-semibold'
                                  : 'text-slate-300'
                              }`}
                            >
                              {ov.template === 'surfing' ||
                              ov.template === 'diving' ? (
                                <span>
                                  {ov.span.avgWaveHeight
                                    ? `${ov.span.avgWaveHeight.split(' ')[0]} `
                                    : ''}
                                  {ov.span.waterTemp
                                    ? `• ${ov.span.waterTemp}`
                                    : ''}
                                  {isDetailed && ov.span.recommendedLevel
                                    ? ` • ${ov.span.recommendedLevel}`
                                    : ''}
                                </span>
                              ) : (
                                <span>
                                  {ov.span.region
                                    ? `${ov.span.region}: ${ov.span.label}`
                                    : ov.span.label}
                                </span>
                              )}
                            </div>
                          ))}

                        {isDetailed && entry && (
                          <div class="mt-1 flex items-center justify-between gap-1">
                            {editingNoteDate === ymd ? (
                              <input
                                type="text"
                                value={noteInput}
                                autoFocus
                                placeholder="Add note..."
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onInput={(e) =>
                                  setNoteInput(
                                    (e.target as HTMLInputElement).value
                                  )
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveNote(ymd);
                                  if (e.key === 'Escape')
                                    setEditingNoteDate(null);
                                }}
                                onBlur={() => saveNote(ymd)}
                                class="w-full rounded bg-slate-950/90 px-1.5 py-0.5 text-[10px] font-normal text-white focus:outline-none"
                              />
                            ) : (
                              <button
                                type="button"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) =>
                                  openNoteEditor(ymd, entry.note || '', e)
                                }
                                class="flex items-center gap-1 truncate rounded bg-slate-950/25 px-1.5 py-0.5 text-[10px] font-medium hover:bg-slate-950/40"
                              >
                                <StickyNote class="h-2.5 w-2.5 shrink-0" />
                                <span class="truncate">
                                  {entry.note || 'Add note'}
                                </span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bottom color indicator strip for active overlays */}
                    {dayOverlays.length > 0 && (
                      <div class="absolute bottom-0 left-0 right-0 flex h-[3px] w-full overflow-hidden">
                        {dayOverlays.map((ov, idx) => (
                          <span
                            key={`${ov.overlayId}-bar-${idx}`}
                            style={{
                              backgroundColor: ov.color,
                              opacity: ov.display === 'primary' ? 0.95 : 0.65,
                            }}
                            class="flex-1 h-full"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
