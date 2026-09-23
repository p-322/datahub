import {formatEdtf} from './format-edtf';
import {describe, expect, it} from '@jest/globals';

// Stands in for next-intl: renders the English messages by substituting the
// values, so the test checks our wording logic rather than next-intl.
const messages: Record<string, string> = {
  before: 'before {year}',
  after: 'after {year}',
  century: '{century}th century',
  centuryBeforeCommonEra: '{century}th century BCE',
  decade: '{decade}s',
  yearRange: '{start}–{end}',
  yearBeforeCommonEra: '{year} BCE',
  approximately: 'circa {date}',
  uncertainly: '{date}?',
  approximatelyAndUncertainly: 'circa {date}?',
  spring: 'spring {year}',
  summer: 'summer {year}',
  autumn: 'autumn {year}',
  winter: 'winter {year}',
  noDateRange: 'No date',
};

const t = (key: string, values: Record<string, string | number> = {}) =>
  Object.entries(values).reduce<string>(
    (text, [name, value]) => text.replace(`{${name}}`, String(value)),
    messages[key] ?? key
  );

const format = (edtf?: string) => formatEdtf({edtf, t});

describe('formatEdtf', () => {
  it('says "before" instead of inventing a missing start date', () => {
    // What this replaces: "No start date – 31 Dec 1887".
    expect(format('../1887')).toBe('before 1887');
  });

  it('says "after" for an open end', () => {
    expect(format('1887/..')).toBe('after 1887');
  });

  it('names the century', () => {
    expect(format('11XX')).toBe('12th century');
    expect(format('19XX')).toBe('20th century');
  });

  it('names the decade', () => {
    expect(format('193X')).toBe('1930s');
  });

  it('keeps a single year single', () => {
    expect(format('1933')).toBe('1933');
    expect(format('1921-11-07')).toBe('1921');
  });

  it('shows a stated range as a range', () => {
    expect(format('1830/1860')).toBe('1830–1860');
  });

  it('marks approximation and uncertainty', () => {
    expect(format('1973~')).toBe('circa 1973');
    expect(format('1900?')).toBe('1900?');
    expect(format('1800%/1825%')).toBe('circa 1800–1825?');
  });

  it('writes BCE years out', () => {
    expect(format('-0049/0830')).toBe('49 BCE–830');
  });

  it('names the season', () => {
    expect(format('1949-21')).toBe('spring 1949');
  });

  it('returns undefined when there is nothing to read, so the caller falls back', () => {
    expect(format(undefined)).toBeUndefined();
    expect(format('circa 1900')).toBeUndefined();
  });
});
