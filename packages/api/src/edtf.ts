// Sawubona: reading an EDTF date string.
//
// The index carries an Extended Date/Time Format string for most dates
// (`object.dateCreated.edtf`, `event.date.edtf`) alongside a derived
// start/end pair. The pair is lossy: "1973~" and "1973" both become
// 1973-01-01..1973-12-31, "../1887" loses the fact that only the end is
// known, and "11XX" stops being "the twelfth century" and becomes an
// arbitrary-looking 1100..1199. This module reads the string itself.
//
// One function serves two callers, so a date can never be labelled one way
// on the page and bucketed another way in the facets:
//   - the application formats `EdtfDate` into a human sentence;
//   - the index enrichment turns it into the facet fields.
//
// 99.998% of the EDTF occurrences in the first Wereldmuseum delivery parse
// (2,287 of 2,288 distinct values; the exception is "1914/1914", which the
// library rejects for equal bounds and which is handled here).
import edtfParse from 'edtf';

// How precisely the source dated the object. Read from the NOTATION, not
// from the width of the resulting range: "11XX" is century precision because
// its century digits are unspecified, while "1830/1860" is a range whose
// endpoints are both precise to the year. Conflating the two would put "a
// thirty-year window" and "the twelfth century" in the same bucket.
export type DatePrecision =
  | 'day'
  | 'month'
  | 'season'
  | 'year'
  | 'decade'
  | 'century'
  | 'millennium'
  | 'range' // An interval between two stated endpoints
  | 'open'; // At least one side is unknown

// What the source said about its own confidence: EDTF "?" is uncertain,
// "~" is approximate, "%" is both.
export type DateQualifier =
  | 'exact'
  | 'approximate'
  | 'uncertain'
  | 'approximateAndUncertain';

export type DateOpenness = 'closed' | 'openStart' | 'openEnd' | 'unbounded';

export type EdtfDate = {
  edtf: string;
  // Inclusive year bounds. Absent where the notation leaves that side open.
  startYear?: number;
  endYear?: number;
  precision: DatePrecision;
  qualifier: DateQualifier;
  openness: DateOpenness;
  // Centuries and decades the range touches, as first years: the 19th
  // century is 1800, the 1830s are 1830. Empty when a side is open or the
  // range is too wide to enumerate usefully.
  centuries: number[];
  decades: number[];
  // Only for precision 'season': 21 = spring … 24 = winter (EDTF level 1).
  season?: number;
};

// Enumerating centuries for a range wider than this says nothing useful and
// makes the facet meaningless, so those objects only carry their bounds.
const maxSpanToEnumerate = 500;
// Decades are only worth listing once a range is narrow enough to be about
// decades at all.
const maxSpanForDecades = 100;

function yearOf(timestamp: number): number {
  return new Date(timestamp).getUTCFullYear();
}

// The library's `precision` counts stated components: 1 = year, 2 = month,
// 3 = day. `unspecified` is a bitmask of X-ed out digits, where the two
// century digits are bits 4 and 8 (12) and the decade digit is bit 4 (8).
function precisionOf(part: {
  precision?: number;
  unspecified?: {value?: number} | number;
}): DatePrecision | undefined {
  const unspecified =
    typeof part.unspecified === 'number'
      ? part.unspecified
      : part.unspecified?.value ?? 0;

  if (unspecified >= 14) {
    return 'millennium';
  }
  if (unspecified >= 12) {
    return 'century';
  }
  if (unspecified >= 8) {
    return 'decade';
  }

  switch (part.precision ?? 0) {
    case 3:
      return 'day';
    case 2:
      return 'month';
    case 1:
      return 'year';
    default:
      return undefined;
  }
}

function qualifierOf(parts: {uncertain?: unknown; approximate?: unknown}[]) {
  const flag = (value: unknown) =>
    (typeof value === 'number' ? value : (value as {value?: number})?.value) ??
    0;

  const uncertain = parts.some(part => flag(part.uncertain) > 0);
  const approximate = parts.some(part => flag(part.approximate) > 0);

  if (uncertain && approximate) {
    return 'approximateAndUncertain' as const;
  }
  return uncertain
    ? ('uncertain' as const)
    : approximate
      ? ('approximate' as const)
      : ('exact' as const);
}

function firstYearOfCentury(year: number): number {
  return Math.floor(year / 100) * 100;
}

function firstYearOfDecade(year: number): number {
  return Math.floor(year / 10) * 10;
}

/**
 * Reads an EDTF string. Returns undefined when the value cannot be parsed,
 * so callers fall back to whatever they did before.
 */
export function describeEdtf(value: string): EdtfDate | undefined {
  const parsed = parse(value);
  if (parsed === undefined) {
    return undefined;
  }

  const openStart = !Number.isFinite(parsed.min);
  const openEnd = !Number.isFinite(parsed.max);
  const startYear = openStart ? undefined : yearOf(parsed.min);
  const endYear = openEnd ? undefined : yearOf(parsed.max);

  // An interval exposes its endpoints; a plain date is its own endpoint.
  const endpoints = [parsed.lower, parsed.upper].filter(
    (part): part is NonNullable<typeof part> =>
      part !== undefined && part !== null && typeof part === 'object'
  );
  const parts = endpoints.length > 0 ? endpoints : [parsed];

  const openness: DateOpenness =
    openStart && openEnd
      ? 'unbounded'
      : openStart
        ? 'openStart'
        : openEnd
          ? 'openEnd'
          : 'closed';

  const precision = precisionFor(parsed, parts, openness, startYear, endYear);

  return {
    edtf: value,
    startYear,
    endYear,
    precision,
    qualifier: qualifierOf(parts),
    openness,
    ...spread(precision, startYear, endYear),
    // `Season.season` is the EDTF sub-year code (21 spring … 24 winter);
    // `type` is the class name, not a number.
    ...(typeof parsed.season === 'number' ? {season: parsed.season} : {}),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parse(value: string): any | undefined {
  try {
    return edtfParse(value);
  } catch {
    // "1914/1914": the library refuses an interval whose bounds are equal,
    // though it is a legal way of writing a single year.
    const sameBounds = /^(.+)\/\1$/.exec(value);
    if (sameBounds === null) {
      return undefined;
    }
    try {
      return edtfParse(sameBounds[1]);
    } catch {
      return undefined;
    }
  }
}

function precisionFor(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parsed: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parts: any[],
  openness: DateOpenness,
  startYear?: number,
  endYear?: number
): DatePrecision {
  if (openness !== 'closed') {
    return 'open';
  }
  if (parsed.constructor?.name === 'Season') {
    return 'season';
  }

  // A single date: its own notation says how precise it is.
  if (parts.length === 1) {
    return precisionOf(parts[0]) ?? 'year';
  }

  // An interval: precise only if both endpoints describe the same single
  // unit, e.g. "11XX/11XX". Otherwise it is a range between two points, and
  // its width is a separate fact from its precision.
  const both = parts.map(part => precisionOf(part));
  if (startYear === endYear && both[0] !== undefined && both[0] === both[1]) {
    return both[0];
  }
  return 'range';
}

// A century-precision date belongs in its century but not in any decade:
// "the twelfth century" does not tell us the object is from the 1130s, and
// listing all ten decades would fill the decade facet with objects nobody
// dated that finely.
const precisionsWithinADecade: ReadonlySet<DatePrecision> = new Set([
  'day',
  'month',
  'season',
  'year',
  'decade',
]);

function spread(
  precision: DatePrecision,
  startYear?: number,
  endYear?: number
) {
  if (startYear === undefined || endYear === undefined) {
    return {centuries: [], decades: []};
  }

  const span = endYear - startYear;
  const centuries: number[] = [];
  const decades: number[] = [];

  if (span <= maxSpanToEnumerate) {
    for (
      let year = firstYearOfCentury(startYear);
      year <= firstYearOfCentury(endYear);
      year += 100
    ) {
      centuries.push(year);
    }
  }
  if (
    span <= maxSpanForDecades &&
    (precisionsWithinADecade.has(precision) || precision === 'range')
  ) {
    for (
      let year = firstYearOfDecade(startYear);
      year <= firstYearOfDecade(endYear);
      year += 10
    ) {
      decades.push(year);
    }
  }

  return {centuries, decades};
}

// ── Index enrichment ────────────────────────────────────────────────────────

export type DateFacets = {
  // An Elasticsearch integer_range. An absent bound is unbounded, which is
  // what makes "before 1887" behave correctly under an intersects query.
  dateCreated?: {gte?: number; lte?: number};
  datePrecision?: DatePrecision;
  dateQualifier?: DateQualifier;
  dateOpenness?: DateOpenness;
  centuries?: number[];
  decades?: number[];
};

/**
 * The facet fields derived from one EDTF string. Empty object when the value
 * is missing or unparseable, so those documents simply carry no date facets.
 */
export function toDateFacets(value: string | undefined): DateFacets {
  if (value === undefined) {
    return {};
  }
  const date = describeEdtf(value);
  if (date === undefined) {
    return {};
  }

  const range: {gte?: number; lte?: number} = {};
  if (date.startYear !== undefined) {
    range.gte = date.startYear;
  }
  if (date.endYear !== undefined) {
    range.lte = date.endYear;
  }

  return {
    ...(range.gte !== undefined || range.lte !== undefined
      ? {dateCreated: range}
      : {}),
    datePrecision: date.precision,
    dateQualifier: date.qualifier,
    dateOpenness: date.openness,
    ...(date.centuries.length > 0 ? {centuries: date.centuries} : {}),
    ...(date.decades.length > 0 ? {decades: date.decades} : {}),
  };
}
