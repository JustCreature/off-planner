# Off-Planner 🗓️🏄‍♂️🏂

A fast, zoomable vacation & PTO days-off planner built with **Astro**, **Preact** (`@preact/signals`), and **Tailwind CSS**.

Designed for planning trips with maximum efficiency around public holidays (starting with **Berlin** and all **16 German Bundesländer**), while overlaying custom YAML seasonal calendars such as **Alpine school holidays to avoid** (Bavaria & Austria by Land) and **Surfing / Diving condition seasons** (e.g., Nicaragua).

---

## Quick Start

```bash
# Install dependencies
npm install

# Start local development server (http://localhost:4321)
npm run dev

# Run unit tests
npm test

# Build static production site into ./dist
npm run build
```

---

## Core Features

1. **5 Instant Zoom Levels**:
   - **Linear (`12×31`)**: Full-year horizontal matrix (`12 months × 31 days`) for a bird's-eye view of spacing across the year.
   - **12M (`Year Grid`)**: Compact 12-month grid with holiday dots, surf/dive condition wave icons, and overlay color bars.
   - **6M (`Half Year`)** & **3M (`Quarter`)**: Medium-density multi-month views with inline surf/dive stats and holiday labels.
   - **1M (`Month Detail`)**: Full-size calendar with inline daily notes, full condition telemetry, and skill level recommendations.
2. **Per-Year PTO Budget & Carryover**:
   - Each year (`2025`, `2026`, `2027`, etc.) stores its own independent **Allowance** and **Carryover** days in `yearSettings`.
   - Live segmented budget bar tracks **Confirmed PTO**, **Draft PTO**, and **Remaining Days** (automatically excluding weekends and active public holidays).
3. **German Bundesländer & International Public Holidays**:
   - Defaults to **🇩🇪 Berlin (`DE-BE`)** with all 10 statutory holidays (including *Internationaler Frauentag* on March 8, plus Berlin's one-off holidays on May 8, 2025 and June 17, 2028).
   - Switchable to any of the **16 German Bundesländer** (`DE-BY`, `DE-BB`, `DE-NW`, `DE-SN`, etc.) or international presets (`UK`, `US`, `FR`, `NL`, `ES`, `PL`, `CA`, `AU`).
4. **Collapsible Left Panel for YAML Overlays & Seasons**:
   - Toggle each YAML overlay on/off, switch between **Primary** and **Secondary** display priority, override colors live in the UI, and filter by sub-region (e.g. toggle specific Austrian or Bavarian Lands).
5. **100% Local Persistence + JSON Export / Import**:
   - Automatically saved in `localStorage`.
   - Click **Export JSON** to download `off-planner-YYYY.json`, or drag-and-drop any `.json` file onto the window to restore all years, trips, budgets, and overlay preferences.

---

## Configuring Custom YAML Overlays (`src/data/overlays/*.yaml`)

All `.yaml` files inside [`src/data/overlays/`](file:///Users/nikitazavartsev/prog_projects/off-planner/src/data/overlays) are automatically loaded at build/dev time. Drop a new `.yaml` file into that folder and it will immediately appear in the **Left Overlays Panel**.

### Supported Templates (`template`)

There are **3 template types**:
1. `generic` — Ideal for school holidays, festival dates, peak crowd periods to avoid, or weather windows.
2. `surfing` — Dedicated surfing season template with wave icon indicators (🟢 `good`, 🟡 `shoulder`, 🔴 `bad`), `avgWaveHeight`, `waterTemp`, `wind`, and `recommendedLevel`.
3. `diving` — Dedicated diving season template with anchor icon indicators (🟢 `good`, 🟡 `shoulder`, 🔴 `bad`), `avgWaveHeight`, `waterTemp`, `visibility`, `currents`, and `recommendedLevel`.

### Display Modes (`defaultDisplay` / `display`)
- `primary`: Highlights matching calendar cells with a subtle tinted background, border glow, inline stats in 6M/3M/1M views, and a solid bottom color bar.
- `secondary`: Keeps calendar cells clean with a subtle bottom color bar and wave/anchor status icon, while showing all details in the hover tooltip and in the 1M detailed view.
- *(Note: You can switch any overlay between `Primary` and `Secondary` and override its `color` directly in the left sidebar UI!)*

### Date Formats (`start` & `end`)
- **Specific Dates (`YYYY-MM-DD`)**: e.g. `start: "2026-02-16"`, `end: "2026-02-20"`. Useful for school holidays that shift each year. Cross-year ranges like `"2026-12-24"` to `"2027-01-08"` are automatically split across both years.
- **Recurring Annual Seasons (`MM-DD`)**: e.g. `start: "04-01"`, `end: "08-31"`. Automatically applies to every year! Winter wrap-around ranges like `"12-01"` to `"02-14"` are also supported.

---

### Example 1: Generic Template (`school-holidays-bavaria-austria.yaml`)

```yaml
id: school-holidays-bavaria-austria
name: School Holidays (Bavaria & Austria)
template: generic
defaultEnabled: true
defaultDisplay: secondary
color: "#f97316"
location: Bavaria (DE) & Austria (AT) by Land
description: >
  Official school holiday periods in Bavaria and Austrian Bundesländer.
  Avoid these weeks for quieter and cheaper snowboarding trips!
ranges:
  - region: Bayern (Bavaria)
    label: Winterferien (Fasching) Bayern
    start: "2026-02-16"
    end: "2026-02-20"
    description: Fasching week in Bavaria — very busy in Alpine resorts.

  - region: AT — Tirol, Salzburg & Vorarlberg
    label: Semesterferien (Tirol, Salzburg, Vorarlberg)
    start: "2026-02-09"
    end: "2026-02-14"
    description: Ski week in Western Austria.
```

---

### Example 2: Surfing Template (`surfing-nicaragua.yaml`)

```yaml
id: surfing-nicaragua
name: Surfing — Nicaragua (Pacific Coast)
template: surfing
defaultEnabled: true
defaultDisplay: primary
color: "#06b6d4"
location: Popoyo / Tola / San Juan del Sur, Nicaragua
description: >
  Pacific Nicaragua surf seasons with offshore Papagayo winds.
ranges:
  - region: Pacific Coast (Popoyo / Tola)
    label: Prime Swell Season (Peak Surf)
    start: "04-01"
    end: "08-31"
    display: primary
    quality: good               # 'good' (green wave), 'shoulder' (amber wave), 'bad' (red wave)
    avgWaveHeight: "4–8 ft (1.2–2.5m)"
    waterTemp: "27–29°C"
    wind: "All-day Offshore (Papagayo)"
    recommendedLevel: "Intermediate – Advanced"
    description: Consistent S/SW groundswells and all-day offshore winds.

  - region: Pacific Coast (Popoyo / Tola)
    label: Early Shoulder Season
    start: "03-01"
    end: "03-31"
    display: secondary
    quality: shoulder
    avgWaveHeight: "3–5 ft (0.9–1.5m)"
    waterTemp: "26–28°C"
    wind: "Consistent Offshore"
    recommendedLevel: "Beginner – Intermediate"
```

---

### Example 3: Diving Template (`diving-nicaragua.yaml`)

```yaml
id: diving-nicaragua
name: Diving — Nicaragua (Corn Islands)
template: diving
defaultEnabled: false
defaultDisplay: secondary
color: "#3b82f6"
location: Little Corn Island (Caribbean)
ranges:
  - region: Corn Islands (Caribbean)
    label: Prime Caribbean Dry & Calm Season
    start: "02-15"
    end: "05-31"
    display: primary
    quality: good               # 'good' (green anchor), 'shoulder' (amber), 'bad' (red)
    avgWaveHeight: "1–2 ft (Calm Sea)"
    waterTemp: "27–29°C"
    visibility: "20–35m"
    currents: "Mild"
    recommendedLevel: "Open Water – Advanced"
    description: Best visibility and calmest crossings around Little Corn Island.
```

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `C` | Paint **Confirmed Off** (1.0 PTO day) |
| `D` | Paint **Draft / Idea** (1.0 PTO day) |
| `H` | Paint **Half-Day Confirmed** (0.5 PTO day) |
| `G` | Paint **Half-Day Draft** (0.5 PTO day) |
| `P` | Toggle **Public Holiday** on clicked date |
| `E` | **Eraser** (clear planned dates) |
| `1` – `5` | Switch Zoom Level (`Linear`, `12M`, `6M`, `3M`, `1M`) |
| `+` / `-` | Zoom In / Zoom Out |
| `Cmd/Ctrl + Z` | Undo (`+ Shift` for Redo) |
