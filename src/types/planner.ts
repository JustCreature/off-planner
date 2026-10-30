export type DayStatus = 'confirmed' | 'draft' | 'half-confirmed' | 'half-draft';

export type BrushMode =
  | 'confirmed'
  | 'draft'
  | 'half-confirmed'
  | 'half-draft'
  | 'holiday'
  | 'erase';

export type ZoomLevel = 'year-grid' | 'year-linear' | '6-months' | 'quarter' | 'month';

export type OverlayTemplateType = 'generic' | 'surfing' | 'diving';
export type OverlayDisplayPriority = 'primary' | 'secondary';
export type ConditionQuality = 'good' | 'shoulder' | 'bad';

export interface OverlayDateSpan {
  start: string; // "YYYY-MM-DD" or recurring "MM-DD"
  end: string; // "YYYY-MM-DD" or recurring "MM-DD"
  label: string;
  region?: string; // e.g., "Bayern", "Tirol / Salzburg / Vorarlberg"
  display?: OverlayDisplayPriority;
  color?: string;
  description?: string;

  // Surfing & Diving dedicated fields
  quality?: ConditionQuality; // 'good' (green icon), 'shoulder' (amber icon), 'bad' (red icon)
  avgWaveHeight?: string; // e.g. "4–7 ft"
  waterTemp?: string; // e.g. "27–29°C"
  wind?: string; // e.g. "All-day offshore (Papagayo)"
  visibility?: string; // e.g. "15–25m" (for diving)
  currents?: string; // e.g. "Mild" (for diving)
  recommendedLevel?: string; // e.g. "Intermediate – Advanced"
}

export interface OverlayConfigFile {
  id: string;
  name: string;
  template: OverlayTemplateType; // 'generic' | 'surfing' | 'diving'
  defaultEnabled?: boolean;
  defaultDisplay: OverlayDisplayPriority; // 'primary' | 'secondary'
  color: string;
  description?: string;
  location?: string;
  ranges: OverlayDateSpan[];
}

export interface OverlayUserPref {
  enabled: boolean;
  color: string;
  display: OverlayDisplayPriority;
  disabledRegions?: string[]; // Optional sub-region filter (e.g. toggle specific Austrian/Bavarian lands)
}

export interface ResolvedDayOverlay {
  overlayId: string;
  overlayName: string;
  template: OverlayTemplateType;
  display: OverlayDisplayPriority;
  color: string;
  span: OverlayDateSpan;
}

export interface DayEntry {
  date: string; // "YYYY-MM-DD"
  status: DayStatus;
  tripId?: string;
  note?: string;
}

export interface TripMetadata {
  id: string; // e.g., keyed by block start date or custom id
  name: string;
  color: string;
  notes?: string;
}

export interface Holiday {
  date: string; // "YYYY-MM-DD"
  name: string;
  source: 'preset' | 'custom';
}

export interface YearBudgetConfig {
  allowance: number;
  carryOver: number;
}

export interface PlanTab {
  id: string; // e.g., 'plan-1'
  name: string; // e.g., 'Plan 1'
  createdAt: string;
  days: Record<string, DayEntry>;
  customHolidays: Record<string, Holiday>;
  disabledPresetHolidays: string[];
  tripMeta: Record<string, TripMetadata>;
  yearSettings: Record<string, YearBudgetConfig>;
}

export interface ApplyIntervalPreview {
  planId: string;
  planName: string;
  startDate: string; // "YYYY-MM-DD"
  endDate: string; // "YYYY-MM-DD"
  planDaysInInterval: number;
  planTripsInInterval: number;
  overwrittenMainDaysCount: number;
  overwrittenMainTripsCount: number;
  overwrittenMainDates: string[];
  affectedYears: number[];
}

export interface PlannerState {
  version: 1;
  year: number;
  allowance: number; // Active tab + year's allowance
  carryOver: number; // Active tab + year's carryOver
  yearSettings: Record<string, YearBudgetConfig>; // Active tab's yearSettings (synced with main or active plan)
  showOverlays: boolean; // Global master toggle to show/hide overlay rendering without losing individual layer selections
  overlayPrefs: Record<string, OverlayUserPref>; // Keyed by overlay id
  workdays: number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat. Default [1,2,3,4,5]
  weekStartsOnMonday: boolean;
  countryPreset: string; // e.g. 'DE-BE', 'DE-BY', 'US', 'UK', etc.
  days: Record<string, DayEntry>; // Active tab's days (synced with mainData or plans[activeTabId])
  customHolidays: Record<string, Holiday>; // Active tab's customHolidays
  disabledPresetHolidays: string[]; // Active tab's disabledPresetHolidays
  tripMeta: Record<string, TripMetadata>; // Active tab's tripMeta

  // Multi-Tab Workspace fields
  activeTabId: string; // 'main' or plan.id
  mainData: {
    days: Record<string, DayEntry>;
    customHolidays: Record<string, Holiday>;
    disabledPresetHolidays: string[];
    tripMeta: Record<string, TripMetadata>;
    yearSettings: Record<string, YearBudgetConfig>;
  };
  plans: PlanTab[];
}

export interface VacationBlock {
  id: string; // startDate
  startDate: string;
  endDate: string;
  totalDays: number; // Including adjacent weekends & holidays
  ptoDays: number; // Actual PTO days spent (confirmed + draft)
  confirmedPtoDays: number;
  draftPtoDays: number;
  weekendDays: number;
  holidayDays: number;
  efficiency: number; // totalDays / ptoDays
  isAllDraft: boolean;
  isMixed: boolean;
  dates: string[];
  name: string;
  note: string;
  color: string;
}

export interface BridgeOpportunity {
  id: string;
  title: string;
  ptoDates: string[]; // Dates user needs to take off
  blockStart: string;
  blockEnd: string;
  ptoCost: number;
  totalDaysOff: number;
  efficiency: number;
  holidayNames: string[];
}
