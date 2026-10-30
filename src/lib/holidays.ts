import type { Holiday } from '../types/planner';

export interface PresetOption {
  code: string;
  name: string;
  flag: string;
  group: 'Germany (Bundesländer)' | 'Other Countries' | 'Custom';
}

export const HOLIDAY_PRESETS: PresetOption[] = [
  // Germany Bundesländer — Berlin first!
  { code: 'DE-BE', name: 'Berlin', flag: '🇩🇪', group: 'Germany (Bundesländer)' },
  { code: 'DE-BB', name: 'Brandenburg', flag: '🇩🇪', group: 'Germany (Bundesländer)' },
  { code: 'DE-BY', name: 'Bayern (Bavaria)', flag: '🇩🇪', group: 'Germany (Bundesländer)' },
  { code: 'DE-BW', name: 'Baden-Württemberg', flag: '🇩🇪', group: 'Germany (Bundesländer)' },
  { code: 'DE-NW', name: 'Nordrhein-Westfalen (NRW)', flag: '🇩🇪', group: 'Germany (Bundesländer)' },
  { code: 'DE-HE', name: 'Hessen', flag: '🇩🇪', group: 'Germany (Bundesländer)' },
  { code: 'DE-HH', name: 'Hamburg', flag: '🇩🇪', group: 'Germany (Bundesländer)' },
  { code: 'DE-NI', name: 'Niedersachsen', flag: '🇩🇪', group: 'Germany (Bundesländer)' },
  { code: 'DE-SN', name: 'Sachsen (Saxony)', flag: '🇩🇪', group: 'Germany (Bundesländer)' },
  { code: 'DE-RP', name: 'Rheinland-Pfalz', flag: '🇩🇪', group: 'Germany (Bundesländer)' },
  { code: 'DE-SH', name: 'Schleswig-Holstein', flag: '🇩🇪', group: 'Germany (Bundesländer)' },
  { code: 'DE-TH', name: 'Thüringen', flag: '🇩🇪', group: 'Germany (Bundesländer)' },
  { code: 'DE-ST', name: 'Sachsen-Anhalt', flag: '🇩🇪', group: 'Germany (Bundesländer)' },
  { code: 'DE-MV', name: 'Mecklenburg-Vorpommern', flag: '🇩🇪', group: 'Germany (Bundesländer)' },
  { code: 'DE-HB', name: 'Bremen', flag: '🇩🇪', group: 'Germany (Bundesländer)' },
  { code: 'DE-SL', name: 'Saarland', flag: '🇩🇪', group: 'Germany (Bundesländer)' },
  { code: 'DE', name: 'Germany (Nationwide only)', flag: '🇩🇪', group: 'Germany (Bundesländer)' },

  // Other Countries
  { code: 'UK', name: 'United Kingdom', flag: '🇬🇧', group: 'Other Countries' },
  { code: 'US', name: 'United States', flag: '🇺🇸', group: 'Other Countries' },
  { code: 'FR', name: 'France', flag: '🇫🇷', group: 'Other Countries' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', group: 'Other Countries' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸', group: 'Other Countries' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱', group: 'Other Countries' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', group: 'Other Countries' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', group: 'Other Countries' },
  { code: 'NONE', name: 'Custom Only', flag: '🗓️', group: 'Custom' },
];

// Keep backward-compatible alias
export const COUNTRY_PRESETS = HOLIDAY_PRESETS;

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function fmt(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function addDaysToYMD(year: number, month: number, day: number, offset: number): string {
  const d = new Date(Date.UTC(year, month - 1, day + offset));
  return fmt(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * Anonymous Gregorian algorithm to calculate Easter Sunday for a given year
 */
export function getEasterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

/**
 * Buß- und Bettag (Day of Repentance and Prayer in Saxony):
 * Always the Wednesday before November 23 (i.e. falls between Nov 16 and Nov 22).
 */
export function getBussUndBettag(year: number): string {
  // Nov 22 is the latest possible date. Find its weekday (0=Sun..6=Sat, Wed=3)
  const nov22Dow = new Date(Date.UTC(year, 10, 22)).getUTCDay();
  const diff = (nov22Dow - 3 + 7) % 7;
  return fmt(year, 11, 22 - diff);
}

/**
 * Find the N-th weekday of a month (1-indexed n, weekday 0=Sun..6=Sat)
 */
function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): string {
  const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const offset = (weekday - firstDay + 7) % 7;
  const day = 1 + offset + (n - 1) * 7;
  return fmt(year, month, day);
}

/**
 * Find the last weekday of a month
 */
function getLastWeekdayOfMonth(year: number, month: number, weekday: number): string {
  const lastDate = new Date(Date.UTC(year, month, 0));
  const lastDayOfMonth = lastDate.getUTCDate();
  const lastWeekday = lastDate.getUTCDay();
  const diff = (lastWeekday - weekday + 7) % 7;
  return fmt(year, month, lastDayOfMonth - diff);
}

/**
 * Generates exact statutory public holidays (Gesetzliche Feiertage) for Germany
 * and all 16 Bundesländer, including Berlin's state-specific and one-off holidays.
 */
function generateGermanHolidays(
  year: number,
  stateCode: string // e.g., 'BE', 'BY', 'ALL'
): Array<{ date: string; name: string }> {
  const easter = getEasterSunday(year);
  const karfreitag = addDaysToYMD(year, easter.month, easter.day, -2);
  const ostersonntag = fmt(year, easter.month, easter.day);
  const ostermontag = addDaysToYMD(year, easter.month, easter.day, 1);
  const christiHimmelfahrt = addDaysToYMD(year, easter.month, easter.day, 39);
  const pfingstsonntag = addDaysToYMD(year, easter.month, easter.day, 49);
  const pfingstmontag = addDaysToYMD(year, easter.month, easter.day, 50);
  const fronleichnam = addDaysToYMD(year, easter.month, easter.day, 60);

  // 9 Nationwide statutory holidays (Bundeseinheitliche Feiertage)
  const list: Array<{ date: string; name: string }> = [
    { date: fmt(year, 1, 1), name: 'Neujahr (New Year’s Day)' },
    { date: karfreitag, name: 'Karfreitag (Good Friday)' },
    { date: ostermontag, name: 'Ostermontag (Easter Monday)' },
    { date: fmt(year, 5, 1), name: 'Tag der Arbeit (Labour Day)' },
    { date: christiHimmelfahrt, name: 'Christi Himmelfahrt (Ascension Day)' },
    { date: pfingstmontag, name: 'Pfingstmontag (Whit Monday)' },
    { date: fmt(year, 10, 3), name: 'Tag der Deutschen Einheit (German Unity Day)' },
    { date: fmt(year, 12, 25), name: '1. Weihnachtstag (Christmas Day)' },
    { date: fmt(year, 12, 26), name: '2. Weihnachtstag (St. Stephen’s Day)' },
  ];

  // 1. Heilige Drei Könige (Jan 6): BW, BY, ST
  if (['BW', 'BY', 'ST'].includes(stateCode)) {
    list.push({ date: fmt(year, 1, 6), name: 'Heilige Drei Könige (Epiphany)' });
  }

  // 2. Internationaler Frauentag (Mar 8): Berlin (since 2019), Mecklenburg-Vorpommern (since 2023)
  if ((stateCode === 'BE' && year >= 2019) || (stateCode === 'MV' && year >= 2023)) {
    list.push({
      date: fmt(year, 3, 8),
      name: 'Internationaler Frauentag (Women’s Day)',
    });
  }

  // 3. Ostersonntag & Pfingstsonntag (official statutory holidays in Brandenburg)
  if (stateCode === 'BB') {
    list.push(
      { date: ostersonntag, name: 'Ostersonntag (Easter Sunday)' },
      { date: pfingstsonntag, name: 'Pfingstsonntag (Whit Sunday)' }
    );
  }

  // 4. Berlin one-off statutory holidays (Einmalige gesetzliche Feiertage in Berlin)
  if (stateCode === 'BE') {
    if (year === 2020 || year === 2025) {
      list.push({
        date: fmt(year, 5, 8),
        name: 'Tag der Befreiung (Liberation Day — 80. Jahrestag)',
      });
    }
    if (year === 2028) {
      list.push({
        date: fmt(year, 6, 17),
        name: '17. Juni — 75. Jahrestag des Volksaufstandes in der DDR',
      });
    }
  }

  // 5. Fronleichnam (Easter + 60d): BW, BY, HE, NW, RP, SL
  if (['BW', 'BY', 'HE', 'NW', 'RP', 'SL'].includes(stateCode)) {
    list.push({ date: fronleichnam, name: 'Fronleichnam (Corpus Christi)' });
  }

  // 6. Mariä Himmelfahrt (Aug 15): SL, BY
  if (['SL', 'BY'].includes(stateCode)) {
    list.push({ date: fmt(year, 8, 15), name: 'Mariä Himmelfahrt (Assumption Day)' });
  }

  // 7. Weltkindertag (Sep 20): TH (since 2019)
  if (stateCode === 'TH' && year >= 2019) {
    list.push({ date: fmt(year, 9, 20), name: 'Weltkindertag (World Children’s Day)' });
  }

  // 8. Reformationstag (Oct 31): BB, HB, HH, MV, NI, SN, ST, SH, TH (and nationwide in 2017)
  if (
    year === 2017 ||
    ['BB', 'HB', 'HH', 'MV', 'NI', 'SN', 'ST', 'SH', 'TH'].includes(stateCode)
  ) {
    list.push({ date: fmt(year, 10, 31), name: 'Reformationstag (Reformation Day)' });
  }

  // 9. Allerheiligen (Nov 1): BW, BY, NW, RP, SL
  if (['BW', 'BY', 'NW', 'RP', 'SL'].includes(stateCode)) {
    list.push({ date: fmt(year, 11, 1), name: 'Allerheiligen (All Saints’ Day)' });
  }

  // 10. Buß- und Bettag (Wednesday before Nov 23): SN
  if (stateCode === 'SN') {
    list.push({
      date: getBussUndBettag(year),
      name: 'Buß- und Bettag (Repentance and Prayer Day)',
    });
  }

  return list.sort((a, b) => a.date.localeCompare(b.date));
}

export function generatePresetHolidays(year: number, presetCode: string): Record<string, Holiday> {
  if (presetCode === 'NONE') return {};

  let list: Array<{ date: string; name: string }> = [];

  if (presetCode === 'DE') {
    list = generateGermanHolidays(year, 'ALL');
  } else if (presetCode.startsWith('DE-')) {
    const stateCode = presetCode.slice(3);
    list = generateGermanHolidays(year, stateCode);
  } else {
    const easter = getEasterSunday(year);
    const goodFriday = addDaysToYMD(year, easter.month, easter.day, -2);
    const easterMonday = addDaysToYMD(year, easter.month, easter.day, 1);
    const ascensionDay = addDaysToYMD(year, easter.month, easter.day, 39);
    const whitMonday = addDaysToYMD(year, easter.month, easter.day, 50);
    const corpusChristi = addDaysToYMD(year, easter.month, easter.day, 60);

    switch (presetCode) {
      case 'UK':
        list.push(
          { date: fmt(year, 1, 1), name: "New Year's Day" },
          { date: goodFriday, name: 'Good Friday' },
          { date: easterMonday, name: 'Easter Monday' },
          { date: getNthWeekdayOfMonth(year, 5, 1, 1), name: 'Early May Bank Holiday' },
          { date: getLastWeekdayOfMonth(year, 5, 1), name: 'Spring Bank Holiday' },
          { date: getLastWeekdayOfMonth(year, 8, 1), name: 'Summer Bank Holiday' },
          { date: fmt(year, 12, 25), name: 'Christmas Day' },
          { date: fmt(year, 12, 26), name: 'Boxing Day' }
        );
        break;

      case 'US':
        list.push(
          { date: fmt(year, 1, 1), name: "New Year's Day" },
          { date: getNthWeekdayOfMonth(year, 1, 1, 3), name: 'Martin Luther King Jr. Day' },
          { date: getNthWeekdayOfMonth(year, 2, 1, 3), name: "Presidents' Day" },
          { date: getLastWeekdayOfMonth(year, 5, 1), name: 'Memorial Day' },
          { date: fmt(year, 6, 19), name: 'Juneteenth' },
          { date: fmt(year, 7, 4), name: 'Independence Day' },
          { date: getNthWeekdayOfMonth(year, 9, 1, 1), name: 'Labor Day' },
          { date: getNthWeekdayOfMonth(year, 10, 1, 2), name: 'Columbus Day' },
          { date: fmt(year, 11, 11), name: 'Veterans Day' },
          { date: getNthWeekdayOfMonth(year, 11, 4, 4), name: 'Thanksgiving Day' },
          { date: fmt(year, 12, 25), name: 'Christmas Day' }
        );
        break;

      case 'FR':
        list.push(
          { date: fmt(year, 1, 1), name: "New Year's Day" },
          { date: easterMonday, name: 'Easter Monday' },
          { date: fmt(year, 5, 1), name: 'Labour Day' },
          { date: fmt(year, 5, 8), name: 'Victory in Europe Day' },
          { date: ascensionDay, name: 'Ascension Day' },
          { date: whitMonday, name: 'Whit Monday' },
          { date: fmt(year, 7, 14), name: 'Bastille Day' },
          { date: fmt(year, 8, 15), name: 'Assumption Day' },
          { date: fmt(year, 11, 1), name: 'All Saints’ Day' },
          { date: fmt(year, 11, 11), name: 'Armistice Day' },
          { date: fmt(year, 12, 25), name: 'Christmas Day' }
        );
        break;

      case 'NL':
        list.push(
          { date: fmt(year, 1, 1), name: "New Year's Day" },
          { date: goodFriday, name: 'Good Friday' },
          { date: easterMonday, name: 'Easter Monday' },
          { date: fmt(year, 4, 27), name: "King's Day" },
          { date: fmt(year, 5, 5), name: 'Liberation Day' },
          { date: ascensionDay, name: 'Ascension Day' },
          { date: whitMonday, name: 'Whit Monday' },
          { date: fmt(year, 12, 25), name: 'Christmas Day' },
          { date: fmt(year, 12, 26), name: 'Second Day of Christmas' }
        );
        break;

      case 'ES':
        list.push(
          { date: fmt(year, 1, 1), name: "New Year's Day" },
          { date: fmt(year, 1, 6), name: 'Epiphany' },
          { date: goodFriday, name: 'Good Friday' },
          { date: fmt(year, 5, 1), name: 'Labour Day' },
          { date: fmt(year, 8, 15), name: 'Assumption of Mary' },
          { date: fmt(year, 10, 12), name: 'National Day of Spain' },
          { date: fmt(year, 11, 1), name: 'All Saints’ Day' },
          { date: fmt(year, 12, 6), name: 'Constitution Day' },
          { date: fmt(year, 12, 8), name: 'Immaculate Conception' },
          { date: fmt(year, 12, 25), name: 'Christmas Day' }
        );
        break;

      case 'PL':
        list.push(
          { date: fmt(year, 1, 1), name: "New Year's Day" },
          { date: fmt(year, 1, 6), name: 'Epiphany' },
          { date: easterMonday, name: 'Easter Monday' },
          { date: fmt(year, 5, 1), name: 'Labour Day' },
          { date: fmt(year, 5, 3), name: 'Constitution Day' },
          { date: corpusChristi, name: 'Corpus Christi' },
          { date: fmt(year, 8, 15), name: 'Assumption Day' },
          { date: fmt(year, 11, 1), name: 'All Saints’ Day' },
          { date: fmt(year, 11, 11), name: 'Independence Day' },
          { date: fmt(year, 12, 24), name: 'Christmas Eve' },
          { date: fmt(year, 12, 25), name: 'Christmas Day' },
          { date: fmt(year, 12, 26), name: 'Second Day of Christmas' }
        );
        break;

      case 'CA':
        list.push(
          { date: fmt(year, 1, 1), name: "New Year's Day" },
          { date: getNthWeekdayOfMonth(year, 2, 1, 3), name: 'Family Day' },
          { date: goodFriday, name: 'Good Friday' },
          { date: getLastWeekdayOfMonth(year, 5, 1), name: 'Victoria Day' },
          { date: fmt(year, 7, 1), name: 'Canada Day' },
          { date: getNthWeekdayOfMonth(year, 9, 1, 1), name: 'Labour Day' },
          { date: fmt(year, 9, 30), name: 'Truth and Reconciliation Day' },
          { date: getNthWeekdayOfMonth(year, 10, 1, 2), name: 'Thanksgiving Day' },
          { date: fmt(year, 11, 11), name: 'Remembrance Day' },
          { date: fmt(year, 12, 25), name: 'Christmas Day' },
          { date: fmt(year, 12, 26), name: 'Boxing Day' }
        );
        break;

      case 'AU':
        list.push(
          { date: fmt(year, 1, 1), name: "New Year's Day" },
          { date: fmt(year, 1, 26), name: 'Australia Day' },
          { date: goodFriday, name: 'Good Friday' },
          { date: easterMonday, name: 'Easter Monday' },
          { date: fmt(year, 4, 25), name: 'Anzac Day' },
          { date: getNthWeekdayOfMonth(year, 6, 1, 2), name: "King's Birthday" },
          { date: fmt(year, 12, 25), name: 'Christmas Day' },
          { date: fmt(year, 12, 26), name: 'Boxing Day' }
        );
        break;
    }
  }

  const out: Record<string, Holiday> = {};
  for (const item of list) {
    out[item.date] = {
      date: item.date,
      name: item.name,
      source: 'preset',
    };
  }
  return out;
}
