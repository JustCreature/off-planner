# AGENTS.md — Off-Planner Developer & AI Agent Guide

## ⚠️ CRITICAL INVARIANT #1: Data Preservation Across Page Reloads
**User data MUST ALWAYS be preserved across page reloads, tab closures, and browser restarts.**
- Never replace `localStorage` persistence with a volatile-only store unless a real persistent backend database is actively connected and verified.
- Every state mutation (`commitState`, `undo`, `redo`, JSON import, tab creation/application, year budget edits, overlay preferences) MUST immediately persist to `localStorage` via `LocalStoragePlannerRepository` (`STORAGE_KEY = 'off-planner-state-v1'`) in [`src/services/plannerRepository.ts`](file:///Users/nikitazavartsev/prog_projects/off-planner/src/services/plannerRepository.ts).
- **SSR Hydration Rule**: Because Astro renders `<PlannerApp client:load />` on the server first where `window` is `undefined`, `plannerState` starts with `createDefaultState()` during SSR/initial VDOM hydration and immediately loads the saved state inside `initStoreFromStorage()` on client mount (`useEffect`). While `isHydrated.value === false`, `PlannerApp.tsx` renders a blocking loading modal with a spinner so the user never sees a flash of empty/unhydrated calendar state. Do NOT overwrite `localStorage` before `isHydrated.value === true`!

## 🔒 CRITICAL INVARIANT #2: Personal Data Privacy & GitHub Safety
**User's personal planned days, trips, notes, and scenario plans MUST NEVER be hardcoded in source files or committed/published to the GitHub repository.**
- `createDefaultState()` in [`src/store/plannerStore.ts`](file:///Users/nikitazavartsev/prog_projects/off-planner/src/store/plannerStore.ts) MUST always initialize with completely empty personal collections (`days: {}`, `tripMeta: {}`, `customHolidays: {}`, `disabledPresetHolidays: []`, `plans: []`).
- Personal vacation data must exist **only** in the user's local browser storage (`localStorage`) or in local exported JSON backup files (which are excluded from Git via `.gitignore`: `off-planner-*.json`, `*.local.json`, `*.personal.json`, `backups/`, etc.).
- Never commit exported user JSON files, personal dates, or private trip notes to Git. Only public/generic reference data (statutory holidays in `src/lib/holidays.ts` and public seasonal/school-holiday overlays in `src/data/overlays/*.yaml`) may be tracked in the repository.

---

## Project Structure

```text
off-planner/
├── .github/
│   └── workflows/
│       └── ci.yml                   # GitHub Actions CI (Vitest + Astro build + Playwright Chrome E2E)
├── AGENTS.md                        # AI Agent instructions, invariants & project architecture
├── README.md                        # User & setup documentation (including YAML overlay guide)
├── astro.config.mjs                 # Astro 5 + Preact + Tailwind CSS v4 Vite config
├── playwright.config.ts             # Playwright Chrome (Chromium) E2E configuration
├── package.json                     # Scripts (dev, build, preview, test, test:e2e) & dependencies
├── tsconfig.json                    # Strict TypeScript config for Astro + Preact
├── public/
│   └── favicon.svg                  # App icon
├── tests/
│   └── e2e/
│       └── planner.spec.ts          # Comprehensive Playwright Chrome UI E2E test suite
└── src/
    ├── pages/
    │   └── index.astro              # Main Astro shell mounting <PlannerApp client:load />
    ├── styles/
    │   └── global.css               # Tailwind CSS v4 import & custom utility classes (.bg-stripes)
    ├── types/
    │   └── planner.ts               # Core TypeScript types, JSON schema, Tabs & YAML Overlay types
    ├── services/
    │   └── plannerRepository.ts     # Async repository interface + LocalStoragePlannerRepository
    ├── store/
    │   └── plannerStore.ts          # @preact/signals reactive state, Undo/Redo stack, Tab & PTO logic
    ├── lib/
    │   ├── dateUtils.ts             # Pure date math, contiguous VacationBlock & Bridge-day detector
    │   ├── holidays.ts              # Statutory public holidays (Berlin DE-BE default + 16 Bundesländer)
    │   └── overlays.ts              # Build-time YAML loader & recurring/specific date span expander
    ├── data/
    │   └── overlays/                # Drop-in YAML seasonal/holiday overlay files
    │       ├── school-holidays-bavaria-austria.yaml
    │       ├── surfing-nicaragua.yaml
    │       └── diving-nicaragua.yaml
    ├── components/
    │   ├── PlannerApp.tsx           # Root Preact island (drag-selection, keyboard shortcuts, layout)
    │   ├── TopBar.tsx               # Year/period nav, per-year PTO budget bar, Zoom & JSON I/O
    │   ├── PlanTabsBar.tsx          # Multi-tab bar (Main + Plan 1, Plan 2...) & Apply-to-Main modal
    │   ├── BrushToolbar.tsx         # Paint mode selector (Confirmed, Draft, Half-day, Holiday, Erase)
    │   ├── OverlaysPanel.tsx        # Collapsible left panel for YAML overlays & Master visibility toggle
    │   ├── CalendarGrid.tsx         # Multi-zoom calendar grid (12M, 6M, 3M, 1M) with multi-icon cells
    │   ├── LinearYearView.tsx       # 12×31 full-year horizontal timeline matrix view
    │   ├── TripsSidebar.tsx         # Right sidebar (My Trips, Bridge Hacks, Feiertage verification list)
    │   └── DayTooltip.tsx           # 400ms delayed, interactive, scrollable floating day popover
    └── tests/
        └── planner.test.ts          # Vitest suite covering holidays, PTO math, YAML overlays & tabs
```

---

## Core Architectural Rules & Domain Requirements

### 1. Public Holidays & Bundesländer (`src/lib/holidays.ts`)
- **Berlin (`DE-BE`) is the primary default preset.**
- Berlin has **10 regular statutory holidays** (*Neujahr, Internationaler Frauentag on March 8, Karfreitag, Ostermontag, Tag der Arbeit, Christi Himmelfahrt, Pfingstmontag, Tag der Deutschen Einheit, 1. & 2. Weihnachtstag*) plus official one-off Berlin holidays (*8. Mai 2025 Tag der Befreiung*, *17. Juni 2028 75. Jahrestag des Volksaufstandes*).
- All **16 German Bundesländer** (`DE-BE`, `DE-BB`, `DE-BY`, `DE-BW`, `DE-NW`, `DE-HE`, `DE-HH`, `DE-NI`, `DE-SN`, `DE-RP`, `DE-SH`, `DE-TH`, `DE-ST`, `DE-MV`, `DE-HB`, `DE-SL`) are supported and selectable in `TopBar.tsx`.

### 2. Per-Year Allowance & Carryover (`yearSettings`)
- Each calendar year has its own independent `allowance` and `carryOver` stored in `yearSettings[String(year)]` (both in `mainData` and inside each `PlanTab`).
- Switching years automatically loads that year's saved `allowance` and `carryOver` (or initializes a new year with the previous year's base allowance and `0` carryover).
- Exporting/importing JSON preserves `yearSettings` for all years.

### 3. Multi-Tab Scenario Planning (`PlanTabsBar.tsx` & `plannerStore.ts`)
- Users have a baseline **`Main`** tab and can create unlimited scenario tabs (`Plan 1`, `Plan 2`, ...) via **`+ New Plan`** or by cloning **`Main`** or **any existing `Plan` tab** (`duplicatePlanTab(sourceTabId)`).
- Every tab (`Main` and every `Plan` tab) includes a direct **Clone** icon button on the tab itself, and the top bar's **Clone** button duplicates whichever tab is currently active.
- Plan tabs can be renamed inline, deleted, and can span multiple years.
- **Applying a Plan to Main (`applyPlanToMain`)**:
  - Opens a confirmation modal with a configurable `[startDate, endDate]` overwrite interval.
  - **Default Interval Rule (`getDefaultApplyInterval`)**:
    - If all planned days in the Plan fall within a single calendar year, default interval is the full year (`YYYY-01-01` to `YYYY-12-31`).
    - If planned days touch multiple years, default interval is from the first planned date (`minDate`) to the last planned date (`maxDate`).
  - The confirmation modal previews how many existing vacation intervals and days in `Main` will be overwritten.
  - Every action (including `applyPlanToMain`) is pushed onto `undoStack` and is undoable/redoable via toolbar buttons or `Cmd/Ctrl + Z`, `Cmd/Ctrl + Y`, and `Cmd/Ctrl + Shift + Z`.

### 4. YAML Overlays & Left Panel (`src/data/overlays/*.yaml` & `OverlaysPanel.tsx`)
- All overlays start **switched off by default** (`defaultEnabled: false`), and all cards in the left panel start **collapsed by default**.
- **Master Display Toggle (`showOverlays`)**: Users can temporarily hide all overlays on the calendar (`Display on Calendar: Hidden`) without losing which individual overlay layers are enabled, and can toggle layers while hidden.
- Supports `generic` (e.g. Bavaria & Austria school holidays by Land), `surfing` (wave height, water temp, wind, quality icon, recommended skill level), and `diving` (visibility, currents, water temp, quality icon, level) templates.

### 5. Floating Day Tooltip (`DayTooltip.tsx`)
- Appears after a **400ms** hover delay on any calendar cell.
- Disappears **100ms** after the cursor leaves both the day cell and the tooltip.
- Anchors next to the day cell with `pointer-events-auto` and `overflow-y-auto` so users can move their cursor inside the tooltip and scroll through multiple overlays.

---

## Verification Commands
Before completing any task, always run:
```bash
npm test && npm run build && npm run test:e2e
```
Ensure all Vitest unit tests pass, the static Astro production build completes with zero errors, and all Playwright Chrome E2E tests pass.
