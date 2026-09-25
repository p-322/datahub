import {describe, expect, it} from '@jest/globals';
import {madeElsewhere} from './made-elsewhere';

// The tool IRI all 46 enrichments from the Colonial Collections datahub carry
// as npx:wasCreatedWith, as found on the production network.
const theirs = 'https://app.colonialcollections.nl/';
const ours = 'https://datahub.sawubona-commons.eu/';

describe('madeElsewhere', () => {
  it('does not mark our own enrichments', () => {
    expect(madeElsewhere(ours, 'en')).toBeUndefined();
  });

  it('does not mark one that does not say what made it', () => {
    expect(madeElsewhere(undefined, 'en')).toBeUndefined();
  });

  it('names the other application by its own address', () => {
    expect(madeElsewhere(theirs, 'en')?.name).toBe(
      'app.colonialcollections.nl'
    );
  });

  // Nothing is derived from the host, so an application nobody has heard of
  // is named exactly as its IRI names it.
  it('names an application it has never seen the same way', () => {
    expect(madeElsewhere('https://tools.example.org/', 'en')?.name).toBe(
      'tools.example.org'
    );
  });

  it('links to that application in the reader’s language', () => {
    expect(madeElsewhere(theirs, 'en')?.url).toBe(
      'https://app.colonialcollections.nl/en'
    );
    expect(madeElsewhere(theirs, 'nl')?.url).toBe(
      'https://app.colonialcollections.nl/nl'
    );
  });

  it('does not offer a link it cannot follow', () => {
    expect(madeElsewhere('urn:example:tool', 'en')).toBeUndefined();
    expect(madeElsewhere('not an iri', 'en')).toBeUndefined();
  });
});
