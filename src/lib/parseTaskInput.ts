/**
 * Parse a one-line task description into the fields the create form uses.
 *
 * Deliberately conservative: it only reports what it actually recognised, and
 * the caller always shows the parsed result in the normal form controls so the
 * user can see and correct it before saving. Anything not understood is left
 * in the name rather than silently dropped.
 */

export interface ParsedTaskInput {
  name: string;
  /** JS getDay() values, 0 = Sunday. Empty when no days were named. */
  days: number[];
  /** `HH:mm`, or null when no time was named. */
  time: string | null;
  /** Set when the text asked for a flexible quota ("3x a week"). */
  timesPerWeek: number | null;
  /** Set when the text asked for an interval ("every other week"). */
  everyNWeeks: number | null;
}

const DAY_WORDS: { re: RegExp; day: number }[] = [
  { re: /\b(sun|sunday)\b/gi, day: 0 },
  { re: /\b(mon|monday)\b/gi, day: 1 },
  { re: /\b(tue|tues|tuesday)\b/gi, day: 2 },
  { re: /\b(wed|weds|wednesday)\b/gi, day: 3 },
  { re: /\b(thu|thur|thurs|thursday)\b/gi, day: 4 },
  { re: /\b(fri|friday)\b/gi, day: 5 },
  { re: /\b(sat|saturday)\b/gi, day: 6 },
];

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
};

function strip(text: string, re: RegExp): string {
  return text.replace(re, ' ');
}

export function parseTaskInput(raw: string): ParsedTaskInput {
  let rest = ` ${raw} `;
  const days = new Set<number>();
  let time: string | null = null;
  let timesPerWeek: number | null = null;
  let everyNWeeks: number | null = null;

  // --- group words first, so "weekdays" isn't eaten by the "wed" matcher ---
  if (/\b(weekdays|weekday|every weekday)\b/i.test(rest)) {
    [1, 2, 3, 4, 5].forEach((d) => days.add(d));
    rest = strip(rest, /\b(weekdays|weekday)\b/gi);
  }
  if (/\b(weekends|weekend)\b/i.test(rest)) {
    [0, 6].forEach((d) => days.add(d));
    rest = strip(rest, /\b(weekends|weekend)\b/gi);
  }
  if (/\b(everyday|every day|daily)\b/i.test(rest)) {
    [0, 1, 2, 3, 4, 5, 6].forEach((d) => days.add(d));
    rest = strip(rest, /\b(everyday|every day|daily)\b/gi);
  }

  // --- "every other week" / "every 3 weeks" ---
  const interval = rest.match(/\bevery\s+(other|\d+)\s+weeks?\b/i);
  if (interval) {
    everyNWeeks = interval[1].toLowerCase() === 'other' ? 2 : Math.max(1, parseInt(interval[1], 10));
    rest = strip(rest, /\bevery\s+(other|\d+)\s+weeks?\b/gi);
  }

  // --- "3x a week" / "3 times per week" / "twice a week" ---
  const quota = rest.match(/\b(\d+|one|two|three|four|five|six|seven)\s*(?:x|times?)?\s*(?:a|per)\s*week\b/i);
  if (quota) {
    const token = quota[1].toLowerCase();
    timesPerWeek = NUMBER_WORDS[token] ?? parseInt(token, 10);
    rest = strip(rest, /\b(\d+|one|two|three|four|five|six|seven)\s*(?:x|times?)?\s*(?:a|per)\s*week\b/gi);
  } else if (/\btwice\s+(?:a|per)\s+week\b/i.test(rest)) {
    timesPerWeek = 2;
    rest = strip(rest, /\btwice\s+(?:a|per)\s+week\b/gi);
  }

  // --- named days ---
  for (const { re, day } of DAY_WORDS) {
    re.lastIndex = 0;
    if (re.test(rest)) {
      days.add(day);
      rest = strip(rest, new RegExp(re.source, 'gi'));
    }
  }

  // --- time: "7am", "7:30 pm", "at 18:00" ---
  const t = rest.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i)
         || rest.match(/\b(?:at\s+)(\d{1,2}):(\d{2})\b/);
  if (t) {
    let hour = parseInt(t[1], 10);
    const minute = t[2] ? parseInt(t[2], 10) : 0;
    const meridiem = t[3]?.toLowerCase();
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      rest = strip(rest, new RegExp(t[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    }
  }

  const name = rest
    .replace(/\b(every|on|at|each)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    name,
    days: [...days].sort((a, b) => a - b),
    time,
    timesPerWeek,
    everyNWeeks,
  };
}
