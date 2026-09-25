import {createHash} from 'node:crypto';

/**
 * Reading the community enrichments published by the Colonial Collections
 * datahub, so they appear on the same objects in Sawubona.
 *
 * Read only. Nothing here is ever written: the storers publish under
 * `ontologyUrl` and our own agent, and nothing else.
 *
 * Measured on the production network, 2026-09-25: 46 such nanopublications,
 * all CC BY 4.0, about 28 objects. 25 of those objects are in the Tabulous
 * delivery, and two of the 46 are end-to-end tests (see
 * `legacyTestCreatorPrefix`), which leaves 38 enrichments on 24 objects.
 *
 * Kept apart from definitions.ts on purpose. That module reaches the browser
 * (a client component imports the Local Contexts definitions, which import
 * it) and this one needs node:crypto.
 */

// The vocabulary those nanopublications are written in. It differs from ours
// in three ways the fetchers have to allow for: this namespace; `rdf:type`
// rather than `npx:hasNanopubType` for the nanopub's kind, which Nanopub
// Query derives into `npx:hasNanopubType` for us, so the fetchers need no
// second pattern; and a `Version1` suffix on classes, which nothing reads.
// Properties carry no suffix, so `fromPropertyToType` only needs the prefix.
export const legacyOntologyUrl =
  'https://n2t.net/ark:/27023/9819f32405815dc7f2e0ecd9d8a9e604#';

const legacyObjectIriPrefix = 'https://n2t.net/ark:/27023/';

/**
 * The identifier the Colonial Collections datahub used for one of our
 * objects: its prefix followed by the MD5 of the museum's own IRI.
 *
 * Not assumed from the shape of the identifiers: every object IRI in the
 * delivery was hashed and compared, and 25 of the 28 objects their
 * enrichments are about matched exactly, on the plain IRI and on nothing
 * else tried. The other three are not in the delivery.
 */
export function legacyObjectIri(iri: string) {
  return `${legacyObjectIriPrefix}${createHash('md5')
    .update(iri)
    .digest('hex')}`;
}

// Two of the 46 are end-to-end test runs published to the production
// network, both about https://hdl.handle.net/20.500.11840/1112032 and both
// attributed to, and signed by, an IRI under this prefix:
//   https://example.com/test-2-1733482667191
//   https://example.com/test-3-1733481956365
// Without this they would appear on that object under the name "End-to-end
// Test test-3-1733481956365".
export const legacyTestCreatorPrefix = 'https://example.com/';
