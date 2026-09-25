import crypto from 'node:crypto';

// The identifier minted for a person or a community the first time they need
// one. It names them in the provenance graph of every nanopublication they
// author, and in Clerk's metadata, so it has to stay the same for as long as
// the statements they made do.
//
// A plain URL under our own domain, not an ARK. An ARK's value is the promise
// registered behind its NAAN, and a promise of permanence is not one to make
// while the funding is for a fixed term. Nothing resolves here yet.
const IRI_PREFIX = 'https://datahub.sawubona-commons.eu/id/';

export function createPersistentIri() {
  const uuid = crypto.randomUUID();
  const md5 = crypto.createHash('md5').update(uuid).digest('hex');

  return `${IRI_PREFIX}${md5}`;
}
