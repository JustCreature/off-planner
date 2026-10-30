import { useState } from 'preact/hooks';
import {
  Plane,
  Sparkles,
  Check,
  Trash2,
  Clock,
  CalendarRange,
  Edit3,
  Flag,
} from 'lucide-preact';
import {
  vacationBlocks,
  bridgeOpportunities,
  activeHolidays,
  promoteDraftBlockToConfirmed,
  demoteBlockToDraft,
  removeBlockPtoDays,
  updateTripMetadata,
  applyBrushToDates,
  focusedMonth,
  zoomLevel,
  plannerState,
  mobileActiveSection,
} from '../store/plannerStore';
import {
  formatHumanRange,
  formatShortDate,
  getDayOfWeek,
  parseYMD,
} from '../lib/dateUtils';
import { HOLIDAY_PRESETS } from '../lib/holidays';
import type { BridgeOpportunity, VacationBlock } from '../types/planner';

const DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function TripsSidebar() {
  const state = plannerState.value;
  const blocks = vacationBlocks.value;
  const bridges = bridgeOpportunities.value;
  const holidaysMap = activeHolidays.value;
  const holidayList = Object.values(holidaysMap).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const days = state.days;

  const [activeTab, setActiveTab] = useState<'trips' | 'bridges' | 'holidays'>('trips');
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');

  const currentPresetName =
    HOLIDAY_PRESETS.find((p) => p.code === state.countryPreset)?.name ||
    state.countryPreset;

  const jumpToDate = (ymd: string) => {
    const { month } = parseYMD(ymd);
    focusedMonth.value = month;
    if (zoomLevel.value === 'year-grid' || zoomLevel.value === 'year-linear') {
      zoomLevel.value = 'quarter';
    }
    mobileActiveSection.value = 'calendar';
  };

  const startEditingName = (block: VacationBlock) => {
    setEditingBlockId(block.id);
    setNameDraft(block.name);
  };

  const commitName = (blockId: string) => {
    updateTripMetadata(blockId, { name: nameDraft.trim() });
    setEditingBlockId(null);
  };

  const isBridgeAlreadyPlanned = (opp: BridgeOpportunity) => {
    return opp.ptoDates.every((d) => Boolean(days[d]));
  };

  return (
    <aside class="flex flex-col rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 shadow-sm h-fit xl:sticky xl:top-20">
      {/* Tabs */}
      <div class="grid grid-cols-3 gap-1 rounded-xl bg-slate-950/80 p-1 mb-4 border border-slate-800/70">
        <button
          type="button"
          onClick={() => setActiveTab('trips')}
          class={`flex items-center justify-center gap-1 rounded-lg py-2 text-[11px] font-bold transition-all cursor-pointer ${
            activeTab === 'trips'
              ? 'bg-slate-800 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Plane class="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          <span>Trips ({blocks.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('bridges')}
          class={`flex items-center justify-center gap-1 rounded-lg py-2 text-[11px] font-bold transition-all cursor-pointer ${
            activeTab === 'bridges'
              ? 'bg-slate-800 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles class="h-3.5 w-3.5 text-violet-400 shrink-0" />
          <span>Bridges ({bridges.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('holidays')}
          class={`flex items-center justify-center gap-1 rounded-lg py-2 text-[11px] font-bold transition-all cursor-pointer ${
            activeTab === 'holidays'
              ? 'bg-slate-800 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Flag class="h-3.5 w-3.5 text-rose-400 shrink-0" />
          <span>Feiertage ({holidayList.length})</span>
        </button>
      </div>

      {activeTab === 'trips' && (
        <div class="flex flex-col gap-3 max-h-[calc(100vh-220px)] overflow-y-auto pr-0.5">
          {blocks.length === 0 ? (
            <div class="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 px-4 py-8 text-center">
              <CalendarRange class="h-8 w-8 text-slate-600 mb-2" />
              <p class="text-xs font-semibold text-slate-300">
                No vacations planned yet
              </p>
              <p class="mt-1 text-[11px] text-slate-500">
                Click or drag across dates on the calendar to draft or confirm time off. Adjacent weekends & holidays merge automatically!
              </p>
            </div>
          ) : (
            blocks.map((block) => (
              <div
                key={block.id}
                class="group rounded-xl border border-slate-800 bg-slate-950/70 p-3 hover:border-slate-700 transition-all"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="flex-1 min-w-0">
                    {editingBlockId === block.id ? (
                      <input
                        type="text"
                        value={nameDraft}
                        autoFocus
                        onInput={(e) =>
                          setNameDraft((e.target as HTMLInputElement).value)
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitName(block.id);
                          if (e.key === 'Escape') setEditingBlockId(null);
                        }}
                        onBlur={() => commitName(block.id)}
                        class="w-full rounded border border-indigo-500 bg-slate-900 px-2 py-0.5 text-xs font-bold text-white focus:outline-none"
                      />
                    ) : (
                      <div class="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => jumpToDate(block.startDate)}
                          class="truncate text-left text-xs font-bold text-slate-100 hover:text-indigo-300 transition-colors"
                          title="Click to focus calendar on this trip"
                        >
                          {block.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditingName(block)}
                          class="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-300 transition-opacity"
                          title="Rename trip"
                        >
                          <Edit3 class="h-3 w-3" />
                        </button>
                      </div>
                    )}

                    <div class="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                      <span>{formatHumanRange(block.startDate, block.endDate)}</span>
                      <span>•</span>
                      <span class="font-semibold text-indigo-300">
                        {block.efficiency}x multiplier
                      </span>
                    </div>
                  </div>

                  {/* Status Pill */}
                  <span
                    class={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      block.isAllDraft
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : block.isMixed
                          ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {block.isAllDraft
                      ? 'Draft'
                      : block.isMixed
                        ? 'Mixed'
                        : 'Confirmed'}
                  </span>
                </div>

                {/* Metrics Breakdown */}
                <div class="mt-2.5 grid grid-cols-3 gap-1.5 rounded-lg bg-slate-900/90 p-2 text-center">
                  <div>
                    <div class="text-[10px] text-slate-400">Total Off</div>
                    <div class="text-xs font-bold text-white">
                      {block.totalDays} days
                    </div>
                  </div>
                  <div>
                    <div class="text-[10px] text-slate-400">PTO Cost</div>
                    <div class="text-xs font-bold text-emerald-400">
                      {block.ptoDays}d
                    </div>
                  </div>
                  <div>
                    <div class="text-[10px] text-slate-400">Free Days</div>
                    <div class="text-xs font-bold text-rose-300">
                      +{block.weekendDays + block.holidayDays}d
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div class="mt-2.5 flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
                  {block.draftPtoDays > 0 ? (
                    <button
                      type="button"
                      onClick={() => promoteDraftBlockToConfirmed(block.dates)}
                      class="flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/25 transition-colors cursor-pointer"
                    >
                      <Check class="h-3 w-3" />
                      <span>Confirm Trip</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => demoteBlockToDraft(block.dates)}
                      class="flex items-center gap-1 rounded-lg bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/25 transition-colors cursor-pointer"
                    >
                      <Clock class="h-3 w-3" />
                      <span>Move to Draft</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => removeBlockPtoDays(block.dates)}
                    class="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-slate-400 hover:bg-rose-500/15 hover:text-rose-300 transition-colors cursor-pointer"
                    title="Delete this trip's PTO days"
                  >
                    <Trash2 class="h-3 w-3" />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'bridges' && (
        <div class="flex flex-col gap-2.5 max-h-[calc(100vh-220px)] overflow-y-auto pr-0.5">
          <p class="text-[11px] text-slate-400 mb-1">
            High-value bridge days (Brückentage) in <strong>{currentPresetName}</strong> where taking 1–2 PTO days links public holidays with weekends:
          </p>

          {bridges.length === 0 ? (
            <div class="rounded-xl border border-dashed border-slate-800 p-6 text-center text-xs text-slate-400">
              No 1–2 day holiday bridges detected for the current preset.
            </div>
          ) : (
            bridges.map((opp) => {
              const planned = isBridgeAlreadyPlanned(opp);
              return (
                <div
                  key={opp.id}
                  class="rounded-xl border border-slate-800 bg-slate-950/70 p-3 hover:border-violet-500/40 transition-all"
                >
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <button
                        type="button"
                        onClick={() => jumpToDate(opp.blockStart)}
                        class="text-left text-xs font-bold text-slate-100 hover:text-violet-300 transition-colors"
                      >
                        {opp.title}
                      </button>
                      <div class="text-[11px] text-slate-400 mt-0.5">
                        {formatHumanRange(opp.blockStart, opp.blockEnd)}
                      </div>
                    </div>
                    <span class="rounded-full bg-violet-500/20 border border-violet-500/30 px-2 py-0.5 text-[10px] font-bold text-violet-300 shrink-0">
                      {opp.efficiency}x ({opp.ptoCost}d → {opp.totalDaysOff}d)
                    </span>
                  </div>

                  <div class="mt-2.5 flex items-center justify-between gap-2">
                    <span class="text-[11px] text-slate-400">
                      Take off: <strong class="text-slate-200">{opp.ptoDates.map(formatShortDate).join(', ')}</strong>
                    </span>

                    {planned ? (
                      <span class="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                        <Check class="h-3 w-3" /> Planned
                      </span>
                    ) : (
                      <div class="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => applyBrushToDates(opp.ptoDates, 'draft')}
                          class="rounded-lg bg-amber-500/20 px-2 py-1 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/30 transition-colors cursor-pointer"
                        >
                          + Draft
                        </button>
                        <button
                          type="button"
                          onClick={() => applyBrushToDates(opp.ptoDates, 'confirmed')}
                          class="rounded-lg bg-emerald-500/20 px-2 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/30 transition-colors cursor-pointer"
                        >
                          + Confirm
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'holidays' && (
        <div class="flex flex-col gap-2 max-h-[calc(100vh-220px)] overflow-y-auto pr-0.5">
          <div class="flex items-center justify-between text-[11px] text-slate-400 mb-1">
            <span>
              Public Holidays in <strong class="text-slate-200">{currentPresetName}</strong> ({state.year})
            </span>
            <span>
              {
                holidayList.filter((h) =>
                  state.workdays.includes(getDayOfWeek(h.date))
                ).length
              }{' '}
              on workdays
            </span>
          </div>

          {holidayList.map((h) => {
            const dow = getDayOfWeek(h.date);
            const isWorkday = state.workdays.includes(dow);
            return (
              <button
                key={h.date}
                type="button"
                onClick={() => jumpToDate(h.date)}
                class="flex items-center justify-between gap-2 rounded-xl border border-slate-800/80 bg-slate-950/60 px-3 py-2 text-left hover:border-rose-500/40 transition-colors cursor-pointer"
              >
                <div class="min-w-0">
                  <div class="truncate text-xs font-semibold text-slate-100">
                    {h.name}
                  </div>
                  <div class="text-[11px] text-slate-400">
                    {DOW_NAMES[dow]}, {formatShortDate(h.date)} ({h.date})
                  </div>
                </div>
                <span
                  class={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                    isWorkday
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {isWorkday ? 'Free Workday' : 'Weekend'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
}
