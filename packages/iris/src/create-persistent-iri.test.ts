import {createPersistentIri} from './create-persistent-iri';
import {describe, expect, it} from '@jest/globals';

describe('createPersistentIri', () => {
  it('returns a persistent IRI', () => {
    expect(createPersistentIri()).toMatch(
      /^https:\/\/datahub\.sawubona-commons\.eu\/id\/[0-9a-f]{32}$/
    );
  });

  it('returns a different IRI each time', () => {
    expect(createPersistentIri()).not.toEqual(createPersistentIri());
  });
});
