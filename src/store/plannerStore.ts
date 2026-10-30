import { signal, computed, effect } from '@preact/signals';
import type {
  ApplyIntervalPreview,
  BrushMode,
  DayEntry,
  DayStatus,
  Holiday,
  OverlayDisplayPriority,
  OverlayUserPref,
  PlannerState,
  PlanTab,
  ResolvedDayOverlay,
  TripMetadata,
  YearBudgetConfig,
  ZoomLevel,
} from '../types/planner';
import { generatePresetHolidays } from '../lib/holidays';
import { OVERLAY_CONFIGS, computeActiveDayOverlays } from '../lib/overlays';
import {
  computeVacationBlocks,
  findBridgeOpportunities,
  getDayPtoCost,
  parseYMD,
  TRIP_COLORS,
} from '../lib/dateUtils';
import {
  LocalStoragePlannerRepository,
  type PlannerRepository,
} from '../services/plannerRepository';

const DEFAULT_YEAR = new Date().getFullYear();

export function createDefaultOverlayPrefs(): Record<string, OverlayUserPref> {
  const prefs: Record<string, OverlayUserPref> = {};
  for (const cfg of OVERLAY_CONFIGS) {
    prefs[cfg.id] = {
      enabled: cfg.defaultEnabled ?? false,
      color: cfg.color,
      display: cfg.defaultDisplay,
      disabledRegions: [],
    };
  }
  return prefs;
}

export function createDefaultState(year = DEFAULT_YEAR): PlannerState {
  const initialYearSettings: Record<string, YearBudgetConfig> = {
    [String(year)]: { allowance: 25, carryOver: 0 },
  };
  return {
    version: 1,
    year,
    allowance: 25,
    carryOver: 0,
    yearSettings: { ...initialYearSettings },
    showOverlays: true,
    overlayPrefs: createDefaultOverlayPrefs(),
    workdays: [1, 2, 3, 4, 5],
    weekStartsOnMonday: true,
    countryPreset: 'DE-BE',
    days: {},
    customHolidays: {},
    disabledPresetHolidays: [],
    tripMeta: {},
    activeTabId: 'main',
    mainData: {
      days: {},
      customHolidays: {},
      disabledPresetHolidays: [],
      tripMeta: {},
      yearSettings: { ...initialYearSettings },
    },
    plans: [],
  };
}

/**
 * Syncs the active tab's data (`days`, `customHolidays`, `disabledPresetHolidays`, `tripMeta`, `yearSettings`)
 * between the top-level convenience fields and either `mainData` or the active `PlanTab` in `plans`.
 */
function syncTopLevelToActiveStorage(s: PlannerState): PlannerState {
  const yearCfg = s.yearSettings?.[String(s.year)] || {
    allowance: s.allowance,
    carryOver: s.carryOver,
  };
  const updatedYearSettings = {
    ...s.yearSettings,
    [String(s.year)]: yearCfg,
  };

  if (s.activeTabId === 'main') {
    return {
      ...s,
      allowance: yearCfg.allowance,
      carryOver: yearCfg.carryOver,
      yearSettings: updatedYearSettings,
      mainData: {
        days: s.days,
        customHolidays: s.customHolidays,
        disabledPresetHolidays: s.disabledPresetHolidays,
        tripMeta: s.tripMeta,
        yearSettings: updatedYearSettings,
      },
    };
  }

  return {
    ...s,
    allowance: yearCfg.allowance,
    carryOver: yearCfg.carryOver,
    yearSettings: updatedYearSettings,
    plans: s.plans.map((p) =>
      p.id === s.activeTabId
        ? {
            ...p,
            days: s.days,
            customHolidays: s.customHolidays,
            disabledPresetHolidays: s.disabledPresetHolidays,
            tripMeta: s.tripMeta,
            yearSettings: updatedYearSettings,
          }
        : p
    ),
  };
}

/**
 * Loads the target `tabId` ('main' or a plan id) into the top-level active fields.
 */
function activateTabInState(s: PlannerState, targetTabId: string): PlannerState {
  // First ensure current edits are flushed into current tab's storage
  const flushed = syncTopLevelToActiveStorage(s);

  if (targetTabId === 'main') {
    const md = flushed.mainData;
    const ys = { ...md.yearSettings };
    if (!ys[String(flushed.year)]) {
      ys[String(flushed.year)] = { allowance: flushed.allowance, carryOver: 0 };
    }
    const yCfg = ys[String(flushed.year)];
    return {
      ...flushed,
      activeTabId: 'main',
      days: { ...md.days },
      customHolidays: { ...md.customHolidays },
      disabledPresetHolidays: [...md.disabledPresetHolidays],
      tripMeta: { ...md.tripMeta },
      yearSettings: ys,
      allowance: yCfg.allowance,
      carryOver: yCfg.carryOver,
    };
  }

  const targetPlan = flushed.plans.find((p) => p.id === targetTabId);
  if (!targetPlan) return flushed;

  const ys = { ...targetPlan.yearSettings };
  if (!ys[String(flushed.year)]) {
    ys[String(flushed.year)] = { allowance: flushed.allowance, carryOver: 0 };
  }
  const yCfg = ys[String(flushed.year)];

  return {
    ...flushed,
    activeTabId: targetPlan.id,
    days: { ...targetPlan.days },
    customHolidays: { ...targetPlan.customHolidays },
    disabledPresetHolidays: [...targetPlan.disabledPresetHolidays],
    tripMeta: { ...targetPlan.tripMeta },
    yearSettings: ys,
    allowance: yCfg.allowance,
    carryOver: yCfg.carryOver,
  };
}

function sanitizeDaysMap(rawDays: unknown): Record<string, DayEntry> {
  const days: Record<string, DayEntry> = {};
  if (rawDays && typeof rawDays === 'object') {
    for (const [k, v] of Object.entries(rawDays as Record<string, unknown>)) {
      if (v && typeof v === 'object') {
        const entry = v as Record<string, unknown>;
        const status = entry.status as DayStatus;
        if (
          status === 'confirmed' ||
          status === 'draft' ||
          status === 'half-confirmed' ||
          status === 'half-draft'
        ) {
          days[k] = {
            date: k,
            status,
            note: typeof entry.note === 'string' ? entry.note : undefined,
            tripId: typeof entry.tripId === 'string' ? entry.tripId : undefined,
          };
        }
      }
    }
  }
  return days;
}

function sanitizeCustomHolidaysMap(rawHol: unknown): Record<string, Holiday> {
  const customHolidays: Record<string, Holiday> = {};
  if (rawHol && typeof rawHol === 'object') {
    for (const [k, v] of Object.entries(rawHol as Record<string, unknown>)) {
      if (v && typeof v === 'object') {
        const h = v as Record<string, unknown>;
        customHolidays[k] = {
          date: k,
          name:
            typeof h.name === 'string' && h.name.trim()
              ? h.name
              : 'Custom Holiday',
          source: 'custom',
        };
      }
    }
  }
  return customHolidays;
}

function sanitizeTripMetaMap(rawMeta: unknown): Record<string, TripMetadata> {
  const tripMeta: Record<string, TripMetadata> = {};
  if (rawMeta && typeof rawMeta === 'object') {
    for (const [k, v] of Object.entries(rawMeta as Record<string, unknown>)) {
      if (v && typeof v === 'object') {
        const m = v as Record<string, unknown>;
        tripMeta[k] = {
          id: k,
          name: typeof m.name === 'string' ? m.name : '',
          color: typeof m.color === 'string' ? m.color : TRIP_COLORS[0],
          notes: typeof m.notes === 'string' ? m.notes : undefined,
        };
      }
    }
  }
  return tripMeta;
}

function sanitizeYearSettingsMap(
  rawYs: unknown,
  fallbackAllowance: number
): Record<string, YearBudgetConfig> {
  const yearSettings: Record<string, YearBudgetConfig> = {};
  if (rawYs && typeof rawYs === 'object') {
    for (const [yKey, val] of Object.entries(rawYs as Record<string, unknown>)) {
      if (val && typeof val === 'object') {
        const ys = val as Record<string, unknown>;
        const a =
          typeof ys.allowance === 'number' &&
          ys.allowance >= 0 &&
          ys.allowance <= 365
            ? ys.allowance
            : fallbackAllowance;
        const c =
          typeof ys.carryOver === 'number' &&
          ys.carryOver >= -100 &&
          ys.carryOver <= 365
            ? ys.carryOver
            : 0;
        yearSettings[yKey] = { allowance: a, carryOver: c };
      }
    }
  }
  return yearSettings;
}

export function sanitizeImportedState(raw: unknown): PlannerState {
  const base = createDefaultState();
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Record<string, unknown>;

  const year =
    typeof obj.year === 'number' && obj.year >= 2000 && obj.year <= 2100
      ? Math.floor(obj.year)
      : base.year;
  const fallbackAllowance =
    typeof obj.allowance === 'number' &&
    obj.allowance >= 0 &&
    obj.allowance <= 365
      ? obj.allowance
      : base.allowance;
  const fallbackCarryOver =
    typeof obj.carryOver === 'number' &&
    obj.carryOver >= -100 &&
    obj.carryOver <= 365
      ? obj.carryOver
      : base.carryOver;

  const yearSettings = sanitizeYearSettingsMap(
    obj.yearSettings,
    fallbackAllowance
  );
  if (!yearSettings[String(year)]) {
    yearSettings[String(year)] = {
      allowance: fallbackAllowance,
      carryOver: fallbackCarryOver,
    };
  }

  const activeYearConfig = yearSettings[String(year)];
  const allowance = activeYearConfig.allowance;
  const carryOver = activeYearConfig.carryOver;
  const workdays = Array.isArray(obj.workdays)
    ? obj.workdays.filter(
        (n): n is number => typeof n === 'number' && n >= 0 && n <= 6
      )
    : base.workdays;
  const weekStartsOnMonday =
    typeof obj.weekStartsOnMonday === 'boolean'
      ? obj.weekStartsOnMonday
      : base.weekStartsOnMonday;
  const rawPreset =
    typeof obj.countryPreset === 'string'
      ? obj.countryPreset
      : base.countryPreset;
  const countryPreset = rawPreset === 'DE' ? 'DE-BE' : rawPreset;

  const days = sanitizeDaysMap(obj.days);
  const customHolidays = sanitizeCustomHolidaysMap(obj.customHolidays);
  const disabledPresetHolidays = Array.isArray(obj.disabledPresetHolidays)
    ? obj.disabledPresetHolidays.filter((d): d is string => typeof d === 'string')
    : [];
  const tripMeta = sanitizeTripMetaMap(obj.tripMeta);

  // Sanitize mainData (or fallback to top-level fields for v1 files without mainData)
  let mainData: PlannerState['mainData'] = {
    days: { ...days },
    customHolidays: { ...customHolidays },
    disabledPresetHolidays: [...disabledPresetHolidays],
    tripMeta: { ...tripMeta },
    yearSettings: { ...yearSettings },
  };
  if (obj.mainData && typeof obj.mainData === 'object') {
    const md = obj.mainData as Record<string, unknown>;
    const mdYs = sanitizeYearSettingsMap(md.yearSettings, fallbackAllowance);
    if (!mdYs[String(year)]) {
      mdYs[String(year)] = { allowance, carryOver };
    }
    mainData = {
      days: sanitizeDaysMap(md.days),
      customHolidays: sanitizeCustomHolidaysMap(md.customHolidays),
      disabledPresetHolidays: Array.isArray(md.disabledPresetHolidays)
        ? md.disabledPresetHolidays.filter(
            (d): d is string => typeof d === 'string'
          )
        : [],
      tripMeta: sanitizeTripMetaMap(md.tripMeta),
      yearSettings: mdYs,
    };
  }

  // Sanitize plans[]
  const plans: PlanTab[] = [];
  if (Array.isArray(obj.plans)) {
    for (const item of obj.plans) {
      if (item && typeof item === 'object') {
        const p = item as Record<string, unknown>;
        if (typeof p.id === 'string' && p.id.trim()) {
          const pYs = sanitizeYearSettingsMap(p.yearSettings, fallbackAllowance);
          if (!pYs[String(year)]) {
            pYs[String(year)] = { allowance, carryOver: 0 };
          }
          plans.push({
            id: p.id,
            name: typeof p.name === 'string' && p.name.trim() ? p.name : 'Plan',
            createdAt:
              typeof p.createdAt === 'string'
                ? p.createdAt
                : new Date().toISOString(),
            days: sanitizeDaysMap(p.days),
            customHolidays: sanitizeCustomHolidaysMap(p.customHolidays),
            disabledPresetHolidays: Array.isArray(p.disabledPresetHolidays)
              ? p.disabledPresetHolidays.filter(
                  (d): d is string => typeof d === 'string'
                )
              : [],
            tripMeta: sanitizeTripMetaMap(p.tripMeta),
            yearSettings: pYs,
          });
        }
      }
    }
  }

  const showOverlays =
    typeof obj.showOverlays === 'boolean' ? obj.showOverlays : true;

  const overlayPrefs = createDefaultOverlayPrefs();
  if (obj.overlayPrefs && typeof obj.overlayPrefs === 'object') {
    for (const [id, rawPref] of Object.entries(
      obj.overlayPrefs as Record<string, unknown>
    )) {
      if (rawPref && typeof rawPref === 'object') {
        const p = rawPref as Record<string, unknown>;
        const existing = overlayPrefs[id] || {
          enabled: false,
          color: '#f97316',
          display: 'secondary' as OverlayDisplayPriority,
          disabledRegions: [],
        };
        overlayPrefs[id] = {
          enabled:
            typeof p.enabled === 'boolean' ? p.enabled : existing.enabled,
          color:
            typeof p.color === 'string' && p.color.trim()
              ? p.color
              : existing.color,
          display:
            p.display === 'primary' || p.display === 'secondary'
              ? p.display
              : existing.display,
          disabledRegions: Array.isArray(p.disabledRegions)
            ? p.disabledRegions.filter((r): r is string => typeof r === 'string')
            : [],
        };
      }
    }
  }

  const requestedTabId =
    typeof obj.activeTabId === 'string' ? obj.activeTabId : 'main';
  const validTabId =
    requestedTabId === 'main' || plans.some((p) => p.id === requestedTabId)
      ? requestedTabId
      : 'main';

  const initial: PlannerState = {
    version: 1,
    year,
    allowance,
    carryOver,
    yearSettings,
    showOverlays,
    overlayPrefs,
    workdays: workdays.length > 0 ? workdays : [1, 2, 3, 4, 5],
    weekStartsOnMonday,
    countryPreset,
    days,
    customHolidays,
    disabledPresetHolidays,
    tripMeta,
    activeTabId: 'main',
    mainData,
    plans,
  };

  return activateTabInState(initial, validTabId);
}

// Repository instance (LocalStorage + In-Memory Backend Service — guarantees data preservation across reloads)
export const plannerRepository: PlannerRepository =
  new LocalStoragePlannerRepository(createDefaultState(), sanitizeImportedState);

// Signals
export const plannerState = signal<PlannerState>(createDefaultState());
export const isHydrated = signal<boolean>(false);
export const undoStack = signal<PlannerState[]>([]);
export const redoStack = signal<PlannerState[]>([]);

// UI Signals
export const zoomLevel = signal<ZoomLevel>('year-grid');
export const activeBrush = signal<BrushMode>('confirmed');
export const focusedMonth = signal<number>(0); // 0..11 for Month / Quarter / 6-Month views
export const showBridgeHints = signal<boolean>(true);
export const includeDraftsInBudget = signal<boolean>(true);
export const selectedDateForDetail = signal<string | null>(null);
export const applyModalOpenForPlanId = signal<string | null>(null);

export async function initStoreFromStorage() {
  if (typeof window === 'undefined' || isHydrated.value) return;
  const loaded = await plannerRepository.getState();
  plannerState.value = loaded;
  isHydrated.value = true;
}

// Sync state changes to the in-memory repository service
if (typeof window !== 'undefined') {
  effect(() => {
    const current = plannerState.value;
    if (!isHydrated.value) return;
    void plannerRepository.saveState(current);
  });
}

function commitState(updater: (prev: PlannerState) => PlannerState) {
  const prev = plannerState.value;
  const rawNext = updater(prev);
  if (rawNext === prev) return;
  const next = syncTopLevelToActiveStorage(rawNext);
  undoStack.value = [...undoStack.value.slice(-49), prev];
  redoStack.value = [];
  plannerState.value = next;
  void plannerRepository.saveState(next);
}

export function undo() {
  const stack = undoStack.value;
  if (stack.length === 0) return;
  const previous = stack[stack.length - 1];
  undoStack.value = stack.slice(0, -1);
  redoStack.value = [...redoStack.value, plannerState.value];
  plannerState.value = previous;
  void plannerRepository.saveState(previous);
}

export function redo() {
  const stack = redoStack.value;
  if (stack.length === 0) return;
  const next = stack[stack.length - 1];
  redoStack.value = stack.slice(0, -1);
  undoStack.value = [...undoStack.value, plannerState.value];
  plannerState.value = next;
  void plannerRepository.saveState(next);
}

// Computed Active Holidays (preset minus disabled + custom)
export const activeHolidays = computed<Record<string, Holiday>>(() => {
  const s = plannerState.value;
  const presets = generatePresetHolidays(s.year, s.countryPreset);
  const disabled = new Set(s.disabledPresetHolidays);
  const merged: Record<string, Holiday> = {};

  for (const [date, hol] of Object.entries(presets)) {
    if (!disabled.has(date)) {
      merged[date] = hol;
    }
  }
  for (const [date, hol] of Object.entries(s.customHolidays)) {
    merged[date] = hol;
  }
  return merged;
});

// Computed PTO Budget Summary
export const budgetSummary = computed(() => {
  const s = plannerState.value;
  const holidays = activeHolidays.value;
  const yearCfg = s.yearSettings?.[String(s.year)] || {
    allowance: s.allowance,
    carryOver: s.carryOver,
  };
  let confirmedUsed = 0;
  let draftUsed = 0;

  for (const ymd of Object.keys(s.days)) {
    if (!ymd.startsWith(`${s.year}-`)) continue;
    const cost = getDayPtoCost(ymd, s.days, holidays, s.workdays);
    confirmedUsed += cost.confirmed;
    draftUsed += cost.draft;
  }

  const totalBudget = yearCfg.allowance + yearCfg.carryOver;
  const remainingAfterConfirmed = totalBudget - confirmedUsed;
  const remainingAfterDrafts = totalBudget - confirmedUsed - draftUsed;

  return {
    allowance: yearCfg.allowance,
    carryOver: yearCfg.carryOver,
    totalBudget,
    confirmedUsed,
    draftUsed,
    totalPlanned: confirmedUsed + draftUsed,
    remainingAfterConfirmed,
    remainingAfterDrafts,
  };
});

// Computed Vacation Blocks (Trips)
export const vacationBlocks = computed(() => {
  const s = plannerState.value;
  return computeVacationBlocks(
    s.year,
    s.days,
    activeHolidays.value,
    s.workdays,
    s.tripMeta
  );
});

// Computed Bridge Day Opportunities
export const bridgeOpportunities = computed(() => {
  const s = plannerState.value;
  return findBridgeOpportunities(s.year, activeHolidays.value, s.workdays);
});

export const bridgeHintDates = computed<Set<string>>(() => {
  const set = new Set<string>();
  if (!showBridgeHints.value) return set;
  for (const opp of bridgeOpportunities.value) {
    for (const d of opp.ptoDates) {
      set.add(d);
    }
  }
  return set;
});

// Computed Active YAML Overlays per Day
export const activeDayOverlays = computed<Record<string, ResolvedDayOverlay[]>>(() => {
  const s = plannerState.value;
  if (!s.showOverlays) return {};
  return computeActiveDayOverlays(s.year, OVERLAY_CONFIGS, s.overlayPrefs || {});
});

export const leftPanelOpen = signal<boolean>(true);

export function toggleShowOverlays() {
  commitState((s) => ({
    ...s,
    showOverlays: !s.showOverlays,
  }));
}

// ==========================================
// TAB & PLAN MANAGEMENT ACTIONS (Undoable)
// ==========================================

export function switchTab(tabId: string) {
  if (plannerState.value.activeTabId === tabId) return;
  commitState((s) => activateTabInState(s, tabId));
}

export function createPlanTab(customName?: string): string {
  const s = plannerState.value;
  const nextNumber = s.plans.length + 1;
  const id = `plan-${Date.now()}-${nextNumber}`;
  const name = customName?.trim() || `Plan ${nextNumber}`;

  commitState((prev) => {
    const flushed = syncTopLevelToActiveStorage(prev);
    // Initialize new plan tab with current yearSettings from Main so allowance/carryover match, and empty days (or user can plan freely)
    const copiedYearSettings: Record<string, YearBudgetConfig> = {};
    for (const [k, v] of Object.entries(flushed.mainData.yearSettings)) {
      copiedYearSettings[k] = { ...v };
    }
    if (!copiedYearSettings[String(flushed.year)]) {
      copiedYearSettings[String(flushed.year)] = {
        allowance: flushed.allowance,
        carryOver: flushed.carryOver,
      };
    }

    const newPlan: PlanTab = {
      id,
      name,
      createdAt: new Date().toISOString(),
      days: {},
      customHolidays: { ...flushed.mainData.customHolidays },
      disabledPresetHolidays: [...flushed.mainData.disabledPresetHolidays],
      tripMeta: {},
      yearSettings: copiedYearSettings,
    };

    const withNewPlan: PlannerState = {
      ...flushed,
      plans: [...flushed.plans, newPlan],
    };
    return activateTabInState(withNewPlan, id);
  });

  return id;
}

export function duplicatePlanTab(
  sourceTabId: string = plannerState.value.activeTabId,
  customName?: string
): string {
  const s = plannerState.value;
  const nextNumber = s.plans.length + 1;
  const id = `plan-${Date.now()}-${nextNumber}`;

  commitState((prev) => {
    const flushed = syncTopLevelToActiveStorage(prev);
    const sourcePlan =
      sourceTabId === 'main'
        ? null
        : flushed.plans.find((p) => p.id === sourceTabId) || null;
    const sourceData = sourcePlan ?? flushed.mainData;

    const defaultName = sourcePlan
      ? `${sourcePlan.name} (Copy)`
      : `Plan ${nextNumber}`;
    const name = customName?.trim() || defaultName;

    const copiedDays: Record<string, DayEntry> = {};
    for (const [k, v] of Object.entries(sourceData.days)) {
      copiedDays[k] = { ...v };
    }

    const copiedCustomHolidays: Record<string, Holiday> = {};
    for (const [k, v] of Object.entries(sourceData.customHolidays)) {
      copiedCustomHolidays[k] = { ...v };
    }

    const copiedTripMeta: Record<string, TripMeta> = {};
    for (const [k, v] of Object.entries(sourceData.tripMeta)) {
      copiedTripMeta[k] = { ...v };
    }

    const copiedYearSettings: Record<string, YearBudgetConfig> = {};
    for (const [k, v] of Object.entries(sourceData.yearSettings)) {
      copiedYearSettings[k] = { ...v };
    }

    const newPlan: PlanTab = {
      id,
      name,
      createdAt: new Date().toISOString(),
      days: copiedDays,
      customHolidays: copiedCustomHolidays,
      disabledPresetHolidays: [...sourceData.disabledPresetHolidays],
      tripMeta: copiedTripMeta,
      yearSettings: copiedYearSettings,
    };

    const withNewPlan: PlannerState = {
      ...flushed,
      plans: [...flushed.plans, newPlan],
    };
    return activateTabInState(withNewPlan, id);
  });

  return id;
}

export function duplicatePlanTabFromMain(customName?: string): string {
  return duplicatePlanTab('main', customName);
}

export function renamePlanTab(planId: string, newName: string) {
  const trimmed = newName.trim();
  if (!trimmed) return;
  commitState((s) => ({
    ...s,
    plans: s.plans.map((p) => (p.id === planId ? { ...p, name: trimmed } : p)),
  }));
}

export function deletePlanTab(planId: string) {
  commitState((s) => {
    const flushed = syncTopLevelToActiveStorage(s);
    const remaining = flushed.plans.filter((p) => p.id !== planId);
    const nextTabId =
      flushed.activeTabId === planId ? 'main' : flushed.activeTabId;
    return activateTabInState(
      {
        ...flushed,
        plans: remaining,
      },
      nextTabId
    );
  });
}

/**
 * Computes the default overwrite interval `[startDate, endDate]` for a given PlanTab:
 * - If all planned days in the Plan fall within a single calendar year (or no days are planned yet),
 *   the default interval is that whole year: `YYYY-01-01` to `YYYY-12-31`.
 * - If planned days span across multiple years, the default interval is from the first planned date
 *   (`minDate`) to the last planned date (`maxDate`).
 */
export function getDefaultApplyInterval(
  planId: string,
  state = plannerState.value
): { startDate: string; endDate: string } {
  const flushed = syncTopLevelToActiveStorage(state);
  const plan = flushed.plans.find((p) => p.id === planId);
  if (!plan) {
    return {
      startDate: `${flushed.year}-01-01`,
      endDate: `${flushed.year}-12-31`,
    };
  }

  const plannedDates = Object.keys(plan.days).sort();
  if (plannedDates.length === 0) {
    return {
      startDate: `${flushed.year}-01-01`,
      endDate: `${flushed.year}-12-31`,
    };
  }

  const firstDate = plannedDates[0];
  const lastDate = plannedDates[plannedDates.length - 1];
  const firstYear = parseYMD(firstDate).year;
  const lastYear = parseYMD(lastDate).year;

  if (firstYear === lastYear) {
    return {
      startDate: `${firstYear}-01-01`,
      endDate: `${firstYear}-12-31`,
    };
  }

  return {
    startDate: firstDate,
    endDate: lastDate,
  };
}

/**
 * Inspects how many existing Main tab days & vacation intervals (trips) will be overwritten
 * within `[startDate, endDate]` when applying `planId` to Main.
 */
export function previewApplyPlanToMain(
  planId: string,
  startDate: string,
  endDate: string,
  state = plannerState.value
): ApplyIntervalPreview {
  const flushed = syncTopLevelToActiveStorage(state);
  const plan = flushed.plans.find((p) => p.id === planId);
  const start = startDate <= endDate ? startDate : endDate;
  const end = startDate <= endDate ? endDate : startDate;

  const mainDays = flushed.mainData.days;
  const overwrittenMainDates = Object.keys(mainDays)
    .filter((d) => d >= start && d <= end)
    .sort();

  const planDatesInInterval = plan
    ? Object.keys(plan.days)
        .filter((d) => d >= start && d <= end)
        .sort()
    : [];

  const startYear = parseYMD(start).year;
  const endYear = parseYMD(end).year;
  const affectedYears: number[] = [];
  for (let y = startYear; y <= endYear; y++) {
    affectedYears.push(y);
  }

  // Count contiguous vacation blocks in Main and in Plan that touch [start, end]
  let overwrittenMainTripsCount = 0;
  let planTripsInInterval = 0;

  for (const y of affectedYears) {
    const holidaysForY = generatePresetHolidays(y, flushed.countryPreset);
    const mainBlocks = computeVacationBlocks(
      y,
      mainDays,
      holidaysForY,
      flushed.workdays,
      flushed.mainData.tripMeta
    );
    for (const b of mainBlocks) {
      if (b.endDate >= start && b.startDate <= end) {
        overwrittenMainTripsCount++;
      }
    }

    if (plan) {
      const planBlocks = computeVacationBlocks(
        y,
        plan.days,
        holidaysForY,
        flushed.workdays,
        plan.tripMeta
      );
      for (const b of planBlocks) {
        if (b.endDate >= start && b.startDate <= end) {
          planTripsInInterval++;
        }
      }
    }
  }

  return {
    planId,
    planName: plan?.name || 'Plan',
    startDate: start,
    endDate: end,
    planDaysInInterval: planDatesInInterval.length,
    planTripsInInterval,
    overwrittenMainDaysCount: overwrittenMainDates.length,
    overwrittenMainTripsCount,
    overwrittenMainDates,
    affectedYears,
  };
}

/**
 * Applies `planId` onto `Main` within `[startDate, endDate]` (overwriting Main's days, customHolidays,
 * tripMeta, and yearSettings for affected years in that interval) and switches to the `Main` tab.
 * Fully undoable via `Cmd/Ctrl + Z`!
 */
export function applyPlanToMain(
  planId: string,
  startDate: string,
  endDate: string
) {
  const start = startDate <= endDate ? startDate : endDate;
  const end = startDate <= endDate ? endDate : startDate;

  commitState((prev) => {
    const flushed = syncTopLevelToActiveStorage(prev);
    const plan = flushed.plans.find((p) => p.id === planId);
    if (!plan) return prev;

    const nextMainDays = { ...flushed.mainData.days };
    // 1. Remove existing Main days inside [start, end]
    for (const d of Object.keys(nextMainDays)) {
      if (d >= start && d <= end) {
        delete nextMainDays[d];
      }
    }
    // 2. Copy Plan days inside [start, end] into Main
    for (const [d, entry] of Object.entries(plan.days)) {
      if (d >= start && d <= end) {
        nextMainDays[d] = { ...entry };
      }
    }

    // 3. Copy customHolidays inside [start, end]
    const nextMainCustomHolidays = { ...flushed.mainData.customHolidays };
    for (const d of Object.keys(nextMainCustomHolidays)) {
      if (d >= start && d <= end) {
        delete nextMainCustomHolidays[d];
      }
    }
    for (const [d, hol] of Object.entries(plan.customHolidays)) {
      if (d >= start && d <= end) {
        nextMainCustomHolidays[d] = { ...hol };
      }
    }

    // 4. Copy tripMeta inside [start, end]
    const nextMainTripMeta = { ...flushed.mainData.tripMeta };
    for (const d of Object.keys(nextMainTripMeta)) {
      if (d >= start && d <= end) {
        delete nextMainTripMeta[d];
      }
    }
    for (const [d, meta] of Object.entries(plan.tripMeta)) {
      if (d >= start && d <= end) {
        nextMainTripMeta[d] = { ...meta };
      }
    }

    // 5. Copy yearSettings for affected years
    const nextMainYearSettings = { ...flushed.mainData.yearSettings };
    const startYear = parseYMD(start).year;
    const endYear = parseYMD(end).year;
    for (let y = startYear; y <= endYear; y++) {
      const yKey = String(y);
      if (plan.yearSettings[yKey]) {
        nextMainYearSettings[yKey] = { ...plan.yearSettings[yKey] };
      }
    }

    const updatedState: PlannerState = {
      ...flushed,
      mainData: {
        ...flushed.mainData,
        days: nextMainDays,
        customHolidays: nextMainCustomHolidays,
        tripMeta: nextMainTripMeta,
        yearSettings: nextMainYearSettings,
      },
    };

    return activateTabInState(updatedState, 'main');
  });
}

// ==========================================
// OVERLAY & CALENDAR ACTIONS
// ==========================================

export function toggleOverlayEnabled(overlayId: string) {
  commitState((s) => {
    const current =
      s.overlayPrefs?.[overlayId] || createDefaultOverlayPrefs()[overlayId];
    if (!current) return s;
    return {
      ...s,
      overlayPrefs: {
        ...s.overlayPrefs,
        [overlayId]: {
          ...current,
          enabled: !current.enabled,
        },
      },
    };
  });
}

export function setOverlayColor(overlayId: string, color: string) {
  commitState((s) => {
    const current =
      s.overlayPrefs?.[overlayId] || createDefaultOverlayPrefs()[overlayId];
    if (!current) return s;
    return {
      ...s,
      overlayPrefs: {
        ...s.overlayPrefs,
        [overlayId]: {
          ...current,
          color,
        },
      },
    };
  });
}

export function setOverlayDisplayMode(
  overlayId: string,
  display: OverlayDisplayPriority
) {
  commitState((s) => {
    const current =
      s.overlayPrefs?.[overlayId] || createDefaultOverlayPrefs()[overlayId];
    if (!current) return s;
    return {
      ...s,
      overlayPrefs: {
        ...s.overlayPrefs,
        [overlayId]: {
          ...current,
          display,
        },
      },
    };
  });
}

export function toggleOverlayRegion(overlayId: string, regionName: string) {
  commitState((s) => {
    const current =
      s.overlayPrefs?.[overlayId] || createDefaultOverlayPrefs()[overlayId];
    if (!current) return s;
    const disabled = new Set(current.disabledRegions || []);
    if (disabled.has(regionName)) {
      disabled.delete(regionName);
    } else {
      disabled.add(regionName);
    }
    return {
      ...s,
      overlayPrefs: {
        ...s.overlayPrefs,
        [overlayId]: {
          ...current,
          disabledRegions: Array.from(disabled),
        },
      },
    };
  });
}

export function setYear(year: number) {
  commitState((s) => {
    const existingForTarget = s.yearSettings?.[String(year)];
    const targetConfig = existingForTarget || {
      allowance: s.allowance,
      carryOver: 0,
    };
    return {
      ...s,
      year,
      allowance: targetConfig.allowance,
      carryOver: targetConfig.carryOver,
      yearSettings: {
        ...s.yearSettings,
        [String(year)]: targetConfig,
      },
    };
  });
}

export function setAllowance(allowance: number) {
  const clean = Math.max(0, allowance);
  commitState((s) => {
    const yKey = String(s.year);
    const currentYearCfg = s.yearSettings?.[yKey] || {
      allowance: s.allowance,
      carryOver: s.carryOver,
    };
    return {
      ...s,
      allowance: clean,
      yearSettings: {
        ...s.yearSettings,
        [yKey]: {
          ...currentYearCfg,
          allowance: clean,
        },
      },
    };
  });
}

export function setCarryOver(carryOver: number) {
  commitState((s) => {
    const yKey = String(s.year);
    const currentYearCfg = s.yearSettings?.[yKey] || {
      allowance: s.allowance,
      carryOver: s.carryOver,
    };
    return {
      ...s,
      carryOver,
      yearSettings: {
        ...s.yearSettings,
        [yKey]: {
          ...currentYearCfg,
          carryOver,
        },
      },
    };
  });
}

export function setCountryPreset(countryPreset: string) {
  commitState((s) => ({
    ...s,
    countryPreset,
    disabledPresetHolidays: [],
  }));
}

export function toggleWeekStart() {
  commitState((s) => ({
    ...s,
    weekStartsOnMonday: !s.weekStartsOnMonday,
  }));
}

export function applyBrushToDates(
  dates: string[],
  brush: BrushMode,
  customHolidayName?: string
) {
  if (dates.length === 0) return;

  commitState((s) => {
    const nextDays = { ...s.days };
    const nextCustomHolidays = { ...s.customHolidays };
    const nextDisabled = new Set(s.disabledPresetHolidays);
    const presets = generatePresetHolidays(s.year, s.countryPreset);

    for (const ymd of dates) {
      if (brush === 'erase') {
        delete nextDays[ymd];
        if (nextCustomHolidays[ymd]) {
          delete nextCustomHolidays[ymd];
        }
      } else if (brush === 'holiday') {
        const isPresetActive = Boolean(presets[ymd]) && !nextDisabled.has(ymd);
        const isCustomActive = Boolean(nextCustomHolidays[ymd]);

        if (isCustomActive) {
          delete nextCustomHolidays[ymd];
        } else if (isPresetActive) {
          nextDisabled.add(ymd);
        } else if (presets[ymd] && nextDisabled.has(ymd)) {
          nextDisabled.delete(ymd);
        } else {
          nextCustomHolidays[ymd] = {
            date: ymd,
            name: customHolidayName || 'Custom Holiday',
            source: 'custom',
          };
        }
      } else {
        const existing = nextDays[ymd];
        if (dates.length === 1 && existing?.status === brush) {
          delete nextDays[ymd];
        } else {
          nextDays[ymd] = {
            ...existing,
            date: ymd,
            status: brush,
          };
        }
      }
    }

    return {
      ...s,
      days: nextDays,
      customHolidays: nextCustomHolidays,
      disabledPresetHolidays: Array.from(nextDisabled),
    };
  });
}

export function setDayNote(ymd: string, note: string) {
  commitState((s) => {
    const existing = s.days[ymd];
    if (!existing) return s;
    return {
      ...s,
      days: {
        ...s.days,
        [ymd]: {
          ...existing,
          note: note.trim() ? note : undefined,
        },
      },
    };
  });
}

export function updateTripMetadata(
  blockStartDate: string,
  updates: { name?: string; color?: string; notes?: string }
) {
  commitState((s) => {
    const existing = s.tripMeta[blockStartDate] || {
      id: blockStartDate,
      name: '',
      color: TRIP_COLORS[0],
    };
    return {
      ...s,
      tripMeta: {
        ...s.tripMeta,
        [blockStartDate]: {
          ...existing,
          ...updates,
        },
      },
    };
  });
}

export function promoteDraftBlockToConfirmed(dates: string[]) {
  commitState((s) => {
    const nextDays = { ...s.days };
    for (const d of dates) {
      const entry = nextDays[d];
      if (!entry) continue;
      if (entry.status === 'draft') {
        nextDays[d] = { ...entry, status: 'confirmed' };
      } else if (entry.status === 'half-draft') {
        nextDays[d] = { ...entry, status: 'half-confirmed' };
      }
    }
    return { ...s, days: nextDays };
  });
}

export function demoteBlockToDraft(dates: string[]) {
  commitState((s) => {
    const nextDays = { ...s.days };
    for (const d of dates) {
      const entry = nextDays[d];
      if (!entry) continue;
      if (entry.status === 'confirmed') {
        nextDays[d] = { ...entry, status: 'draft' };
      } else if (entry.status === 'half-confirmed') {
        nextDays[d] = { ...entry, status: 'half-draft' };
      }
    }
    return { ...s, days: nextDays };
  });
}

export function removeBlockPtoDays(dates: string[]) {
  commitState((s) => {
    const nextDays = { ...s.days };
    for (const d of dates) {
      delete nextDays[d];
    }
    return { ...s, days: nextDays };
  });
}

export function clearAllPlansForYear() {
  commitState((s) => {
    const nextDays = { ...s.days };
    for (const k of Object.keys(nextDays)) {
      if (k.startsWith(`${s.year}-`)) {
        delete nextDays[k];
      }
    }
    return { ...s, days: nextDays };
  });
}

export function importStateFromJson(jsonString: string): {
  ok: boolean;
  error?: string;
} {
  try {
    const parsed = JSON.parse(jsonString);
    const sanitized = sanitizeImportedState(parsed);
    commitState(() => sanitized);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Invalid JSON file',
    };
  }
}

export function exportStateAsJson(): string {
  const synced = syncTopLevelToActiveStorage(plannerState.value);
  return plannerRepository.exportJson(synced);
}

const ZOOM_ORDER: ZoomLevel[] = [
  'year-linear',
  'year-grid',
  '6-months',
  'quarter',
  'month',
];

export function zoomIn() {
  const idx = ZOOM_ORDER.indexOf(zoomLevel.value);
  if (idx < ZOOM_ORDER.length - 1) {
    zoomLevel.value = ZOOM_ORDER[idx + 1];
  }
}

export function zoomOut() {
  const idx = ZOOM_ORDER.indexOf(zoomLevel.value);
  if (idx > 0) {
    zoomLevel.value = ZOOM_ORDER[idx - 1];
  }
}
