import type {
  BridgeOpportunity,
  DayEntry,
  Holiday,
  TripMetadata,
  VacationBlock,
} from '../types/planner';

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export const TRIP_COLORS = [
  '#10b981', // emerald
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#8b5cf6', // violet
  '#f97316', // orange
];

export function formatYMD(year: number, monthZeroIndexed: number, day: number): string {
  const m = String(monthZeroIndexed + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

export function parseYMD(ymd: string): { year: number; month: number; day: number } {
  const [y, m, d] = ymd.split('-').map(Number);
  return { year: y, month: m - 1, day: d };
}

export function getDayOfWeek(ymd: string): number {
  const { year, month, day } = parseYMD(ymd);
  return new Date(Date.UTC(year, month, day)).getUTCDay();
}

export function getDaysInMonth(year: number, monthZeroIndexed: number): number {
  return new Date(Date.UTC(year, monthZeroIndexed + 1, 0)).getUTCDate();
}

export function addDays(ymd: string, delta: number): string {
  const { year, month, day } = parseYMD(ymd);
  const dt = new Date(Date.UTC(year, month, day + delta));
  return formatYMD(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
}

export function getAllDatesInYear(year: number): string[] {
  const dates: string[] = [];
  for (let m = 0; m < 12; m++) {
    const count = getDaysInMonth(year, m);
    for (let d = 1; d <= count; d++) {
      dates.push(formatYMD(year, m, d));
    }
  }
  return dates;
}

export function getDatesBetween(startYMD: string, endYMD: string): string[] {
  const a = startYMD <= endYMD ? startYMD : endYMD;
  const b = startYMD <= endYMD ? endYMD : startYMD;
  const result: string[] = [];
  let curr = a;
  let safety = 0;
  while (curr <= b && safety < 400) {
    result.push(curr);
    curr = addDays(curr, 1);
    safety++;
  }
  return result;
}

export function formatHumanRange(startYMD: string, endYMD: string): string {
  const s = parseYMD(startYMD);
  const e = parseYMD(endYMD);
  if (startYMD === endYMD) {
    return `${MONTH_SHORT[s.month]} ${s.day}`;
  }
  if (s.month === e.month) {
    return `${MONTH_SHORT[s.month]} ${s.day} – ${e.day}`;
  }
  return `${MONTH_SHORT[s.month]} ${s.day} – ${MONTH_SHORT[e.month]} ${e.day}`;
}

export function formatShortDate(ymd: string): string {
  const { month, day } = parseYMD(ymd);
  return `${MONTH_SHORT[month]} ${day}`;
}

export function getDayPtoCost(
  ymd: string,
  days: Record<string, DayEntry>,
  activeHolidays: Record<string, Holiday>,
  workdays: number[]
): { confirmed: number; draft: number; total: number } {
  const entry = days[ymd];
  if (!entry) return { confirmed: 0, draft: 0, total: 0 };

  const dow = getDayOfWeek(ymd);
  const isWorkday = workdays.includes(dow);
  const isHoliday = Boolean(activeHolidays[ymd]);

  // Public holidays and non-workdays (weekends) cost 0 PTO days
  if (!isWorkday || isHoliday) {
    return { confirmed: 0, draft: 0, total: 0 };
  }

  switch (entry.status) {
    case 'confirmed':
      return { confirmed: 1, draft: 0, total: 1 };
    case 'half-confirmed':
      return { confirmed: 0.5, draft: 0, total: 0.5 };
    case 'draft':
      return { confirmed: 0, draft: 1, total: 1 };
    case 'half-draft':
      return { confirmed: 0, draft: 0.5, total: 0.5 };
    default:
      return { confirmed: 0, draft: 0, total: 0 };
  }
}

/**
 * Automatically groups contiguous off-days (combining PTO days with adjacent weekends/holidays)
 * whenever at least 1 PTO day (confirmed or draft) is part of the contiguous block.
 */
export function computeVacationBlocks(
  year: number,
  days: Record<string, DayEntry>,
  activeHolidays: Record<string, Holiday>,
  workdays: number[],
  tripMeta: Record<string, TripMetadata>
): VacationBlock[] {
  const allDates = getAllDatesInYear(year);
  const blocks: VacationBlock[] = [];

  const isDayOff = (ymd: string): boolean => {
    const dow = getDayOfWeek(ymd);
    const isWeekend = !workdays.includes(dow);
    const isHol = Boolean(activeHolidays[ymd]);
    const hasPto = Boolean(days[ymd]);
    return isWeekend || isHol || hasPto;
  };

  let currentDates: string[] = [];

  const flushBlock = (dates: string[]) => {
    if (dates.length === 0) return;

    let confirmedPtoDays = 0;
    let draftPtoDays = 0;
    let weekendDays = 0;
    let holidayDays = 0;

    for (const d of dates) {
      const dow = getDayOfWeek(d);
      const isWeekend = !workdays.includes(dow);
      const isHol = Boolean(activeHolidays[d]);
      const cost = getDayPtoCost(d, days, activeHolidays, workdays);

      confirmedPtoDays += cost.confirmed;
      draftPtoDays += cost.draft;

      if (isWeekend) {
        weekendDays++;
      } else if (isHol) {
        holidayDays++;
      }
    }

    const ptoDays = confirmedPtoDays + draftPtoDays;
    // Only include blocks where the user actually planned at least one day/half-day off
    if (ptoDays <= 0) return;

    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
    const meta = tripMeta[startDate];
    const colorIndex = blocks.length % TRIP_COLORS.length;

    blocks.push({
      id: startDate,
      startDate,
      endDate,
      totalDays: dates.length,
      ptoDays,
      confirmedPtoDays,
      draftPtoDays,
      weekendDays,
      holidayDays,
      efficiency: Number((dates.length / ptoDays).toFixed(2)),
      isAllDraft: confirmedPtoDays === 0 && draftPtoDays > 0,
      isMixed: confirmedPtoDays > 0 && draftPtoDays > 0,
      dates,
      name: meta?.name || `Trip ${formatHumanRange(startDate, endDate)}`,
      note: meta?.notes || '',
      color: meta?.color || TRIP_COLORS[colorIndex],
    });
  };

  for (const ymd of allDates) {
    if (isDayOff(ymd)) {
      currentDates.push(ymd);
    } else {
      flushBlock(currentDates);
      currentDates = [];
    }
  }
  flushBlock(currentDates);

  return blocks;
}

/**
 * Finds smart "Bridge Day" opportunities in the year where 1 or 2 PTO days connect
 * a public holiday with a weekend (or another holiday) to yield high-efficiency time off.
 */
export function findBridgeOpportunities(
  year: number,
  activeHolidays: Record<string, Holiday>,
  workdays: number[]
): BridgeOpportunity[] {
  const allDates = getAllDatesInYear(year);
  const opportunities: BridgeOpportunity[] = [];
  const seenKeys = new Set<string>();

  const isNaturalOff = (ymd: string): boolean => {
    const dow = getDayOfWeek(ymd);
    return !workdays.includes(dow) || Boolean(activeHolidays[ymd]);
  };

  // Look for workdays of length 1 or 2 sandwiched between natural off-periods (at least one side containing a holiday)
  let i = 0;
  while (i < allDates.length) {
    if (!isNaturalOff(allDates[i])) {
      let j = i;
      while (j < allDates.length && !isNaturalOff(allDates[j])) {
        j++;
      }
      const gapLength = j - i;
      if (gapLength >= 1 && gapLength <= 2 && i > 0 && j < allDates.length) {
        // Expand left natural off block
        let left = i - 1;
        while (left > 0 && isNaturalOff(allDates[left - 1])) {
          left--;
        }
        // Expand right natural off block
        let right = j;
        while (right + 1 < allDates.length && isNaturalOff(allDates[right + 1])) {
          right++;
        }

        const totalSpan = allDates.slice(left, right + 1);
        const holidaysInSpan = totalSpan
          .map((d) => activeHolidays[d]?.name)
          .filter((n): n is string => Boolean(n));

        if (holidaysInSpan.length > 0 && totalSpan.length >= 4) {
          const ptoDates = allDates.slice(i, j);
          const key = ptoDates.join(',');
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            const ptoCost = ptoDates.length;
            const totalDaysOff = totalSpan.length;
            opportunities.push({
              id: ptoDates[0],
              title: holidaysInSpan[0],
              ptoDates,
              blockStart: totalSpan[0],
              blockEnd: totalSpan[totalSpan.length - 1],
              ptoCost,
              totalDaysOff,
              efficiency: Number((totalDaysOff / ptoCost).toFixed(1)),
              holidayNames: Array.from(new Set(holidaysInSpan)),
            });
          }
        }
      }
      i = j;
    } else {
      i++;
    }
  }

  return opportunities.sort((a, b) => b.efficiency - a.efficiency || a.blockStart.localeCompare(b.blockStart));
}
