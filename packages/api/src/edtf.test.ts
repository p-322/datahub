import {describeEdtf, toDateFacets} from './edtf';
import {describe, expect, it} from '@jest/globals';

describe('describeEdtf', () => {
  it('reads a plain year', () => {
    expect(describeEdtf('1933')).toMatchObject({
      startYear: 1933,
      endYear: 1933,
      precision: 'year',
      qualifier: 'exact',
      openness: 'closed',
      centuries: [1900],
      decades: [1930],
    });
  });

  it('reads a day and a month', () => {
    expect(describeEdtf('1921-11-07')).toMatchObject({precision: 'day'});
    expect(describeEdtf('1921-11')).toMatchObject({precision: 'month'});
  });

  it('reads an open start as "before"', () => {
    expect(describeEdtf('../1887')).toMatchObject({
      startYear: undefined,
      endYear: 1887,
      precision: 'open',
      openness: 'openStart',
      centuries: [],
    });
  });

  it('reads an open end as "after"', () => {
    expect(describeEdtf('1887/..')).toMatchObject({
      startYear: 1887,
      endYear: undefined,
      openness: 'openEnd',
    });
  });

  it('reads unspecified digits as the century, not as a 99-year range', () => {
    expect(describeEdtf('11XX')).toMatchObject({
      startYear: 1100,
      endYear: 1199,
      precision: 'century',
      centuries: [1100],
    });
  });

  it('does not put a century-precision date into every one of its decades', () => {
    // "The twelfth century" says nothing about the 1130s, so it must not
    // show up under a decade nobody claimed.
    expect(describeEdtf('11XX')).toMatchObject({decades: []});
    expect(describeEdtf('193X')).toMatchObject({decades: [1930]});
  });

  it('reads unspecified digits as the decade', () => {
    expect(describeEdtf('193X')).toMatchObject({
      startYear: 1930,
      endYear: 1939,
      precision: 'decade',
    });
  });

  it('calls a stated interval a range, whatever its width', () => {
    // The distinction that matters: this is not "the 19th century", it is a
    // thirty-year window between two years the museum stated.
    expect(describeEdtf('1830/1860')).toMatchObject({
      startYear: 1830,
      endYear: 1860,
      precision: 'range',
      centuries: [1800],
      decades: [1830, 1840, 1850, 1860],
    });
  });

  it('keeps approximation and uncertainty apart', () => {
    expect(describeEdtf('1973~')).toMatchObject({qualifier: 'approximate'});
    expect(describeEdtf('1900?')).toMatchObject({qualifier: 'uncertain'});
    expect(describeEdtf('1800%/1825%')).toMatchObject({
      qualifier: 'approximateAndUncertain',
    });
  });

  it('takes the qualifier from either endpoint of an interval', () => {
    expect(describeEdtf('0500?/1000?')).toMatchObject({
      qualifier: 'uncertain',
      precision: 'range',
    });
  });

  it('reads BCE years', () => {
    expect(describeEdtf('-0049/0830')).toMatchObject({
      startYear: -49,
      endYear: 830,
    });
  });

  it('reads a season', () => {
    expect(describeEdtf('1949-21')).toMatchObject({
      precision: 'season',
      season: 21,
      startYear: 1949,
      endYear: 1949,
    });
  });

  it('accepts an interval whose bounds are equal, which the parser rejects', () => {
    expect(describeEdtf('1914/1914')).toMatchObject({
      startYear: 1914,
      endYear: 1914,
    });
  });

  it('spans several centuries when a range crosses a boundary', () => {
    expect(describeEdtf('1780/1820')).toMatchObject({
      centuries: [1700, 1800],
    });
  });

  it('does not enumerate centuries for a very wide range', () => {
    expect(describeEdtf('-0049/0830')).toMatchObject({
      centuries: [],
      decades: [],
    });
  });

  it('returns undefined for something that is not EDTF', () => {
    expect(describeEdtf('circa 1900')).toBeUndefined();
    expect(describeEdtf('')).toBeUndefined();
  });
});

describe('toDateFacets', () => {
  it('produces an open-ended range for "before"', () => {
    expect(toDateFacets('../1887')).toStrictEqual({
      dateCreated: {lte: 1887},
      datePrecision: 'open',
      dateQualifier: 'exact',
      dateOpenness: 'openStart',
    });
  });

  it('produces a closed range with centuries and decades', () => {
    expect(toDateFacets('1830/1860')).toStrictEqual({
      dateCreated: {gte: 1830, lte: 1860},
      yearCreatedStart: 1830,
      datePrecision: 'range',
      dateQualifier: 'exact',
      dateOpenness: 'closed',
      centuries: [1800],
      decades: [1830, 1840, 1850, 1860],
    });
  });

  it('is empty for a missing or unparseable value', () => {
    expect(toDateFacets(undefined)).toStrictEqual({});
    expect(toDateFacets('not a date')).toStrictEqual({});
  });

  // The four impossible periods in the first delivery. Each record keeps its
  // date and its label; it just does not join the period scale, so one
  // mistyped year cannot put a "92nd century" row in the facet.
  it.each(['2450', '2500', '3000~', '9131-05-21'])(
    'keeps a creation year in the future off the period scale: %s',
    value => {
      const facets = toDateFacets(value);
      expect(facets.dateCreated).toBeDefined();
      expect(facets.centuries).toBeUndefined();
      expect(facets.decades).toBeUndefined();
    }
  );

  it('still places a date from this year', () => {
    const thisYear = new Date().getUTCFullYear();
    expect(toDateFacets(String(thisYear)).centuries).toStrictEqual([
      Math.floor(thisYear / 100) * 100,
    ]);
  });

  it('places the BCE dates those errors were probably meant to be', () => {
    expect(describeEdtf('-2449~')?.centuries).toStrictEqual([-2500]);
    expect(describeEdtf('-3499')?.centuries).toStrictEqual([-3500]);
  });
});

describe('toDateFacets sort key', () => {
  // Tabulous ships yearCreatedEnd but never yearCreatedStart, so the search
  // page's date ordering had no field to sort on. Derived from the EDTF.
  it('carries the start year as a scalar to sort on', () => {
    expect(toDateFacets('1830/1860').yearCreatedStart).toBe(1830);
    expect(toDateFacets('1933').yearCreatedStart).toBe(1933);
    expect(toDateFacets('11XX').yearCreatedStart).toBe(1100);
    expect(toDateFacets('-0049/0830').yearCreatedStart).toBe(-49);
  });

  it('omits it where the notation has no start, so those sort last', () => {
    expect(toDateFacets('../1887').yearCreatedStart).toBeUndefined();
    expect(toDateFacets('1887/..').yearCreatedStart).toBe(1887);
  });

  it('agrees with the lower bound of the range it is sorted alongside', () => {
    for (const value of ['1830/1860', '1933', '11XX', '193X', '1887/..']) {
      const facets = toDateFacets(value);
      expect(facets.yearCreatedStart).toBe(facets.dateCreated?.gte);
    }
  });
});
