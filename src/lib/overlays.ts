import { parse } from 'yaml';
import type {
  OverlayConfigFile,
  OverlayDateSpan,
  OverlayDisplayPriority,
  OverlayUserPref,
  ResolvedDayOverlay,
} from '../types/planner';
import { getDatesBetween } from './dateUtils';

// Load all YAML files in src/data/overlays/ automatically
const rawYamlFiles = import.meta.glob('../data/overlays/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export function loadOverlayConfigs(): OverlayConfigFile[] {
  const configs: OverlayConfigFile[] = [];

  for (const [path, rawContent] of Object.entries(rawYamlFiles)) {
    try {
      const parsed = parse(rawContent) as Partial<OverlayConfigFile>;
      if (!parsed || typeof parsed !== 'object' || !parsed.id || !parsed.name) {
        continue;
      }
      configs.push({
        id: String(parsed.id),
        name: String(parsed.name),
        template:
          parsed.template === 'surfing' || parsed.template === 'diving'
            ? parsed.template
            : 'generic',
        defaultEnabled: parsed.defaultEnabled ?? false,
        defaultDisplay: parsed.defaultDisplay === 'primary' ? 'primary' : 'secondary',
        color: typeof parsed.color === 'string' ? parsed.color : '#f97316',
        description: parsed.description ? String(parsed.description).trim() : undefined,
        location: parsed.location ? String(parsed.location).trim() : undefined,
        ranges: Array.isArray(parsed.ranges) ? parsed.ranges : [],
      });
    } catch (err) {
      console.warn(`Failed to parse YAML overlay at ${path}:`, err);
    }
  }

  // Sort generic first or by name
  const order = { generic: 0, surfing: 1, diving: 2 };
  return configs.sort(
    (a, b) => order[a.template] - order[b.template] || a.name.localeCompare(b.name)
  );
}

export const OVERLAY_CONFIGS: OverlayConfigFile[] = loadOverlayConfigs();

/**
 * Expands a single OverlayDateSpan for a target year.
 * Supports:
 * - Full dates: "YYYY-MM-DD" to "YYYY-MM-DD" (including cross-year spans like "2026-12-24" to "2027-01-08")
 * - Recurring annual dates: "MM-DD" to "MM-DD" (including winter wrap-around like "12-01" to "02-14")
 */
export function expandSpanForYear(span: OverlayDateSpan, year: number): string[] {
  const isRecurringStart = /^\d{2}-\d{2}$/.test(span.start);
  const isRecurringEnd = /^\d{2}-\d{2}$/.test(span.end);

  if (isRecurringStart && isRecurringEnd) {
    // Handle Feb 29 / Feb 28 safely
    const normalizeRecurring = (mmdd: string): string => {
      if (mmdd === '02-29') {
        const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
        return isLeap ? `${year}-02-29` : `${year}-02-28`;
      }
      return `${year}-${mmdd}`;
    };

    if (span.start <= span.end) {
      return getDatesBetween(
        normalizeRecurring(span.start),
        normalizeRecurring(span.end)
      );
    } else {
      // Cross-year recurring span (e.g. "12-01" to "02-14")
      const janToEnd = getDatesBetween(
        `${year}-01-01`,
        normalizeRecurring(span.end)
      );
      const startToDec = getDatesBetween(
        normalizeRecurring(span.start),
        `${year}-12-31`
      );
      return [...janToEnd, ...startToDec];
    }
  }

  // Full YYYY-MM-DD dates: filter only dates falling within `year`
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  if (span.end < yearStart || span.start > yearEnd) {
    return [];
  }
  const clampedStart = span.start < yearStart ? yearStart : span.start;
  const clampedEnd = span.end > yearEnd ? yearEnd : span.end;
  return getDatesBetween(clampedStart, clampedEnd);
}

/**
 * Resolves all active overlays for every date in `year`.
 */
export function computeActiveDayOverlays(
  year: number,
  configs: OverlayConfigFile[],
  overlayPrefs: Record<string, OverlayUserPref>
): Record<string, ResolvedDayOverlay[]> {
  const dayMap: Record<string, ResolvedDayOverlay[]> = {};

  for (const cfg of configs) {
    const pref = overlayPrefs[cfg.id];
    const enabled = pref ? pref.enabled : (cfg.defaultEnabled ?? false);
    if (!enabled) continue;

    const effectiveColor = pref?.color || cfg.color;
    const effectiveDisplay: OverlayDisplayPriority =
      pref?.display || cfg.defaultDisplay;
    const disabledRegions = new Set(pref?.disabledRegions || []);

    for (const span of cfg.ranges) {
      if (span.region && disabledRegions.has(span.region)) {
        continue;
      }

      const dates = expandSpanForYear(span, year);
      const spanDisplay: OverlayDisplayPriority =
        effectiveDisplay === 'primary'
          ? span.display || 'primary'
          : 'secondary';
      const spanColor = span.color || effectiveColor;

      const resolved: ResolvedDayOverlay = {
        overlayId: cfg.id,
        overlayName: cfg.name,
        template: cfg.template,
        display: spanDisplay,
        color: spanColor,
        span,
      };

      for (const ymd of dates) {
        if (!dayMap[ymd]) {
          dayMap[ymd] = [];
        }
        dayMap[ymd].push(resolved);
      }
    }
  }

  return dayMap;
}

export function getDistinctRegionsForOverlay(cfg: OverlayConfigFile): string[] {
  const set = new Set<string>();
  for (const r of cfg.ranges) {
    if (r.region) set.add(r.region);
  }
  return Array.from(set);
}
