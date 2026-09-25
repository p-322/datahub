import {describe, expect, it} from '@jest/globals';
import {legacyObjectIri} from './legacy';

describe('legacyObjectIri', () => {
  // A pair taken from the network, not built from the function under test:
  // six community enrichments on the production network are about
  // ark:/27023/3a44…, and that is this Wereldmuseum object in the delivery.
  it('gives the identifier the old datahub used for one of our objects', () => {
    expect(legacyObjectIri('https://hdl.handle.net/20.500.11840/651063')).toBe(
      'https://n2t.net/ark:/27023/3a4405148a6fe949ef30fe744769151f'
    );
  });

  // The hash is of the IRI as written. A trailing slash or a different scheme
  // is a different object as far as the old identifiers are concerned.
  it('is sensitive to the exact IRI', () => {
    expect(
      legacyObjectIri('http://hdl.handle.net/20.500.11840/651063')
    ).not.toBe(legacyObjectIri('https://hdl.handle.net/20.500.11840/651063'));
  });
});
