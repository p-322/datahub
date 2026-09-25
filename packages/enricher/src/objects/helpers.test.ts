import {HeritageObjectEnrichmentType} from './definitions';
import {
  fromPropertyToType,
  fromTypeToClass,
  fromTypeToProperty,
} from './helpers';
import {describe, expect, it} from '@jest/globals';

// The IRIs are written out in full rather than built from `ontologyUrl`.
// Asserting against the same constant the code interpolates proves only that
// a template literal works; these tests are here to pin the vocabulary that
// goes out in a nanopub, so they have to state it.
const material = 'https://sawubona-commons.eu/ns/nanopub#material';
const Material = 'https://sawubona-commons.eu/ns/nanopub#Material';

describe('fromTypeToProperty', () => {
  it('throws if the property is unknown', () => {
    // @ts-expect-error:TS2345
    expect(() => fromTypeToProperty('badValue')).toThrow(
      'Unknown type: "badValue"'
    );
  });

  it('returns the property of a type', () => {
    const property = fromTypeToProperty(HeritageObjectEnrichmentType.Material);

    expect(property).toEqual(material);
  });
});

describe('fromPropertyToType', () => {
  it('throws if the type is unknown', () => {
    expect(() => fromPropertyToType('badValue')).toThrow(
      'Unknown property: "badValue"'
    );
  });

  it('returns the type of a property', () => {
    const type = fromPropertyToType(material);

    expect(type).toEqual(HeritageObjectEnrichmentType.Material);
  });
});

describe('fromTypeToClass', () => {
  it('throws if the class is unknown', () => {
    // @ts-expect-error:TS2345
    expect(() => fromTypeToClass('badValue')).toThrow(
      'Unknown type: "badValue"'
    );
  });

  it('returns the class of a type', () => {
    const className = fromTypeToClass(HeritageObjectEnrichmentType.Material);

    expect(className).toEqual(Material);
  });
});
