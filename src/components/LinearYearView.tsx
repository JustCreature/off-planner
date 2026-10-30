import { Sparkles, Waves, Anchor, GraduationCap } from 'lucide-preact';
import {
  plannerState,
  activeHolidays,
  activeDayOverlays,
  bridgeHintDates,
  focusedMonth,
  zoomLevel,
} from '../store/plannerStore';
import {
  MONTH_SHORT,
  formatYMD,
  getDayOfWeek,
  getDaysInMonth,
} from '../lib/dateUtils';
import {
  showDayTooltip,
  moveDayTooltip,
  hideDayTooltip,
} from './DayTooltip';

interface LinearYearViewProps {
  selectedRangeSet: Set<string>;
  onDayPointerDown: (ymd: string, e: MouseEvent) => void;
  onDayPointerEnter: (ymd: string) => void;
}

const DAY_COLUMNS = Array.from({ length: 31 }, (_, i) => i + 1);
const DOW_MINI = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function LinearYearView({
  selectedRangeSet,
  onDayPointerDown,
  onDayPointerEnter,
}: LinearYearViewProps) {
  const state = plannerState.value;
  const holidays = activeHolidays.value;
  const dayOverlaysMap = activeDayOverlays.value;
  const bridgeDates = bridgeHintDates.value;
  const todayYMD = new Date().toISOString().slice(0, 10);

  return (
    <div class="overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 shadow-sm select-none">
      <div class="mb-3 flex items-center justify-between">
        <div>
          <h2 class="text-sm font-bold text-slate-100">
            Full-Year Linear Matrix ({state.year})
          </h2>
          <p class="text-xs text-slate-400">
            12 months × 31 days bird’s-eye timeline — click and drag horizontally across any row to paint vacations.
          </p>
        </div>
      </div>

      <div class="min-w-[980px]">
        {/* Header Row: Day Numbers 1..31 */}
        <div class="grid grid-cols-[72px_repeat(31,minmax(0,1fr))] gap-1 mb-1.5">
          <div class="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-1">
            Month
          </div>
          {DAY_COLUMNS.map((dayNum) => (
            <div
              key={dayNum}
              class="text-center text-[10px] font-bold tabular-nums text-slate-400"
            >
              {dayNum}
            </div>
          ))}
        </div>

        {/* 12 Month Rows */}
        <div class="flex flex-col gap-1.5">
          {MONTH_SHORT.map((monthLabel, monthIdx) => {
            const daysInMonth = getDaysInMonth(state.year, monthIdx);

            return (
              <div
                key={monthLabel}
                class="grid grid-cols-[72px_repeat(31,minmax(0,1fr))] gap-1 items-center"
              >
                <button
                  type="button"
                  onClick={() => {
                    focusedMonth.value = monthIdx;
                    zoomLevel.value = 'month';
                  }}
                  class="text-left text-xs font-bold text-slate-200 hover:text-indigo-300 px-1 py-1 rounded hover:bg-slate-800/60 transition-colors cursor-pointer"
                  title="Zoom into this month"
                >
                  {monthLabel}
                </button>

                {DAY_COLUMNS.map((dayNum) => {
                  if (dayNum > daysInMonth) {
                    return (
                      <div
                        key={`invalid-${dayNum}`}
                        class="h-8 rounded bg-slate-950/20 border border-transparent"
                      />
                    );
                  }

                  const ymd = formatYMD(state.year, monthIdx, dayNum);
                  const dow = getDayOfWeek(ymd);
                  const isWeekend = !state.workdays.includes(dow);
                  const holiday = holidays[ymd];
                  const entry = state.days[ymd];
                  const dayOverlays = dayOverlaysMap[ymd] || [];
                  const featuredOverlay =
                    dayOverlays.find(
                      (o) => o.template === 'surfing' || o.template === 'diving'
                    ) || dayOverlays[0];

                  const isBridgeHint =
                    !entry && !holiday && !isWeekend && bridgeDates.has(ymd);
                  const isDragged = selectedRangeSet.has(ymd);
                  const isToday = ymd === todayYMD;

                  let cellStyle =
                    'bg-slate-950/70 text-slate-400 border-slate-800/60 hover:bg-slate-800';
                  if (isWeekend) {
                    cellStyle =
                      'bg-slate-900/35 text-slate-600 border-slate-800/30 hover:bg-slate-800/60';
                  }
                  if (holiday) {
                    cellStyle =
                      'bg-rose-950/60 text-rose-200 border-rose-500/50 hover:bg-rose-900/70';
                  }
                  if (isBridgeHint) {
                    cellStyle =
                      'bg-violet-950/40 text-violet-200 border-violet-400/60 border-dashed';
                  }

                  if (entry) {
                    if (entry.status === 'confirmed') {
                      cellStyle =
                        'bg-emerald-500 text-slate-950 font-bold border-emerald-400';
                    } else if (entry.status === 'half-confirmed') {
                      cellStyle =
                        'bg-emerald-500/45 text-emerald-100 font-semibold border-emerald-400';
                    } else if (entry.status === 'draft') {
                      cellStyle =
                        'bg-amber-400 bg-stripes text-slate-950 font-bold border-amber-300';
                    } else if (entry.status === 'half-draft') {
                      cellStyle =
                        'bg-amber-400/45 bg-stripes text-amber-100 font-semibold border-amber-300';
                    }
                  }

                  return (
                    <div
                      key={ymd}
                      onMouseDown={(e) => onDayPointerDown(ymd, e)}
                      onMouseEnter={(e) => {
                        onDayPointerEnter(ymd);
                        showDayTooltip(ymd, e);
                      }}
                      onMouseMove={moveDayTooltip}
                      onMouseLeave={hideDayTooltip}
                      class={`relative flex h-8 flex-col items-center justify-center overflow-hidden rounded border text-[10px] transition-all cursor-pointer ${cellStyle} ${
                        isDragged
                          ? 'ring-2 ring-indigo-400 z-10 scale-105'
                          : ''
                      } ${isToday ? 'ring-2 ring-sky-400' : ''}`}
                    >
                      <span class="leading-none opacity-80 text-[9px]">
                        {DOW_MINI[dow]}
                      </span>
                      {holiday && !entry && (
                        <span class="mt-0.5 h-1 w-1 rounded-full bg-rose-400" />
                      )}
                      {isBridgeHint && (
                        <Sparkles class="h-2.5 w-2.5 text-violet-300 mt-0.5" />
                      )}
                      {!holiday && !isBridgeHint && featuredOverlay && (
                        <span
                          class={`mt-0.5 ${
                            entry
                              ? 'text-slate-950'
                              : featuredOverlay.span.quality === 'good'
                                ? 'text-emerald-400'
                                : featuredOverlay.span.quality === 'shoulder'
                                  ? 'text-amber-400'
                                  : featuredOverlay.span.quality === 'bad'
                                    ? 'text-rose-400'
                                    : 'text-orange-400'
                          }`}
                        >
                          {featuredOverlay.template === 'surfing' ? (
                            <Waves class="h-2 w-2" />
                          ) : featuredOverlay.template === 'diving' ? (
                            <Anchor class="h-2 w-2" />
                          ) : (
                            <GraduationCap
                              class="h-2 w-2"
                              style={
                                entry
                                  ? undefined
                                  : { color: featuredOverlay.color }
                              }
                            />
                          )}
                        </span>
                      )}

                      {dayOverlays.length > 0 && (
                        <div class="absolute bottom-0 left-0 right-0 flex h-[3px] w-full">
                          {dayOverlays.map((ov, i) => (
                            <span
                              key={`${ov.overlayId}-${i}`}
                              style={{ backgroundColor: ov.color }}
                              class="flex-1 h-full"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
