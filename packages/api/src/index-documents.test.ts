import {
  localize,
  objectDocumentSchema,
  personDocumentSchema,
  toHeritageObject,
  toOrganization,
  toPersonThing,
  toProvenanceEvents,
} from './index-documents';
import {ProvenanceEventType} from './definitions';
import {describe, expect, it} from '@jest/globals';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const objectDocument = objectDocumentSchema.parse(
  JSON.parse(
    readFileSync(join(__dirname, '__fixtures__/object-document.json'), 'utf8')
  )
);
const personDocument = personDocumentSchema.parse(
  JSON.parse(
    readFileSync(join(__dirname, '__fixtures__/person-document.json'), 'utf8')
  )
);

describe('localize', () => {
  it('returns the requested locale', () => {
    expect(localize({en: 'mask', nl: 'masker'}, 'nl')).toBe('masker');
  });

  it('falls back to the other locale', () => {
    expect(localize({en: 'pigment'}, 'nl')).toBe('pigment');
  });

  it('returns undefined without a value', () => {
    expect(localize(undefined, 'en')).toBeUndefined();
  });

  it('passes a plain string through', () => {
    expect(localize('J. Smith', 'nl')).toBe('J. Smith');
  });
});

describe('toHeritageObject', () => {
  it('maps the payload to a HeritageObject in the requested locale', () => {
    const object = toHeritageObject(objectDocument, 'nl');

    expect(object).toStrictEqual({
      id: 'https://data.sawubona-commons.eu/objects/1234',
      identifier: '1234',
      name: 'Ceremonieel masker',
      description: 'Houten masker met pigment.',
      types: [{id: 'http://vocab.getty.edu/aat/300138758', name: 'masker'}],
      subjects: [{id: 'https://example.org/subjects/ritual', name: 'ritueel'}],
      materials: [
        {id: 'http://vocab.getty.edu/aat/300011914', name: 'hout'},
        {id: 'http://vocab.getty.edu/aat/300014109', name: 'pigment'}, // English fallback
      ],
      techniques: [
        {id: 'http://vocab.getty.edu/aat/300053149', name: 'houtsnijwerk'},
      ],
      creators: [
        {
          id: 'https://example.org/agents/unknown',
          name: 'Onbekende maker',
          type: 'Unknown',
        },
      ],
      locationsCreated: [
        {
          id: 'https://sws.geonames.org/972062/',
          name: 'KwaZoeloe-Natal',
          isPartOf: {
            id: 'https://sws.geonames.org/953987/',
            name: 'Zuid-Afrika',
          },
        },
      ],
      dateCreated: {
        id: 'https://data.sawubona-commons.eu/objects/1234#dateCreated',
        edtf: '188X',
        startDate: new Date('1880-01-01'),
        endDate: new Date('1889-12-31'),
      },
      images: [
        {
          id: 'https://images.example.org/1234.jpg',
          contentUrl: 'https://images.example.org/1234.jpg',
          license: {
            id: 'https://creativecommons.org/licenses/by/4.0/',
            name: 'CC BY 4.0',
          },
        },
      ],
      mainEntityOfPage: 'https://museum-x.example.org/collection/1234',
      isPartOf: {
        id: 'https://data.sawubona-commons.eu/datasets/museum-x',
        name: 'Collectie Museum X',
        publisher: {
          id: 'https://data.sawubona-commons.eu/organizations/museum-x',
          name: 'Museum X',
          type: 'Organization',
        },
      },
    });
  });

  it('omits empty arrays and missing fields', () => {
    const object = toHeritageObject(objectDocument, 'en');

    expect(object).not.toHaveProperty('inscriptions');
    expect(object.name).toBe('Ceremonial mask');
  });

  it('keeps nameFallback apart from the museum title', () => {
    const untitled = objectDocumentSchema.parse({
      id: 'https://example.org/o/2',
      object: {
        id: 'https://example.org/o/2',
        nameFallback: {nl: 'hoed', en: 'hat'},
      },
    });

    const object = toHeritageObject(untitled, 'nl');
    expect(object.name).toBeUndefined();
    expect(object.nameFallback).toBe('hoed');
  });

  it('accepts a minimal document', () => {
    const minimal = objectDocumentSchema.parse({
      id: 'https://example.org/o/1',
      object: {id: 'https://example.org/o/1'},
    });

    expect(toHeritageObject(minimal, 'en')).toStrictEqual({
      id: 'https://example.org/o/1',
    });
    expect(toOrganization(minimal, 'en')).toBeUndefined();
    expect(toProvenanceEvents(minimal, 'en')).toStrictEqual([]);
  });
});

describe('toOrganization', () => {
  it('maps the embedded organization with a localized address', () => {
    expect(toOrganization(objectDocument, 'nl')).toStrictEqual({
      id: 'https://data.sawubona-commons.eu/organizations/museum-x',
      name: 'Museum X',
      type: 'Organization',
      url: 'https://museum-x.example.org/',
      address: {
        id: 'https://data.sawubona-commons.eu/organizations/museum-x#address',
        streetAddress: 'Museumstraat 1',
        postalCode: '1000 AA',
        addressLocality: 'Amsterdam',
        addressCountry: 'Nederland',
      },
    });
  });
});

describe('toProvenanceEvents', () => {
  it('maps every kind of event, including sparse ones', () => {
    const events = toProvenanceEvents(objectDocument, 'en');

    // Production used to be dropped here, along with historical events,
    // destructions and activities: 940,795 of the delivery's 3,206,849.
    expect(events).toHaveLength(objectDocument.events!.length);
    expect(events[0]).toStrictEqual({
      id: 'https://data.sawubona-commons.eu/objects/1234/events/1',
      type: ProvenanceEventType.Acquisition,
      additionalTypes: [
        {id: 'http://vocab.getty.edu/aat/300417642', name: 'purchase'},
      ],
      date: {
        id: 'https://data.sawubona-commons.eu/objects/1234/events/1#date',
        edtf: '1902',
        startDate: new Date('1902-01-01'),
        endDate: new Date('1902-12-31'),
      },
      transferredFrom: {
        id: 'https://example.org/agents/j-smith',
        name: 'J. Smith',
        type: 'Person',
      },
      transferredTo: {
        id: 'https://data.sawubona-commons.eu/organizations/museum-x',
        name: 'Museum X',
        type: 'Organization',
      },
      description: 'Bought at auction.',
      location: {id: 'https://sws.geonames.org/2643743/', name: 'London'},
    });
    expect(events[1]).toStrictEqual({
      id: 'https://data.sawubona-commons.eu/objects/1234/events/2',
      type: ProvenanceEventType.TransferOfCustody,
      startsAfter: 'https://data.sawubona-commons.eu/objects/1234/events/1',
    });
    // A production names neither party. Its maker is in carriedOutBy, and
    // its own name in label — the two fields the timeline was missing.
    expect(events[2]).toStrictEqual({
      id: 'https://data.sawubona-commons.eu/objects/1234/events/3',
      type: ProvenanceEventType.Production,
      label: 'Production',
      carriedOutBy: {
        id: 'https://example.org/agents/unknown',
        name: 'Unknown maker',
        type: 'Unknown',
      },
      date: {
        id: 'https://data.sawubona-commons.eu/objects/1234/events/3#date',
        edtf: '188X',
        startDate: new Date('1880-01-01'),
        endDate: new Date('1889-12-31'),
      },
    });
  });

  it('accepts the Tabulous shape: nulls, dates without id, CURIE types, flat names', () => {
    const document = objectDocumentSchema.parse({
      id: 'https://example.org/o/3',
      object: {id: 'https://example.org/o/3'},
      events: [
        {
          id: 'https://example.org/o/3/e/1',
          type: 'acquisition',
          additionalTypes: ['aat:300417642'],
          label: null,
          date: {edtf: '1911', startDate: '1911-01-01', endDate: '1911-12-31'},
          transferredTo: {
            id: 'https://example.org/org/1',
            type: 'Organization',
            name: 'Museum X',
          },
        },
      ],
    });

    expect(toProvenanceEvents(document, 'en')).toStrictEqual([
      {
        id: 'https://example.org/o/3/e/1',
        type: ProvenanceEventType.Acquisition,
        additionalTypes: [{id: 'http://vocab.getty.edu/aat/300417642'}],
        date: {
          id: 'https://example.org/o/3/e/1#date',
          edtf: '1911',
          startDate: new Date('1911-01-01'),
          endDate: new Date('1911-12-31'),
        },
        transferredTo: {
          id: 'https://example.org/org/1',
          name: 'Museum X',
          type: 'Organization',
        },
      },
    ]);
  });
});

describe('toPersonThing', () => {
  it('maps a person document to a Thing', () => {
    expect(toPersonThing(personDocument, 'nl')).toStrictEqual({
      id: 'https://example.org/agents/j-smith',
      name: 'J. Smith',
    });
  });
});

describe('toProvenanceEvents deduplication', () => {
  const withEvents = (events: unknown[]) =>
    objectDocumentSchema.parse({
      id: 'https://example.org/o/9',
      object: {id: 'https://example.org/o/9'},
      events,
    });

  // The museum's source tells these apart by fields the delivery does not
  // carry, so they arrive as exact copies differing only in an id built from
  // ConXrefID. One real object repeats the same sentence 27 times.
  it('collapses events that differ only in their id', () => {
    const document = withEvents([
      {
        id: 'https://example.org/e/1',
        type: 'acquisition',
        description: {nl: 'In bezit geweest van Piers, Martin Albertus'},
      },
      {
        id: 'https://example.org/e/2',
        type: 'acquisition',
        description: {nl: 'In bezit geweest van Piers, Martin Albertus'},
      },
    ]);

    const events = toProvenanceEvents(document, 'nl');

    expect(events).toHaveLength(1);
    // The first id survives, so the timeline's select buttons keep working.
    expect(events[0].id).toBe('https://example.org/e/1');
  });

  // The reason the key is the whole event: "In bezit geweest van X" is a
  // confirmed ownership and "(mogelijk) X" an explicit maybe. A key of
  // (type, party, date) would merge them into one line.
  it('keeps events whose description differs', () => {
    const document = withEvents([
      {
        id: 'https://example.org/e/1',
        type: 'acquisition',
        transferredFrom: {id: 'https://example.org/p/1', name: 'F. Coppens'},
        description: {nl: 'In bezit geweest van Coppens'},
      },
      {
        id: 'https://example.org/e/2',
        type: 'acquisition',
        transferredFrom: {id: 'https://example.org/p/1', name: 'F. Coppens'},
        description: {nl: '(mogelijk) Coppens F. Dhr.'},
      },
    ]);

    expect(toProvenanceEvents(document, 'nl')).toHaveLength(2);
  });

  // The producer's array order varies between runs, so key order within an
  // object can too. A plain JSON.stringify would call these different.
  it('collapses events whose fields arrive in a different order', () => {
    const document = withEvents([
      {id: 'https://example.org/e/1', type: 'acquisition', description: 'x'},
      {description: 'x', type: 'acquisition', id: 'https://example.org/e/2'},
    ]);

    expect(toProvenanceEvents(document, 'nl')).toHaveLength(1);
  });

  it('leaves an object whose events are all distinct alone', () => {
    const document = withEvents([
      {id: 'https://example.org/e/1', type: 'production'},
      {id: 'https://example.org/e/2', type: 'acquisition'},
      {id: 'https://example.org/e/3', type: 'transferOfCustody'},
    ]);

    expect(toProvenanceEvents(document, 'nl')).toHaveLength(3);
  });
});
