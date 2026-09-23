import {formatEdtf} from './format-edtf';
import {describe, expect, it} from '@jest/globals';
import {IntlMessageFormat} from 'intl-messageformat';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

// Formats through the real message catalogues with next-intl's own ICU
// formatter, rather than a stub that substitutes braces. That way the test
// covers what ships — including the English ordinals, where a naive
// "{century}th century" would produce "21th century".
function formatterFor(locale: 'en' | 'nl') {
  const messages = JSON.parse(
    readFileSync(
      join(__dirname, `../../messages/${locale}/messages.json`),
      'utf8'
    )
  ).FormatDate as Record<string, string>;

  const t = (key: string, values: Record<string, string | number> = {}) =>
    new IntlMessageFormat(messages[key] ?? key, locale).format(
      values
    ) as string;

  return (edtf?: string) => formatEdtf({edtf, t});
}

const en = formatterFor('en');
const nl = formatterFor('nl');

describe('formatEdtf', () => {
  it('says "before" instead of inventing a missing start date', () => {
    // What this replaces: "No start date – 31 Dec 1887".
    expect(en('../1887')).toBe('before 1887');
    expect(nl('../1887')).toBe('vóór 1887');
  });

  it('says "after" for an open end', () => {
    expect(en('1887/..')).toBe('after 1887');
    expect(nl('1887/..')).toBe('na 1887');
  });

  it('names the century with a correct ordinal in each language', () => {
    expect(en('11XX')).toBe('12th century');
    expect(en('19XX')).toBe('20th century');
    expect(en('20XX')).toBe('21st century');
    expect(nl('11XX')).toBe('12e eeuw');
    expect(nl('20XX')).toBe('21e eeuw');
  });

  it('names the decade', () => {
    expect(en('193X')).toBe('1930s');
    expect(nl('193X')).toBe('jaren 1930');
  });

  it('keeps a single year single', () => {
    expect(en('1933')).toBe('1933');
    expect(nl('1921-11-07')).toBe('1921');
  });

  it('shows a stated range as a range', () => {
    expect(en('1830/1860')).toBe('1830–1860');
    expect(nl('1830/1860')).toBe('1830–1860');
  });

  it('marks approximation and uncertainty', () => {
    expect(en('1973~')).toBe('circa 1973');
    expect(nl('1973~')).toBe('circa 1973');
    expect(en('1900?')).toBe('1900?');
    expect(en('1800%/1825%')).toBe('circa 1800–1825?');
  });

  it('writes BCE years out in each language', () => {
    expect(en('-0049/0830')).toBe('49 BCE–830');
    expect(nl('-0049/0830')).toBe('49 v.Chr.–830');
  });

  it('names the season', () => {
    expect(en('1949-21')).toBe('spring 1949');
    expect(nl('1949-21')).toBe('voorjaar 1949');
  });

  it('returns undefined when there is nothing to read, so the caller falls back', () => {
    expect(en(undefined)).toBeUndefined();
    expect(en('circa 1900')).toBeUndefined();
  });
});
