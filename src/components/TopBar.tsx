import { useRef, useState } from 'preact/hooks';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-preact';
import {
  plannerState,
  budgetSummary,
  zoomLevel,
  focusedMonth,
  setYear,
  setAllowance,
  setCarryOver,
  setCountryPreset,
  undo,
  redo,
  undoStack,
  redoStack,
  zoomIn,
  zoomOut,
  exportStateAsJson,
  importStateFromJson,
  clearAllPlansForYear,
  showBridgeHints,
} from '../store/plannerStore';
import { HOLIDAY_PRESETS } from '../lib/holidays';
import { MONTH_NAMES } from '../lib/dateUtils';
import type { ZoomLevel } from '../types/planner';

const ZOOM_OPTIONS: Array<{ id: ZoomLevel; label: string; short: string }> = [
  { id: 'year-linear', label: 'Linear Year (12×31)', short: 'Linear' },
  { id: 'year-grid', label: 'Year Grid (12m)', short: '12M' },
  { id: '6-months', label: 'Half Year (6m)', short: '6M' },
  { id: 'quarter', label: 'Quarter (3m)', short: '3M' },
  { id: 'month', label: 'Month Detail (1m)', short: '1M' },
];

export function TopBar() {
  const state = plannerState.value;
  const budget = budgetSummary.value;
  const currentZoom = zoomLevel.value;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const handleExport = () => {
    const json = exportStateAsJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `off-planner-${state.year}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported off-planner-${state.year}.json`);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const text = await file.text();
    const res = importStateFromJson(text);
    if (res.ok) {
      showToast('Plan imported successfully!');
    } else {
      showToast(`Import failed: ${res.error}`);
    }
    input.value = '';
  };

  // Period navigation for 6-month, quarter, or single month views
  const stepPeriod = (dir: -1 | 1) => {
    const step =
      currentZoom === '6-months' ? 6 : currentZoom === 'quarter' ? 3 : 1;
    let next = focusedMonth.value + dir * step;
    if (next < 0) {
      setYear(state.year - 1);
      next = 12 + next;
    } else if (next > 11) {
      setYear(state.year + 1);
      next = next - 12;
    }
    focusedMonth.value = Math.max(0, Math.min(11, next));
  };

  const getPeriodLabel = () => {
    const m = focusedMonth.value;
    if (currentZoom === 'month') {
      return `${MONTH_NAMES[m]} ${state.year}`;
    }
    if (currentZoom === 'quarter') {
      const start = Math.min(9, m);
      return `${MONTH_NAMES[start].slice(0, 3)} – ${MONTH_NAMES[start + 2].slice(0, 3)} ${state.year}`;
    }
    if (currentZoom === '6-months') {
      const start = m < 6 ? 0 : 6;
      return `${MONTH_NAMES[start].slice(0, 3)} – ${MONTH_NAMES[start + 5].slice(0, 3)} ${state.year}`;
    }
    return `${state.year}`;
  };

  const confirmedPct =
    budget.totalBudget > 0
      ? Math.min(100, Math.max(0, (budget.confirmedUsed / budget.totalBudget) * 100))
      : 0;
  const draftPct =
    budget.totalBudget > 0
      ? Math.min(
          100 - confirmedPct,
          Math.max(0, (budget.draftUsed / budget.totalBudget) * 100)
        )
      : 0;

  const isOverBudget = budget.remainingAfterDrafts < 0;

  return (
    <header
      data-testid="top-bar"
      class="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md"
    >
      {toast && (
        <div class="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-slate-900/95 px-4 py-2.5 text-sm font-medium text-emerald-300 shadow-2xl">
          <CheckCircle2 class="h-4 w-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      <div class="mx-auto flex max-w-[1920px] 3xl:max-w-[2560px] 4xl:max-w-[3400px] flex-wrap items-center justify-between gap-2.5 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3">
        {/* Brand + Year & Period Switcher */}
        <div class="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto justify-between md:justify-start">
          <div class="flex items-center gap-2">
            <div class="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-slate-950 shadow-lg shadow-emerald-500/20">
              <Calendar class="h-4 w-4 sm:h-5 sm:w-5 stroke-[2.2]" />
            </div>
            <div>
              <h1 class="text-sm sm:text-base font-bold tracking-tight text-white leading-none">
                Off-Planner
              </h1>
              <p class="hidden sm:block text-[11px] text-slate-400 mt-0.5">
                Fast Vacation & PTO Architect
              </p>
            </div>
          </div>

          <div class="h-6 w-px bg-slate-800 mx-1 hidden sm:block" />

          {/* Year selector */}
          <div class="flex items-center rounded-xl border border-slate-800 bg-slate-900/90 p-0.5">
            <button
              type="button"
              onClick={() => setYear(state.year - 1)}
              class="rounded-lg p-1 sm:p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              title="Previous Year"
            >
              <ChevronLeft class="h-4 w-4" />
            </button>
            <span class="px-2 sm:px-2.5 text-xs sm:text-sm font-semibold tabular-nums text-white">
              {state.year}
            </span>
            <button
              type="button"
              onClick={() => setYear(state.year + 1)}
              class="rounded-lg p-1 sm:p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              title="Next Year"
            >
              <ChevronRight class="h-4 w-4" />
            </button>
          </div>

          {/* Mobile Settings Drawer Toggle Button */}
          <button
            type="button"
            data-testid="mobile-settings-toggle"
            onClick={() => setMobileSettingsOpen((prev) => !prev)}
            class={`md:hidden flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              mobileSettingsOpen
                ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-200'
                : 'border-slate-800 bg-slate-900 text-slate-300'
            }`}
            title="Toggle Budget, Bundesland & Export Settings"
          >
            <SlidersHorizontal class="h-3.5 w-3.5" />
            <span>{budget.remainingAfterDrafts}d left</span>
          </button>

          {/* Sub-year Period Switcher when zoomed in */}
          {(currentZoom === 'month' ||
            currentZoom === 'quarter' ||
            currentZoom === '6-months') && (
            <div class="flex items-center rounded-xl border border-indigo-500/30 bg-indigo-950/30 p-0.5">
              <button
                type="button"
                onClick={() => stepPeriod(-1)}
                class="rounded-lg p-1 sm:p-1.5 text-indigo-300 hover:bg-indigo-900/50 hover:text-white transition-colors"
                title="Previous period"
              >
                <ChevronLeft class="h-4 w-4" />
              </button>
              <span class="px-2 sm:px-2.5 text-xs font-semibold text-indigo-200 min-w-[96px] sm:min-w-[110px] text-center">
                {getPeriodLabel()}
              </span>
              <button
                type="button"
                onClick={() => stepPeriod(1)}
                class="rounded-lg p-1 sm:p-1.5 text-indigo-300 hover:bg-indigo-900/50 hover:text-white transition-colors"
                title="Next period"
              >
                <ChevronRight class="h-4 w-4" />
              </button>
            </div>
          )}

          {/* German Bundesland / Country Holiday Preset Selector */}
          <div
            class={`${
              mobileSettingsOpen ? 'flex w-full' : 'hidden md:flex'
            } items-center justify-between gap-1.5 rounded-xl border border-slate-800 bg-slate-900/90 px-2.5 py-1.5`}
          >
            <span class="text-xs text-slate-400">Bundesland / Region:</span>
            <select
              aria-label="Bundesland or Country Holiday Preset"
              value={state.countryPreset}
              onChange={(e) =>
                setCountryPreset((e.target as HTMLSelectElement).value)
              }
              class="bg-transparent text-xs font-semibold text-slate-100 focus:outline-none cursor-pointer"
            >
              <optgroup label="🇩🇪 Germany — Bundesländer" class="bg-slate-900 text-slate-300">
                {HOLIDAY_PRESETS.filter((c) => c.group === 'Germany (Bundesländer)').map((c) => (
                  <option key={c.code} value={c.code} class="bg-slate-900 text-slate-100">
                    {c.flag} {c.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="🌍 Other Countries" class="bg-slate-900 text-slate-300">
                {HOLIDAY_PRESETS.filter((c) => c.group === 'Other Countries').map((c) => (
                  <option key={c.code} value={c.code} class="bg-slate-900 text-slate-100">
                    {c.flag} {c.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="🗓️ Custom" class="bg-slate-900 text-slate-300">
                {HOLIDAY_PRESETS.filter((c) => c.group === 'Custom').map((c) => (
                  <option key={c.code} value={c.code} class="bg-slate-900 text-slate-100">
                    {c.flag} {c.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        {/* Center: Live PTO Budget Meter */}
        <div
          class={`${
            mobileSettingsOpen ? 'flex w-full' : 'hidden md:flex'
          } flex-1 min-w-[260px] max-w-xl items-center gap-3 sm:gap-4 rounded-2xl border border-slate-800/90 bg-slate-900/70 px-3 sm:px-4 py-2`}
        >
          {/* Allowance Inputs (Per-Year) */}
          <div class="flex items-center gap-3">
            <label class="flex flex-col" title={`Annual PTO allowance for ${state.year}`}>
              <span class="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Allowance ({state.year})
              </span>
              <input
                type="number"
                min={0}
                max={365}
                value={budget.allowance}
                onInput={(e) =>
                  setAllowance(Number((e.target as HTMLInputElement).value) || 0)
                }
                class="mt-0.5 w-16 rounded-lg border border-slate-700/80 bg-slate-950 px-2 py-0.5 text-center text-sm font-bold tabular-nums text-white focus:border-emerald-500 focus:outline-none"
              />
            </label>

            <label class="flex flex-col" title={`Carryover days into ${state.year}`}>
              <span class="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Carryover ({state.year})
              </span>
              <input
                type="number"
                min={-30}
                max={365}
                value={budget.carryOver}
                onInput={(e) =>
                  setCarryOver(Number((e.target as HTMLInputElement).value) || 0)
                }
                class="mt-0.5 w-14 rounded-lg border border-slate-700/80 bg-slate-950 px-1.5 py-0.5 text-center text-sm font-semibold tabular-nums text-slate-300 focus:border-emerald-500 focus:outline-none"
              />
            </label>
          </div>

          {/* Progress Bar + Stats */}
          <div class="flex-1">
            <div class="flex items-center justify-between text-xs mb-1.5">
              <div class="flex items-center gap-3">
                <span class="flex items-center gap-1.5 font-medium text-emerald-400">
                  <span class="h-2 w-2 rounded-full bg-emerald-500" />
                  Confirmed: <strong>{budget.confirmedUsed}d</strong>
                </span>
                <span class="flex items-center gap-1.5 font-medium text-amber-400">
                  <span class="h-2 w-2 rounded-full bg-amber-400" />
                  Draft: <strong>{budget.draftUsed}d</strong>
                </span>
              </div>
              <span
                class={`font-bold tabular-nums ${
                  isOverBudget ? 'text-rose-400' : 'text-slate-100'
                }`}
              >
                {budget.remainingAfterDrafts}d left
                {budget.draftUsed > 0 && (
                  <span class="ml-1 text-[11px] font-normal text-slate-400">
                    ({budget.remainingAfterConfirmed}d w/o drafts)
                  </span>
                )}
              </span>
            </div>

            <div class="h-2.5 w-full overflow-hidden rounded-full bg-slate-800 flex">
              <div
                style={{ width: `${confirmedPct}%` }}
                class="h-full bg-emerald-500 transition-all duration-200"
                title={`Confirmed: ${budget.confirmedUsed} days`}
              />
              <div
                style={{ width: `${draftPct}%` }}
                class="h-full bg-amber-400/90 bg-stripes transition-all duration-200"
                title={`Draft: ${budget.draftUsed} days`}
              />
            </div>
          </div>
        </div>

        {/* Right: Zoom Controls + Undo/Redo + JSON Export/Import */}
        <div class="flex flex-wrap items-center justify-between md:justify-end gap-1.5 sm:gap-2 w-full md:w-auto">
          {/* Zoom Switcher */}
          <div class="flex items-center rounded-xl border border-slate-800 bg-slate-900/90 p-0.5 sm:p-1">
            <button
              type="button"
              onClick={zoomOut}
              disabled={currentZoom === 'year-linear'}
              class="rounded-lg p-1 sm:p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-30 transition-colors"
              title="Zoom Out (-)"
            >
              <ZoomOut class="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>

            <div class="flex items-center gap-0.5 px-0.5 sm:px-1">
              {ZOOM_OPTIONS.map((z) => {
                const active = currentZoom === z.id;
                return (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => (zoomLevel.value = z.id)}
                    title={z.label}
                    class={`rounded-lg px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold transition-all ${
                      active
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {z.short}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={zoomIn}
              disabled={currentZoom === 'month'}
              class="rounded-lg p-1 sm:p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-30 transition-colors"
              title="Zoom In (+)"
            >
              <ZoomIn class="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          </div>

          <div class="flex items-center gap-1.5">
            {/* Bridge Hints Toggle */}
            <button
              type="button"
              onClick={() => (showBridgeHints.value = !showBridgeHints.value)}
              class={`flex items-center gap-1.5 rounded-xl border px-2 sm:px-2.5 py-1.5 sm:py-2 text-xs font-medium transition-all ${
                showBridgeHints.value
                  ? 'border-violet-500/50 bg-violet-500/15 text-violet-300'
                  : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
              title="Highlight optimal bridge days next to holidays & weekends"
            >
              <Sparkles class="h-3.5 w-3.5" />
              <span class="hidden xl:inline">Bridge Hints</span>
            </button>

            {/* Undo / Redo */}
            <div class="flex items-center rounded-xl border border-slate-800 bg-slate-900/90 p-0.5">
              <button
                type="button"
                onClick={undo}
                disabled={undoStack.value.length === 0}
                class="rounded-lg p-1 sm:p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-30 transition-colors"
                title="Undo (Cmd/Ctrl + Z)"
              >
                <Undo2 class="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={redoStack.value.length === 0}
                class="rounded-lg p-1 sm:p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-30 transition-colors"
                title="Redo (Cmd/Ctrl + Y or Cmd/Ctrl + Shift + Z)"
              >
                <Redo2 class="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            </div>
          </div>

          {/* Export / Import JSON */}
          <div
            class={`${
              mobileSettingsOpen ? 'flex w-full justify-end' : 'hidden md:flex'
            } items-center gap-1.5`}
          >
            <button
              type="button"
              onClick={handleExport}
              class="flex items-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-emerald-500/50 hover:bg-slate-800 hover:text-white transition-all"
              title="Export plan as JSON file"
            >
              <Download class="h-3.5 w-3.5 text-emerald-400" />
              <span>Export JSON</span>
            </button>

            <button
              type="button"
              onClick={handleImportClick}
              class="flex items-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-indigo-500/50 hover:bg-slate-800 hover:text-white transition-all"
              title="Import plan from JSON file"
            >
              <Upload class="h-3.5 w-3.5 text-indigo-400" />
              <span>Import JSON</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              class="hidden"
            />

            <button
              type="button"
              onClick={() => {
                if (
                  budget.totalPlanned > 0 &&
                  window.confirm(`Clear all planned & drafted days in ${state.year}?`)
                ) {
                  clearAllPlansForYear();
                  showToast(`Cleared ${state.year} plans`);
                }
              }}
              disabled={budget.totalPlanned === 0}
              class="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:border-rose-500/40 hover:text-rose-400 disabled:opacity-30 transition-all"
              title="Reset current year's planned days"
            >
              <RotateCcw class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
