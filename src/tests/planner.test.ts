import { describe, it, expect } from 'vitest';
import {
  computeVacationBlocks,
  findBridgeOpportunities,
  getDatesBetween,
  getDayPtoCost,
} from '../lib/dateUtils';
import {
  generatePresetHolidays,
  getBussUndBettag,
  getEasterSunday,
} from '../lib/holidays';
import {
  OVERLAY_CONFIGS,
  computeActiveDayOverlays,
  expandSpanForYear,
} from '../lib/overlays';
import {
  activeDayOverlays,
  applyBrushToDates,
  applyPlanToMain,
  createDefaultState,
  createPlanTab,
  duplicatePlanTab,
  exportStateAsJson,
  getDefaultApplyInterval,
  importStateFromJson,
  plannerRepository,
  plannerState,
  previewApplyPlanToMain,
  redo,
  renamePlanTab,
  sanitizeImportedState,
  setAllowance,
  setCarryOver,
  setYear,
  switchTab,
  toggleOverlayEnabled,
  toggleShowOverlays,
  undo,
} from '../store/plannerStore';
import type { DayEntry } from '../types/planner';

describe('Berlin (DE-BE) & German Bundesländer Holidays Verification', () => {
  it('defaults to DE-BE (Berlin) in createDefaultState and upgrades legacy DE preset', () => {
    const def = createDefaultState(2026);
    expect(def.countryPreset).toBe('DE-BE');

    const upgraded = sanitizeImportedState({ countryPreset: 'DE' });
    expect(upgraded.countryPreset).toBe('DE-BE');
  });

  it('computes Easter Sunday accurately for 2025, 2026, 2027, 2028', () => {
    expect(getEasterSunday(2025)).toEqual({ month: 4, day: 20 });
    expect(getEasterSunday(2026)).toEqual({ month: 4, day: 5 });
    expect(getEasterSunday(2027)).toEqual({ month: 3, day: 28 });
    expect(getEasterSunday(2028)).toEqual({ month: 4, day: 16 });
  });

  it('generates the exact 10 statutory public holidays for Berlin in 2026', () => {
    const berlin2026 = generatePresetHolidays(2026, 'DE-BE');
    const dates = Object.keys(berlin2026).sort();

    expect(dates).toEqual([
      '2026-01-01', // Neujahr
      '2026-03-08', // Internationaler Frauentag (Berlin statutory holiday!)
      '2026-04-03', // Karfreitag
      '2026-04-06', // Ostermontag
      '2026-05-01', // Tag der Arbeit
      '2026-05-14', // Christi Himmelfahrt
      '2026-05-25', // Pfingstmontag
      '2026-10-03', // Tag der Deutschen Einheit
      '2026-12-25', // 1. Weihnachtstag
      '2026-12-26', // 2. Weihnachtstag
    ]);

    // Verify holidays from other states are NOT in Berlin
    expect(berlin2026['2026-01-06']).toBeUndefined(); // Heilige Drei Könige
    expect(berlin2026['2026-06-04']).toBeUndefined(); // Fronleichnam
    expect(berlin2026['2026-08-15']).toBeUndefined(); // Mariä Himmelfahrt
    expect(berlin2026['2026-10-31']).toBeUndefined(); // Reformationstag (Brandenburg, not Berlin)
    expect(berlin2026['2026-11-01']).toBeUndefined(); // Allerheiligen
  });

  it('includes Berlin one-off statutory holidays in 2025 (8 May) and 2028 (17 June)', () => {
    const berlin2025 = generatePresetHolidays(2025, 'DE-BE');
    expect(berlin2025['2025-05-08']).toBeDefined();
    expect(berlin2025['2025-05-08'].name).toContain('Tag der Befreiung');
    expect(Object.keys(berlin2025).length).toBe(11);

    const berlin2028 = generatePresetHolidays(2028, 'DE-BE');
    expect(berlin2028['2028-06-17']).toBeDefined();
    expect(berlin2028['2028-06-17'].name).toContain('17. Juni');
    expect(Object.keys(berlin2028).length).toBe(11);
  });

  it('supports other Bundesländer like Brandenburg (DE-BB), Bavaria (DE-BY), and Saxony (DE-SN)', () => {
    const bb2026 = generatePresetHolidays(2026, 'DE-BB');
    expect(bb2026['2026-10-31']).toBeDefined(); // Reformationstag in Brandenburg
    expect(bb2026['2026-03-08']).toBeUndefined(); // Frauentag not in Brandenburg

    const by2026 = generatePresetHolidays(2026, 'DE-BY');
    expect(by2026['2026-01-06']).toBeDefined(); // Heilige Drei Könige
    expect(by2026['2026-06-04']).toBeDefined(); // Fronleichnam
    expect(by2026['2026-11-01']).toBeDefined(); // Allerheiligen

    const sn2026 = generatePresetHolidays(2026, 'DE-SN');
    expect(getBussUndBettag(2026)).toBe('2026-11-18');
    expect(sn2026['2026-11-18']).toBeDefined(); // Buß- und Bettag in Saxony
  });
});

describe('PTO Cost & Contiguous Vacation Block Detection', () => {
  const workdays = [1, 2, 3, 4, 5]; // Mon-Fri
  const holidays = generatePresetHolidays(2026, 'DE-BE');

  it('excludes weekends and public holidays from PTO cost', () => {
    const days: Record<string, DayEntry> = {
      '2026-05-01': { date: '2026-05-01', status: 'confirmed' }, // Friday (Tag der Arbeit)
      '2026-05-02': { date: '2026-05-02', status: 'confirmed' }, // Saturday
      '2026-05-04': { date: '2026-05-04', status: 'confirmed' }, // Monday (regular workday)
      '2026-05-05': { date: '2026-05-05', status: 'half-draft' }, // Tuesday (half draft)
    };

    expect(getDayPtoCost('2026-05-01', days, holidays, workdays)).toEqual({
      confirmed: 0,
      draft: 0,
      total: 0,
    });
    expect(getDayPtoCost('2026-05-02', days, holidays, workdays)).toEqual({
      confirmed: 0,
      draft: 0,
      total: 0,
    });
    expect(getDayPtoCost('2026-05-04', days, holidays, workdays)).toEqual({
      confirmed: 1,
      draft: 0,
      total: 1,
    });
    expect(getDayPtoCost('2026-05-05', days, holidays, workdays)).toEqual({
      confirmed: 0,
      draft: 0.5,
      total: 0.5,
    });
  });

  it('merges adjacent holidays and weekends into a single VacationBlock', () => {
    // Christi Himmelfahrt 2026 is Thursday 2026-05-14. Taking Friday 2026-05-15 off gives 4 days off (Thu-Sun).
    const days: Record<string, DayEntry> = {
      '2026-05-15': { date: '2026-05-15', status: 'confirmed' },
    };

    const blocks = computeVacationBlocks(2026, days, holidays, workdays, {});
    expect(blocks.length).toBe(1);
    expect(blocks[0].startDate).toBe('2026-05-14');
    expect(blocks[0].endDate).toBe('2026-05-17');
    expect(blocks[0].ptoDays).toBe(1);
    expect(blocks[0].totalDays).toBe(4);
    expect(blocks[0].efficiency).toBe(4);
  });

  it('detects smart bridge-day opportunities', () => {
    const bridges = findBridgeOpportunities(2026, holidays, workdays);
    // 2026-05-15 (Friday after Christi Himmelfahrt) should be detected as a 4x bridge
    const ascensionBridge = bridges.find((b) => b.ptoDates.includes('2026-05-15'));
    expect(ascensionBridge).toBeDefined();
    expect(ascensionBridge?.ptoCost).toBe(1);
    expect(ascensionBridge?.totalDaysOff).toBe(4);
  });
});

describe('Date Range & Per-Year Allowance / Carryover JSON Persistence', () => {
  it('expands date ranges in either direction', () => {
    const forward = getDatesBetween('2026-06-01', '2026-06-03');
    const backward = getDatesBetween('2026-06-03', '2026-06-01');
    expect(forward).toEqual(['2026-06-01', '2026-06-02', '2026-06-03']);
    expect(backward).toEqual(forward);
  });

  it('preserves independent allowance and carryOver for each year and exports/imports them in JSON', () => {
    plannerState.value = createDefaultState(2026);
    setAllowance(28);
    setCarryOver(4);

    // Switch to 2027 and configure different allowance & carryover
    setYear(2027);
    expect(plannerState.value.allowance).toBe(28); // inherits previous year's base allowance by default
    expect(plannerState.value.carryOver).toBe(0); // carryover starts at 0 for a new year

    setAllowance(30);
    setCarryOver(2);

    // Switch back to 2026 -> should restore 2026's 28 allowance & 4 carryover
    setYear(2026);
    expect(plannerState.value.allowance).toBe(28);
    expect(plannerState.value.carryOver).toBe(4);

    // Export to JSON and re-import
    const exportedJson = exportStateAsJson();
    const parsed = JSON.parse(exportedJson);
    expect(parsed.yearSettings['2026']).toEqual({ allowance: 28, carryOver: 4 });
    expect(parsed.yearSettings['2027']).toEqual({ allowance: 30, carryOver: 2 });

    // Reset state and import JSON
    plannerState.value = createDefaultState(2025);
    const res = importStateFromJson(exportedJson);
    expect(res.ok).toBe(true);
    expect(plannerState.value.year).toBe(2026);
    expect(plannerState.value.allowance).toBe(28);
    expect(plannerState.value.carryOver).toBe(4);

    setYear(2027);
    expect(plannerState.value.allowance).toBe(30);
    expect(plannerState.value.carryOver).toBe(2);
  });
});

describe('YAML Overlays & Seasonal Templates (School Holidays, Surfing, Diving)', () => {
  it('loads all 3 YAML overlay configurations from src/data/overlays/*.yaml', () => {
    const ids = OVERLAY_CONFIGS.map((c) => c.id);
    expect(ids).toContain('school-holidays-bavaria-austria');
    expect(ids).toContain('surfing-nicaragua');
    expect(ids).toContain('diving-nicaragua');
  });

  it('expands recurring MM-DD spans and cross-year spans accurately', () => {
    const surfPrime = expandSpanForYear(
      { start: '04-01', end: '04-03', label: 'Prime' },
      2026
    );
    expect(surfPrime).toEqual(['2026-04-01', '2026-04-02', '2026-04-03']);

    const wrapWinter = expandSpanForYear(
      { start: '12-30', end: '01-02', label: 'Wrap' },
      2026
    );
    expect(wrapWinter).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-12-30',
      '2026-12-31',
    ]);
  });

  it('starts with all overlays switched off by default, supports master display hide/show without losing enabled layers, and resolves surfing/school telemetry', () => {
    plannerState.value = createDefaultState(2026);

    // All overlays start switched off by default
    expect(plannerState.value.overlayPrefs['school-holidays-bavaria-austria'].enabled).toBe(false);
    expect(plannerState.value.overlayPrefs['surfing-nicaragua'].enabled).toBe(false);
    expect(plannerState.value.overlayPrefs['diving-nicaragua'].enabled).toBe(false);
    expect(Object.keys(activeDayOverlays.value).length).toBe(0);

    // Enable 2 overlays: Surfing and School Holidays
    toggleOverlayEnabled('surfing-nicaragua');
    toggleOverlayEnabled('school-holidays-bavaria-austria');

    // Verify they are displayed
    expect(activeDayOverlays.value['2026-05-15']?.some((o) => o.overlayId === 'surfing-nicaragua')).toBe(true);
    expect(activeDayOverlays.value['2026-02-17']?.some((o) => o.overlayId === 'school-holidays-bavaria-austria')).toBe(true);

    // Temporarily disable master overlay display -> nothing displayed, but layer selections stay enabled
    toggleShowOverlays();
    expect(plannerState.value.showOverlays).toBe(false);
    expect(Object.keys(activeDayOverlays.value).length).toBe(0);
    expect(plannerState.value.overlayPrefs['surfing-nicaragua'].enabled).toBe(true);
    expect(plannerState.value.overlayPrefs['school-holidays-bavaria-austria'].enabled).toBe(true);

    // While master display is disabled, toggle Diving ON and School Holidays OFF
    toggleOverlayEnabled('diving-nicaragua');
    toggleOverlayEnabled('school-holidays-bavaria-austria');
    // Still nothing displayed while master display is off
    expect(Object.keys(activeDayOverlays.value).length).toBe(0);

    // Re-enable master display -> Surfing and Diving are now displayed, School Holidays is off!
    toggleShowOverlays();
    expect(plannerState.value.showOverlays).toBe(true);
    const may15 = activeDayOverlays.value['2026-05-15'] || [];
    const surf = may15.find((o) => o.overlayId === 'surfing-nicaragua');
    const dive = may15.find((o) => o.overlayId === 'diving-nicaragua');
    expect(surf).toBeDefined();
    expect(surf?.span.quality).toBe('good');
    expect(surf?.span.avgWaveHeight).toContain('4–8 ft');
    expect(surf?.span.waterTemp).toBe('27–29°C');
    expect(surf?.span.recommendedLevel).toBe('Intermediate – Advanced');
    expect(dive).toBeDefined();
    expect(activeDayOverlays.value['2026-02-17']?.some((o) => o.overlayId === 'school-holidays-bavaria-austria')).toBe(false);
  });
});

describe('Scenario Plan Tabs, Apply to Main Interval Rules & Undo/Redo', () => {
  it('creates Plan tabs, computes single-year vs multi-year default intervals, previews overwrites, applies to Main, and undoes/redoes', () => {
    plannerState.value = createDefaultState(2026);

    // Paint 2 days in Main in 2026
    applyBrushToDates(['2026-05-04', '2026-05-05'], 'confirmed');
    expect(Object.keys(plannerState.value.days).length).toBe(2);

    // Create Plan 1 and rename it
    const plan1Id = createPlanTab();
    expect(plannerState.value.activeTabId).toBe(plan1Id);
    expect(Object.keys(plannerState.value.days).length).toBe(0);
    renamePlanTab(plan1Id, 'Snowboard & Surf Plan');

    // Add vacations only within 2026 -> default interval should be full year 2026
    applyBrushToDates(['2026-07-06', '2026-07-07', '2026-07-08'], 'confirmed');
    const singleYearInterval = getDefaultApplyInterval(plan1Id);
    expect(singleYearInterval).toEqual({
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });

    // Preview overwrite impact on Main for 2026
    const preview = previewApplyPlanToMain(
      plan1Id,
      singleYearInterval.startDate,
      singleYearInterval.endDate
    );
    expect(preview.overwrittenMainDaysCount).toBe(2);
    expect(preview.overwrittenMainTripsCount).toBe(1);
    expect(preview.planDaysInInterval).toBe(3);
    expect(preview.planTripsInInterval).toBe(1);

    // Add a 2027 date in Plan 1 -> default interval should now span from first day to last day across years
    applyBrushToDates(['2027-02-10'], 'draft');
    const multiYearInterval = getDefaultApplyInterval(plan1Id);
    expect(multiYearInterval).toEqual({
      startDate: '2026-07-06',
      endDate: '2027-02-10',
    });

    // Apply Plan 1 to Main over the whole 2026 year
    applyPlanToMain(plan1Id, '2026-01-01', '2026-12-31');
    expect(plannerState.value.activeTabId).toBe('main');
    expect(Object.keys(plannerState.value.days).sort()).toEqual([
      '2026-07-06',
      '2026-07-07',
      '2026-07-08',
    ]);

    // Undo the applyPlanToMain operation -> restores Main's original May dates and returns to Plan 1!
    undo();
    expect(plannerState.value.activeTabId).toBe(plan1Id);
    expect(Object.keys(plannerState.value.mainData.days).sort()).toEqual([
      '2026-05-04',
      '2026-05-05',
    ]);

    // Redo the applyPlanToMain operation -> re-applies Plan 1 onto Main!
    redo();
    expect(plannerState.value.activeTabId).toBe('main');
    expect(Object.keys(plannerState.value.days).sort()).toEqual([
      '2026-07-06',
      '2026-07-07',
      '2026-07-08',
    ]);
  });

  it('clones any Plan tab (not only Main) with isolated deep-copied dates and settings', () => {
    plannerState.value = createDefaultState(2026);
    const plan1Id = createPlanTab('Winter Trip');
    applyBrushToDates(['2026-01-12', '2026-01-13'], 'confirmed');
    setAllowance(32);

    // Clone Plan 1 directly
    const clonedPlanId = duplicatePlanTab(plan1Id);
    expect(plannerState.value.activeTabId).toBe(clonedPlanId);
    const clonedPlan = plannerState.value.plans.find((p) => p.id === clonedPlanId);
    expect(clonedPlan?.name).toBe('Winter Trip (Copy)');
    expect(Object.keys(plannerState.value.days).sort()).toEqual([
      '2026-01-12',
      '2026-01-13',
    ]);
    expect(plannerState.value.allowance).toBe(32);

    // Modifying the cloned plan does not mutate the source plan
    applyBrushToDates(['2026-01-14'], 'draft');
    switchTab(plan1Id);
    expect(Object.keys(plannerState.value.days).sort()).toEqual([
      '2026-01-12',
      '2026-01-13',
    ]);
  });

  it('persists state in LocalStoragePlannerRepository across reloads', async () => {
    const mockStorage: Record<string, string> = {};
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: {
        getItem: (k: string) => mockStorage[k] ?? null,
        setItem: (k: string, v: string) => {
          mockStorage[k] = v;
        },
      },
    };

    plannerState.value = createDefaultState(2026);
    applyBrushToDates(['2026-08-10', '2026-08-11'], 'confirmed');
    const savedRaw = mockStorage['off-planner-state-v1'];
    expect(savedRaw).toBeDefined();

    const reloaded = await plannerRepository.getState();
    expect(Object.keys(reloaded.days).sort()).toEqual(['2026-08-10', '2026-08-11']);

    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it('never hardcodes any personal planned days, trips, custom holidays, or scenario plans in default state', () => {
    const fresh = createDefaultState(2026);
    expect(Object.keys(fresh.days)).toHaveLength(0);
    expect(Object.keys(fresh.tripMeta)).toHaveLength(0);
    expect(Object.keys(fresh.customHolidays)).toHaveLength(0);
    expect(fresh.disabledPresetHolidays).toHaveLength(0);
    expect(Object.keys(fresh.mainData.days)).toHaveLength(0);
    expect(Object.keys(fresh.mainData.tripMeta)).toHaveLength(0);
    expect(Object.keys(fresh.mainData.customHolidays)).toHaveLength(0);
    expect(fresh.plans).toHaveLength(0);
  });
});
