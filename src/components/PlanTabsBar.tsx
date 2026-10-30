import { useState, useEffect } from 'preact/hooks';
import {
  Plus,
  Copy,
  Check,
  X,
  Edit3,
  Trash2,
  Home,
  FileSpreadsheet,
  AlertTriangle,
  Calendar,
} from 'lucide-preact';
import {
  plannerState,
  switchTab,
  createPlanTab,
  duplicatePlanTab,
  renamePlanTab,
  deletePlanTab,
  applyModalOpenForPlanId,
  getDefaultApplyInterval,
  previewApplyPlanToMain,
  applyPlanToMain,
} from '../store/plannerStore';
import { formatHumanRange } from '../lib/dateUtils';

export function PlanTabsBar() {
  const state = plannerState.value;
  const activeTabId = state.activeTabId;
  const plans = state.plans;

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');

  // Modal state for "Apply Plan to Main"
  const modalPlanId = applyModalOpenForPlanId.value;
  const [intervalStart, setIntervalStart] = useState('');
  const [intervalEnd, setIntervalEnd] = useState('');

  useEffect(() => {
    if (modalPlanId) {
      const def = getDefaultApplyInterval(modalPlanId, state);
      setIntervalStart(def.startDate);
      setIntervalEnd(def.endDate);
    }
  }, [modalPlanId]);

  const startRename = (id: string, currentName: string, e: MouseEvent) => {
    e.stopPropagation();
    setRenamingId(id);
    setNameInput(currentName);
  };

  const commitRename = (id: string) => {
    if (nameInput.trim()) {
      renamePlanTab(id, nameInput);
    }
    setRenamingId(null);
  };

  const activePlan = plans.find((p) => p.id === activeTabId);
  const mainDaysCount =
    activeTabId === 'main'
      ? Object.keys(state.days).length
      : Object.keys(state.mainData.days).length;

  const preview =
    modalPlanId && intervalStart && intervalEnd
      ? previewApplyPlanToMain(modalPlanId, intervalStart, intervalEnd, state)
      : null;

  return (
    <div class="border-b border-slate-800/80 bg-slate-950/95 px-3 sm:px-4 pt-2">
      <div class="mx-auto flex max-w-[1920px] 3xl:max-w-[2560px] 4xl:max-w-[3400px] flex-wrap items-center justify-between gap-2">
        {/* Left: Main Tab + Plan Tabs + '+' Button */}
        <div class="flex items-center gap-1.5 overflow-x-auto pb-1.5">
          {/* Main Tab */}
          <div
            onClick={() => switchTab('main')}
            class={`group relative flex items-center gap-2 rounded-t-xl border-x border-t px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
              activeTabId === 'main'
                ? 'border-slate-700 bg-slate-900 text-emerald-300 shadow-sm'
                : 'border-transparent bg-slate-900/40 text-slate-400 hover:bg-slate-900/70 hover:text-slate-200'
            }`}
          >
            <Home class="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span>Main</span>
            <span class="rounded-full bg-slate-800 px-1.5 py-0.2 text-[10px] font-semibold text-slate-300">
              {mainDaysCount}d
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                duplicatePlanTab('main');
              }}
              class="rounded p-0.5 text-slate-400 opacity-60 group-hover:opacity-100 hover:bg-slate-800 hover:text-emerald-300 transition-opacity cursor-pointer"
              title="Clone Main into a new Plan tab"
            >
              <Copy class="h-3 w-3" />
            </button>
            {activeTabId === 'main' && (
              <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />
            )}
          </div>

          {/* Scenario Plan Tabs */}
          {plans.map((plan) => {
            const isActive = activeTabId === plan.id;
            const daysCount = isActive
              ? Object.keys(state.days).length
              : Object.keys(plan.days).length;

            return (
              <div
                key={plan.id}
                onClick={() => switchTab(plan.id)}
                class={`group relative flex items-center gap-2 rounded-t-xl border-x border-t px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'border-indigo-500/40 bg-slate-900 text-indigo-200 shadow-sm'
                    : 'border-transparent bg-slate-900/40 text-slate-400 hover:bg-slate-900/70 hover:text-slate-200'
                }`}
              >
                <FileSpreadsheet class="h-3.5 w-3.5 text-indigo-400 shrink-0" />

                {renamingId === plan.id ? (
                  <input
                    type="text"
                    value={nameInput}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onInput={(e) =>
                      setNameInput((e.target as HTMLInputElement).value)
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(plan.id);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    onBlur={() => commitRename(plan.id)}
                    class="w-24 rounded border border-indigo-500 bg-slate-950 px-1.5 py-0.5 text-xs font-bold text-white focus:outline-none"
                  />
                ) : (
                  <span
                    onDblClick={(e) => startRename(plan.id, plan.name, e)}
                    title="Double-click to rename tab"
                    class="truncate max-w-[140px]"
                  >
                    {plan.name}
                  </span>
                )}

                <span class="rounded-full bg-slate-800 px-1.5 py-0.2 text-[10px] text-slate-300">
                  {daysCount}d
                </span>

                {/* Clone, Rename & Close Icons */}
                <div class="flex items-center gap-0.5 opacity-60 group-hover:opacity-100">
                  {renamingId !== plan.id && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicatePlanTab(plan.id);
                        }}
                        class="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-indigo-300 cursor-pointer"
                        title={`Clone "${plan.name}" into a new Plan tab`}
                      >
                        <Copy class="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => startRename(plan.id, plan.name, e)}
                        class="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
                        title="Rename Plan Tab"
                      >
                        <Edit3 class="h-3 w-3" />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePlanTab(plan.id);
                    }}
                    class="rounded p-0.5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300 cursor-pointer"
                    title="Close / Delete Plan Tab (Undoable)"
                  >
                    <X class="h-3 w-3" />
                  </button>
                </div>

                {isActive && (
                  <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-400" />
                )}
              </div>
            );
          })}

          {/* '+' Add New Plan Tab Button */}
          <button
            type="button"
            onClick={() => createPlanTab()}
            class="flex items-center gap-1 rounded-xl border border-dashed border-slate-700 bg-slate-900/50 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:border-indigo-500/50 hover:bg-indigo-950/30 hover:text-indigo-200 transition-all cursor-pointer"
            title="Create a new empty Plan tab (Plan 1, Plan 2, ...)"
          >
            <Plus class="h-3.5 w-3.5 text-indigo-400" />
            <span>New Plan</span>
          </button>

          {/* Duplicate Current Tab (Main or Active Plan) Button */}
          <button
            type="button"
            onClick={() => duplicatePlanTab(activeTabId)}
            class="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/50 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:border-slate-700 hover:text-slate-200 transition-all cursor-pointer"
            title={`Clone ${activePlan ? `"${activePlan.name}"` : 'Main'} into a new Plan tab`}
          >
            <Copy class="h-3 w-3" />
            <span class="hidden sm:inline">
              Clone {activePlan ? activePlan.name : 'Main'}
            </span>
          </button>
        </div>

        {/* Right: Active Plan Actions ("Apply Plan to Main") */}
        {activePlan && (
          <div class="flex items-center gap-2 pb-1.5">
            <span class="hidden md:inline text-xs text-indigo-300/90">
              Editing scenario: <strong>{activePlan.name}</strong>
            </span>
            <button
              type="button"
              onClick={() => (applyModalOpenForPlanId.value = activePlan.id)}
              class="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-indigo-500/20 hover:from-indigo-500 hover:to-emerald-500 transition-all cursor-pointer"
              title="Copy and overwrite this Plan into the Main tab for a configurable date interval"
            >
              <Check class="h-3.5 w-3.5" />
              <span>Apply to Main…</span>
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Applying Plan to Main */}
      {modalPlanId && preview && (
        <div
          onClick={() => (applyModalOpenForPlanId.value = null)}
          class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            class="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-2.5">
                <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300">
                  <Calendar class="h-5 w-5" />
                </div>
                <div>
                  <h3 class="text-base font-bold text-white">
                    Apply "{preview.planName}" to Main
                  </h3>
                  <p class="text-xs text-slate-400">
                    Copy planned days from <strong>{preview.planName}</strong> and overwrite <strong>Main</strong> within the selected interval.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => (applyModalOpenForPlanId.value = null)}
                class="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
              >
                <X class="h-4 w-4" />
              </button>
            </div>

            {/* Configurable Interval Inputs */}
            <div class="mt-5 rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Overwrite Interval
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const def = getDefaultApplyInterval(modalPlanId, state);
                    setIntervalStart(def.startDate);
                    setIntervalEnd(def.endDate);
                  }}
                  class="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 cursor-pointer"
                >
                  Reset to smart default
                </button>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label class="flex flex-col gap-1">
                  <span class="text-[11px] text-slate-400">From Date</span>
                  <input
                    type="date"
                    value={intervalStart}
                    onInput={(e) =>
                      setIntervalStart((e.target as HTMLInputElement).value)
                    }
                    class="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white focus:border-indigo-500 focus:outline-none"
                  />
                </label>

                <label class="flex flex-col gap-1">
                  <span class="text-[11px] text-slate-400">To Date</span>
                  <input
                    type="date"
                    value={intervalEnd}
                    onInput={(e) =>
                      setIntervalEnd((e.target as HTMLInputElement).value)
                    }
                    class="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white focus:border-indigo-500 focus:outline-none"
                  />
                </label>
              </div>

              <p class="text-[11px] text-slate-400">
                Default rule: Full calendar year if all vacations are within one year, or from first planned day to last planned day if multiple years are touched.
              </p>
            </div>

            {/* Impact / Overwrite Check Summary */}
            <div class="mt-4 rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 space-y-2.5">
              <div class="flex items-center gap-2 text-amber-300 font-bold text-xs">
                <AlertTriangle class="h-4 w-4 text-amber-400 shrink-0" />
                <span>Overwrite Impact in Main ({formatHumanRange(preview.startDate, preview.endDate)})</span>
              </div>

              <div class="grid grid-cols-2 gap-3 pt-1">
                <div class="rounded-lg bg-slate-950/80 p-2.5 border border-slate-800">
                  <div class="text-[10px] uppercase tracking-wider text-slate-400">
                    Existing in Main (Will be overwritten)
                  </div>
                  <div class="mt-1 text-sm font-bold text-rose-300">
                    {preview.overwrittenMainTripsCount} vacation intervals ({preview.overwrittenMainDaysCount} days)
                  </div>
                </div>

                <div class="rounded-lg bg-slate-950/80 p-2.5 border border-slate-800">
                  <div class="text-[10px] uppercase tracking-wider text-slate-400">
                    Incoming from {preview.planName}
                  </div>
                  <div class="mt-1 text-sm font-bold text-emerald-300">
                    {preview.planTripsInInterval} vacation intervals ({preview.planDaysInInterval} days)
                  </div>
                </div>
              </div>

              <p class="text-[11px] text-slate-400">
                Affected years: <strong>{preview.affectedYears.join(', ')}</strong>. You can undo this operation at any time with <kbd class="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">Cmd/Ctrl + Z</kbd>.
              </p>
            </div>

            {/* Modal Footer */}
            <div class="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => (applyModalOpenForPlanId.value = null)}
                class="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  applyPlanToMain(modalPlanId, intervalStart, intervalEnd);
                  applyModalOpenForPlanId.value = null;
                }}
                class="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                <Check class="h-4 w-4 stroke-[2.5]" />
                <span>Confirm & Overwrite Main</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
