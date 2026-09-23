import {describeEdtf, EdtfDate} from '@colonial-collections/api';

// Sawubona: putting an EDTF date into words.
//
// The museum's dating is a statement with a shape: "before 1887", "the
// twelfth century", "circa 1973", "probably 1900". Formatting only the
// derived start/end pair throws that shape away — most visibly for the
// sixth of dated objects whose start is unknown, which used to read
// "No start date – 31 Dec 1887" where the record says "before 1887".
//
// Every phrase comes from the FormatDate messages so both locales can word
// it their own way; nothing is assembled from English fragments here.

interface Props {
  t: (key: string, values?: Record<string, string | number>) => string;
}

// EDTF level 1 sub-year codes for the four seasons.
const seasonKeys: Record<number, string> = {
  21: 'spring',
  22: 'summer',
  23: 'autumn',
  24: 'winter',
};

function year(value: number, t: Props['t']): string {
  // Years are written out rather than run through the date formatter: a
  // formatter would print "1.100" in Dutch, and it cannot render year 0 or
  // negative years sensibly.
  return value < 0
    ? t('yearBeforeCommonEra', {year: Math.abs(value)})
    : String(value);
}

function century(firstYear: number, t: Props['t']): string {
  const ordinal = Math.floor(Math.abs(firstYear) / 100) + 1;
  return firstYear < 0
    ? t('centuryBeforeCommonEra', {century: ordinal})
    : t('century', {century: ordinal});
}

function plain(date: EdtfDate, t: Props['t']): string {
  const {startYear, endYear, precision} = date;

  if (date.openness === 'openStart' && endYear !== undefined) {
    return t('before', {year: year(endYear, t)});
  }
  if (date.openness === 'openEnd' && startYear !== undefined) {
    return t('after', {year: year(startYear, t)});
  }
  if (startYear === undefined || endYear === undefined) {
    return t('noDateRange');
  }

  if (precision === 'century') {
    return century(startYear, t);
  }
  if (precision === 'decade') {
    return t('decade', {decade: year(startYear, t)});
  }
  if (precision === 'millennium') {
    return t('yearRange', {
      start: year(startYear, t),
      end: year(endYear, t),
    });
  }
  if (precision === 'season' && date.season !== undefined) {
    const season = seasonKeys[date.season];
    return season ? t(season, {year: year(startYear, t)}) : year(startYear, t);
  }
  if (startYear === endYear) {
    return year(startYear, t);
  }
  return t('yearRange', {start: year(startYear, t), end: year(endYear, t)});
}

/**
 * Formats an EDTF string for display, or returns undefined when the value is
 * missing or is not EDTF — callers then fall back to the start/end pair.
 *
 * Deliberately year-level: a date recorded as 1921-11-07 reads as "1921"
 * here, because this renders the *dating statement*, and the day is shown by
 * the existing date formatter where a day is what matters.
 */
export function formatEdtf({
  edtf,
  t,
}: Props & {edtf?: string}): string | undefined {
  if (edtf === undefined) {
    return undefined;
  }
  const date = describeEdtf(edtf);
  if (date === undefined) {
    return undefined;
  }

  const base = plain(date, t);

  switch (date.qualifier) {
    case 'approximate':
      return t('approximately', {date: base});
    case 'uncertain':
      return t('uncertainly', {date: base});
    case 'approximateAndUncertain':
      return t('approximatelyAndUncertainly', {date: base});
    default:
      return base;
  }
}
