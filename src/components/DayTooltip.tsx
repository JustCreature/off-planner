import { signal } from '@preact/signals';
import {
  Waves,
  Anchor,
  GraduationCap,
  Flag,
  Sparkles,
  Thermometer,
  Wind,
  Compass,
  Award,
  StickyNote,
} from 'lucide-preact';
import {
  plannerState,
  activeHolidays,
  activeDayOverlays,
  bridgeHintDates,
} from '../store/plannerStore';
import { getDayOfWeek, MONTH_SHORT, parseYMD } from '../lib/dateUtils';
import type { ResolvedDayOverlay } from '../types/planner';

export interface TooltipHoverState {
  ymd: string;
  anchorRect: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

export const hoveredDayTooltip = signal<TooltipHoverState | null>(null);
const isPointerInTooltip = signal<boolean>(false);

let showTimer: ReturnType<typeof setTimeout> | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function clearTimers() {
  if (showTimer) {
    clearTimeout(showTimer);
    showTimer = null;
  }
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

export function showDayTooltip(ymd: string, e: MouseEvent) {
  // If user is currently scrolling/reading inside the open tooltip for the same day, keep it
  if (isPointerInTooltip.value && hoveredDayTooltip.value?.ymd === ymd) {
    return;
  }

  clearTimers();

  const target = e.currentTarget as HTMLElement | null;
  const rect = target
    ? target.getBoundingClientRect()
    : {
        top: e.clientY - 12,
        bottom: e.clientY + 12,
        left: e.clientX - 12,
        right: e.clientX + 12,
      };

  const anchorRect = {
    top: rect.top,
    bottom: rect.bottom,
    left: rect.left,
    right: rect.right,
  };

  showTimer = setTimeout(() => {
    hoveredDayTooltip.value = {
      ymd,
      anchorRect,
    };
  }, 400);
}

export function moveDayTooltip(_e: MouseEvent) {
  // Position is anchored to the hovered day cell so the user can move their cursor into the tooltip
}

export function hideDayTooltip() {
  if (showTimer) {
    clearTimeout(showTimer);
    showTimer = null;
  }
  if (hideTimer) {
    clearTimeout(hideTimer);
  }
  hideTimer = setTimeout(() => {
    if (!isPointerInTooltip.value) {
      hoveredDayTooltip.value = null;
    }
  }, 100);
}

export function forceHideDayTooltip() {
  clearTimers();
  isPointerInTooltip.value = false;
  hoveredDayTooltip.value = null;
}

const DOW_FULL = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function QualityPill({ quality }: { quality?: 'good' | 'shoulder' | 'bad' }) {
  if (!quality) return null;
  const isGood = quality === 'good';
  const isShoulder = quality === 'shoulder';
  const cls = isGood
    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
    : isShoulder
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
      : 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  const dot = isGood
    ? 'bg-emerald-400'
    : isShoulder
      ? 'bg-amber-400'
      : 'bg-rose-400';
  const text = isGood ? 'Good / Prime' : isShoulder ? 'Shoulder' : 'Poor / Avoid';

  return (
    <span
      class={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cls}`}
    >
      <span class={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {text}
    </span>
  );
}

function OverlayIcon({ ov }: { ov: ResolvedDayOverlay }) {
  const q = ov.span.quality;
  const colorCls =
    q === 'good'
      ? 'text-emerald-400'
      : q === 'shoulder'
        ? 'text-amber-400'
        : q === 'bad'
          ? 'text-rose-400'
          : 'text-orange-400';

  if (ov.template === 'surfing') {
    return <Waves class={`h-4 w-4 shrink-0 ${colorCls}`} />;
  }
  if (ov.template === 'diving') {
    return <Anchor class={`h-4 w-4 shrink-0 ${colorCls}`} />;
  }
  return (
    <GraduationCap
      class="h-4 w-4 shrink-0"
      style={{ color: ov.color }}
    />
  );
}

export function DayTooltip() {
  const tip = hoveredDayTooltip.value;
  if (!tip) return null;

  const state = plannerState.value;
  const { ymd, anchorRect } = tip;
  const { year, month, day } = parseYMD(ymd);
  const dow = getDayOfWeek(ymd);
  const isWeekend = !state.workdays.includes(dow);
  const holiday = activeHolidays.value[ymd];
  const entry = state.days[ymd];
  const isBridgeHint =
    !entry && !holiday && !isWeekend && bridgeHintDates.value.has(ymd);
  const dayOverlays = activeDayOverlays.value[ymd] || [];

  // Keep floating card inside viewport bounds & anchored right next to the cell
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;
  const cardWidth = 340;
  const maxCardHeight = Math.min(440, viewportH - 24);

  // Horizontal placement: prefer right of the cell, or flip to left if near right edge
  let left = anchorRect.right + 8;
  if (left + cardWidth > viewportW - 12) {
    left = Math.max(12, anchorRect.left - cardWidth - 8);
  }

  // Vertical placement: align with cell top, clamped so the whole scrollable card stays on screen
  const top = Math.max(
    12,
    Math.min(anchorRect.top, viewportH - maxCardHeight - 12)
  );

  return (
    <div
      data-testid="day-tooltip"
      data-date={ymd}
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${cardWidth}px`,
        maxHeight: `${maxCardHeight}px`,
      }}
      onMouseEnter={() => {
        clearTimers();
        isPointerInTooltip.value = true;
      }}
      onMouseLeave={() => {
        isPointerInTooltip.value = false;
        hideDayTooltip();
      }}
      class="pointer-events-auto fixed z-50 flex flex-col rounded-2xl border border-slate-700/90 bg-slate-900/95 text-xs text-slate-100 shadow-2xl backdrop-blur-md overflow-hidden"
    >
      {/* Sticky Date Header */}
      <div class="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-slate-800 bg-slate-900/95 shrink-0">
        <div class="flex items-center gap-2">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-slate-200 font-bold">
            {day}
          </div>
          <div>
            <div class="font-bold text-white leading-tight">
              {DOW_FULL[dow]}, {MONTH_SHORT[month]} {day}, {year}
            </div>
            <div class="text-[10px] text-slate-400">
              {isWeekend ? 'Weekend (0 PTO cost)' : 'Regular Workday'}
            </div>
          </div>
        </div>

        {entry && (
          <span
            class={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
              entry.status.includes('confirmed')
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
            }`}
          >
            {entry.status === 'confirmed'
              ? 'Confirmed (1d)'
              : entry.status === 'half-confirmed'
                ? 'Half Confirmed (0.5d)'
                : entry.status === 'draft'
                  ? 'Draft (1d)'
                  : 'Half Draft (0.5d)'}
          </span>
        )}
      </div>

      {/* Scrollable Body */}
      <div class="overflow-y-auto overscroll-contain px-3.5 py-3 space-y-2.5">
        {/* Holiday / Bridge / Note Section */}
        {(holiday || isBridgeHint || entry?.note) && (
          <div class="space-y-1.5">
            {holiday && (
              <div class="flex items-center gap-2 rounded-lg bg-rose-950/60 border border-rose-500/40 px-2.5 py-1.5 text-rose-200">
                <Flag class="h-3.5 w-3.5 text-rose-400 shrink-0" />
                <div class="min-w-0">
                  <div class="font-bold text-[11px] truncate">{holiday.name}</div>
                  <div class="text-[10px] text-rose-300/80">
                    Statutory Public Holiday (0 PTO cost)
                  </div>
                </div>
              </div>
            )}

            {isBridgeHint && (
              <div class="flex items-center gap-2 rounded-lg bg-violet-950/50 border border-violet-500/40 px-2.5 py-1.5 text-violet-200">
                <Sparkles class="h-3.5 w-3.5 text-violet-400 shrink-0" />
                <span class="text-[11px] font-medium">
                  High-efficiency Bridge Day opportunity!
                </span>
              </div>
            )}

            {entry?.note && (
              <div class="flex items-center gap-2 rounded-lg bg-slate-950/70 border border-slate-800 px-2.5 py-1.5 text-slate-200">
                <StickyNote class="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                <span class="text-[11px]">{entry.note}</span>
              </div>
            )}
          </div>
        )}

        {/* Active Overlays (School Holidays, Surfing, Diving) */}
        {dayOverlays.length > 0 ? (
          <div class="space-y-2">
            <div class="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span>Active Overlays & Seasons ({dayOverlays.length})</span>
              {dayOverlays.length > 2 && (
                <span class="text-[9px] font-normal text-slate-500">
                  Scroll for more ↓
                </span>
              )}
            </div>

            {dayOverlays.map((ov, i) => {
              const s = ov.span;
              return (
                <div
                  key={`${ov.overlayId}-${i}`}
                  style={{ borderLeft: `3px solid ${ov.color}` }}
                  class="rounded-r-xl bg-slate-950/90 border border-slate-800/90 p-2.5 space-y-1.5"
                >
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex items-start gap-2 min-w-0">
                      <OverlayIcon ov={ov} />
                      <div class="min-w-0">
                        <div class="font-bold text-slate-100 text-[11px] leading-tight">
                          {s.label}
                        </div>
                        <div class="text-[10px] text-slate-400 truncate">
                          {ov.overlayName}
                          {s.region ? ` • ${s.region}` : ''}
                        </div>
                      </div>
                    </div>
                    <QualityPill quality={s.quality} />
                  </div>

                  {/* Surfing & Diving Metrics Grid */}
                  {(s.avgWaveHeight ||
                    s.waterTemp ||
                    s.wind ||
                    s.visibility ||
                    s.recommendedLevel) && (
                    <div class="grid grid-cols-2 gap-1.5 rounded-lg bg-slate-900/90 p-1.5 text-[10px]">
                      {s.avgWaveHeight && (
                        <div class="flex items-center gap-1.5 text-slate-200">
                          <Waves class="h-3 w-3 text-cyan-400 shrink-0" />
                          <span>
                            Waves: <strong>{s.avgWaveHeight}</strong>
                          </span>
                        </div>
                      )}
                      {s.waterTemp && (
                        <div class="flex items-center gap-1.5 text-slate-200">
                          <Thermometer class="h-3 w-3 text-amber-400 shrink-0" />
                          <span>
                            Water: <strong>{s.waterTemp}</strong>
                          </span>
                        </div>
                      )}
                      {s.wind && (
                        <div class="flex items-center gap-1.5 text-slate-200 col-span-2">
                          <Wind class="h-3 w-3 text-sky-400 shrink-0" />
                          <span class="truncate">
                            Wind: <strong>{s.wind}</strong>
                          </span>
                        </div>
                      )}
                      {s.visibility && (
                        <div class="flex items-center gap-1.5 text-slate-200">
                          <Compass class="h-3 w-3 text-blue-400 shrink-0" />
                          <span>
                            Vis: <strong>{s.visibility}</strong>
                          </span>
                        </div>
                      )}
                      {s.recommendedLevel && (
                        <div class="flex items-center gap-1.5 text-indigo-200 col-span-2">
                          <Award class="h-3 w-3 text-indigo-400 shrink-0" />
                          <span>
                            Level: <strong>{s.recommendedLevel}</strong>
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {s.description && (
                    <p class="text-[10px] text-slate-400 leading-snug">
                      {s.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          !holiday &&
          !entry &&
          !isBridgeHint && (
            <div class="text-[11px] text-slate-400">
              Click or drag to plan time off.
            </div>
          )
        )}
      </div>
    </div>
  );
}
