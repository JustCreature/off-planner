import { useState } from 'preact/hooks';
import {
  Layers,
  Waves,
  Anchor,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Thermometer,
  Wind,
  Compass,
  Award,
  MapPin,
} from 'lucide-preact';
import {
  plannerState,
  leftPanelOpen,
  toggleShowOverlays,
  toggleOverlayEnabled,
  setOverlayColor,
  setOverlayDisplayMode,
  toggleOverlayRegion,
  focusedMonth,
  zoomLevel,
  mobileActiveSection,
} from '../store/plannerStore';
import {
  OVERLAY_CONFIGS,
  expandSpanForYear,
  getDistinctRegionsForOverlay,
} from '../lib/overlays';
import { formatHumanRange, parseYMD } from '../lib/dateUtils';
import type { ConditionQuality, OverlayConfigFile } from '../types/planner';

const PRESET_COLORS = [
  '#f97316', // orange
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#ec4899', // pink
  '#a855f7', // purple
  '#eab308', // yellow
  '#14b8a6', // teal
  '#f43f5e', // rose
];

function QualityBadge({
  quality,
  template,
}: {
  quality?: ConditionQuality;
  template: 'surfing' | 'diving' | 'generic';
}) {
  if (!quality) return null;

  const isGood = quality === 'good';
  const isShoulder = quality === 'shoulder';

  const pillStyle = isGood
    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
    : isShoulder
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
      : 'bg-rose-500/20 text-rose-300 border-rose-500/40';

  const iconColor = isGood
    ? 'text-emerald-400'
    : isShoulder
      ? 'text-amber-400'
      : 'text-rose-400';

  const label = isGood ? 'Prime / Good' : isShoulder ? 'Shoulder' : 'Poor / Avoid';

  return (
    <span
      class={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${pillStyle}`}
    >
      {template === 'surfing' ? (
        <Waves class={`h-3 w-3 ${iconColor}`} />
      ) : (
        <Anchor class={`h-3 w-3 ${iconColor}`} />
      )}
      <span>{label}</span>
    </span>
  );
}

export function OverlaysPanel() {
  const state = plannerState.value;
  const isOpen = leftPanelOpen.value;
  // All overlay cards in the left side panel start collapsed by default
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const showOverlays = state.showOverlays;
  const enabledCount = OVERLAY_CONFIGS.filter(
    (c) => state.overlayPrefs?.[c.id]?.enabled
  ).length;

  const toggleCardExpand = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const jumpToSpan = (cfg: OverlayConfigFile, spanIndex: number) => {
    const span = cfg.ranges[spanIndex];
    if (!span) return;
    const dates = expandSpanForYear(span, state.year);
    if (dates.length === 0) return;
    const { month } = parseYMD(dates[0]);
    focusedMonth.value = month;
    if (zoomLevel.value === 'year-grid' || zoomLevel.value === 'year-linear') {
      zoomLevel.value = 'quarter';
    }
    mobileActiveSection.value = 'calendar';
  };

  if (!isOpen) {
    return (
      <aside class="flex flex-col items-center rounded-2xl border border-slate-800/80 bg-slate-900/60 p-2 shadow-sm h-fit xl:sticky xl:top-20">
        <button
          type="button"
          onClick={() => (leftPanelOpen.value = true)}
          class="flex flex-col items-center gap-2 rounded-xl p-2 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
          title="Expand Overlays & Seasons Panel (School Holidays, Surfing, Diving)"
        >
          <ChevronRight class="h-4 w-4 text-indigo-400" />
          <Layers class="h-4 w-4 text-cyan-400" />
          <span class="[writing-mode:vertical-lr] text-[11px] font-bold tracking-wider uppercase text-slate-400 py-1">
            Overlays & Seasons
          </span>
        </button>
      </aside>
    );
  }

  return (
    <aside class="flex flex-col rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 shadow-sm h-fit xl:sticky xl:top-20">
      {/* Header */}
      <div class="mb-2.5 flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
            <Layers class="h-4 w-4" />
          </div>
          <div>
            <h2 class="text-xs font-bold uppercase tracking-wider text-slate-100">
              Overlays & Seasons
            </h2>
            <p class="text-[10px] text-slate-400">
              {enabledCount} selected • {showOverlays ? 'Displayed' : 'Hidden'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => (leftPanelOpen.value = false)}
          class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
          title="Collapse panel"
        >
          <ChevronLeft class="h-4 w-4" />
        </button>
      </div>

      {/* Master Display Toggle Bar (Hide/Show all overlays without losing individual layer selections) */}
      <div class="mb-3 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/90 px-3 py-2">
        <div class="min-w-0">
          <div class="text-xs font-semibold text-slate-200">
            Display on Calendar
          </div>
          <div class="text-[10px] text-slate-400">
            {showOverlays
              ? 'Showing active layers'
              : 'Display paused (selections preserved)'}
          </div>
        </div>

        <button
          type="button"
          onClick={toggleShowOverlays}
          class={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
            showOverlays
              ? 'border-cyan-500/50 bg-cyan-500/20 text-cyan-200'
              : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200'
          }`}
          title="Temporarily hide or show all enabled overlays on the calendar while preserving which layers are enabled"
        >
          {showOverlays ? (
            <>
              <Eye class="h-3.5 w-3.5 text-cyan-400" />
              <span>Visible</span>
            </>
          ) : (
            <>
              <EyeOff class="h-3.5 w-3.5 text-slate-400" />
              <span>Hidden</span>
            </>
          )}
        </button>
      </div>

      {/* Overlay Cards */}
      <div class="flex flex-col gap-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-0.5">
        {OVERLAY_CONFIGS.map((cfg) => {
          const pref = state.overlayPrefs?.[cfg.id] || {
            enabled: cfg.defaultEnabled ?? false,
            color: cfg.color,
            display: cfg.defaultDisplay,
            disabledRegions: [],
          };
          const isExpanded = Boolean(expandedCards[cfg.id]);
          const regions = getDistinctRegionsForOverlay(cfg);
          const disabledSet = new Set(pref.disabledRegions || []);

          // Filter ranges that have dates in the active year
          const activeYearRanges = cfg.ranges
            .map((r, idx) => ({
              span: r,
              idx,
              dates: expandSpanForYear(r, state.year),
            }))
            .filter((item) => item.dates.length > 0);

          return (
            <div
              key={cfg.id}
              class={`rounded-xl border transition-all ${
                pref.enabled
                  ? 'border-slate-700/90 bg-slate-950/80 shadow-sm'
                  : 'border-slate-800/60 bg-slate-950/40 opacity-70'
              }`}
            >
              {/* Card Top Row */}
              <div class="p-3">
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-start gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleOverlayEnabled(cfg.id)}
                      class={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors cursor-pointer ${
                        pref.enabled
                          ? 'border-indigo-500 bg-indigo-600 text-white'
                          : 'border-slate-700 bg-slate-900 text-slate-500 hover:text-slate-300'
                      }`}
                      title={pref.enabled ? 'Hide overlay' : 'Show overlay on calendar'}
                    >
                      {pref.enabled ? (
                        <Eye class="h-3 w-3" />
                      ) : (
                        <EyeOff class="h-3 w-3" />
                      )}
                    </button>

                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5">
                        {cfg.template === 'surfing' ? (
                          <Waves class="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                        ) : cfg.template === 'diving' ? (
                          <Anchor class="h-3.5 w-3.5 text-blue-400 shrink-0" />
                        ) : (
                          <GraduationCap class="h-3.5 w-3.5 text-orange-400 shrink-0" />
                        )}
                        <span class="truncate text-xs font-bold text-slate-100">
                          {cfg.name}
                        </span>
                      </div>

                      {cfg.location && (
                        <div class="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400">
                          <MapPin class="h-2.5 w-2.5 shrink-0 text-slate-500" />
                          <span class="truncate">{cfg.location}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleCardExpand(cfg.id)}
                    class="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
                    title={isExpanded ? 'Hide details' : 'Show details & settings'}
                  >
                    {isExpanded ? (
                      <ChevronUp class="h-4 w-4" />
                    ) : (
                      <ChevronDown class="h-4 w-4" />
                    )}
                  </button>
                </div>

                {/* Controls Row: Primary/Secondary Display + Color Picker */}
                {pref.enabled && (
                  <div class="mt-2.5 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/70">
                    {/* Display Priority Switcher */}
                    <div class="flex items-center gap-1 rounded-lg bg-slate-900 p-0.5 border border-slate-800">
                      <button
                        type="button"
                        onClick={() => setOverlayDisplayMode(cfg.id, 'primary')}
                        class={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition-all cursor-pointer ${
                          pref.display === 'primary'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                        title="Primary: Prominent banner, icon & stats on calendar cells"
                      >
                        Primary
                      </button>
                      <button
                        type="button"
                        onClick={() => setOverlayDisplayMode(cfg.id, 'secondary')}
                        class={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition-all cursor-pointer ${
                          pref.display === 'secondary'
                            ? 'bg-slate-700 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                        title="Secondary: Subtle bar / indicator dot + full tooltip"
                      >
                        Secondary
                      </button>
                    </div>

                    {/* Color Override Swatches + Native Picker */}
                    <div class="flex items-center gap-1">
                      {PRESET_COLORS.slice(0, 5).map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => setOverlayColor(cfg.id, col)}
                          style={{ backgroundColor: col }}
                          class={`h-3.5 w-3.5 rounded-full transition-transform cursor-pointer ${
                            pref.color.toLowerCase() === col.toLowerCase()
                              ? 'ring-2 ring-white scale-110'
                              : 'opacity-70 hover:opacity-100'
                          }`}
                          title={`Set overlay color to ${col}`}
                        />
                      ))}
                      <input
                        type="color"
                        value={pref.color}
                        onInput={(e) =>
                          setOverlayColor(cfg.id, (e.target as HTMLInputElement).value)
                        }
                        class="h-4 w-4 cursor-pointer rounded border-0 bg-transparent p-0"
                        title="Custom color picker"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Expanded Details, Sub-Region Filters & Ranges */}
              {isExpanded && (
                <div class="border-t border-slate-800/80 bg-slate-900/50 p-3 text-xs space-y-2.5">
                  {cfg.description && (
                    <p class="text-[11px] leading-relaxed text-slate-400">
                      {cfg.description}
                    </p>
                  )}

                  {/* Region / Land Filter Pills (if multiple regions exist, e.g., Bavaria & Austria by Land) */}
                  {regions.length > 1 && (
                    <div class="space-y-1">
                      <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Filter by Land / Region:
                      </span>
                      <div class="flex flex-wrap gap-1">
                        {regions.map((reg) => {
                          const active = !disabledSet.has(reg);
                          return (
                            <button
                              key={reg}
                              type="button"
                              onClick={() => toggleOverlayRegion(cfg.id, reg)}
                              class={`rounded-lg border px-2 py-0.5 text-[10px] font-semibold transition-all cursor-pointer ${
                                active
                                  ? 'border-orange-500/50 bg-orange-500/15 text-orange-200'
                                  : 'border-slate-800 bg-slate-950 text-slate-500 line-through'
                              }`}
                            >
                              {reg}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Ranges List for Current Year */}
                  <div class="space-y-1.5">
                    <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      {state.year} Periods ({activeYearRanges.length}):
                    </span>

                    {activeYearRanges.map(({ span, idx, dates }) => {
                      const isRegionDisabled =
                        span.region && disabledSet.has(span.region);
                      if (isRegionDisabled) return null;

                      const startYMD = dates[0];
                      const endYMD = dates[dates.length - 1];

                      return (
                        <div
                          key={`${span.label}-${idx}`}
                          onClick={() => jumpToSpan(cfg, idx)}
                          class="group rounded-lg border border-slate-800/90 bg-slate-950/80 p-2 hover:border-slate-700 transition-all cursor-pointer"
                        >
                          <div class="flex items-start justify-between gap-1.5">
                            <div class="min-w-0">
                              <div class="font-bold text-slate-200 group-hover:text-indigo-300 transition-colors text-[11px]">
                                {span.label}
                              </div>
                              <div class="text-[10px] text-slate-400">
                                {formatHumanRange(startYMD, endYMD)}
                                {span.region ? ` • ${span.region}` : ''}
                              </div>
                            </div>

                            <QualityBadge
                              quality={span.quality}
                              template={cfg.template}
                            />
                          </div>

                          {/* Surfing & Diving Specific Telemetry */}
                          {(cfg.template === 'surfing' ||
                            cfg.template === 'diving') && (
                            <div class="mt-2 grid grid-cols-2 gap-1.5 rounded-md bg-slate-900/90 p-1.5 text-[10px]">
                              {span.avgWaveHeight && (
                                <div class="flex items-center gap-1 text-slate-300">
                                  <Waves class="h-3 w-3 text-cyan-400 shrink-0" />
                                  <span class="truncate" title={span.avgWaveHeight}>
                                    {span.avgWaveHeight}
                                  </span>
                                </div>
                              )}
                              {span.waterTemp && (
                                <div class="flex items-center gap-1 text-slate-300">
                                  <Thermometer class="h-3 w-3 text-amber-400 shrink-0" />
                                  <span class="truncate">{span.waterTemp}</span>
                                </div>
                              )}
                              {span.wind && (
                                <div class="flex items-center gap-1 text-slate-300 col-span-2">
                                  <Wind class="h-3 w-3 text-sky-400 shrink-0" />
                                  <span class="truncate">{span.wind}</span>
                                </div>
                              )}
                              {span.visibility && (
                                <div class="flex items-center gap-1 text-slate-300">
                                  <Compass class="h-3 w-3 text-blue-400 shrink-0" />
                                  <span class="truncate">Vis: {span.visibility}</span>
                                </div>
                              )}
                              {span.recommendedLevel && (
                                <div class="flex items-center gap-1 text-indigo-300 col-span-2">
                                  <Award class="h-3 w-3 text-indigo-400 shrink-0" />
                                  <span class="truncate">
                                    Level: <strong>{span.recommendedLevel}</strong>
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {span.description && (
                            <p class="mt-1.5 text-[10px] text-slate-400 leading-snug">
                              {span.description}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
