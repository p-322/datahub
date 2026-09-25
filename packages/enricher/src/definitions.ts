import {z} from 'zod';

// The vocabulary Sawubona Commons publishes its nanopublications in. Every
// class and property a nanopub of ours carries is named under this namespace,
// and `?np a sc:Nanopub` is what tells our enrichments apart from every other
// nanopub on the network — so the writers in */storer.ts and the readers in
// */fetcher.ts take it from here and nowhere else.
//
// Should a class ever have to change meaning, the vocabulary moves as a whole
// to a dated namespace — `/ns/nanopub/<year>#` — rather than growing a suffix
// per class.
export const ontologyUrl = 'https://sawubona-commons.eu/ns/nanopub#';

// The agent every nanopublication of ours is signed by, and the label the
// network shows it under.
//
// One agent for the whole application, not one per contributor: a key has to
// be introduced and then endorsed by an already-trusted agent before the
// network will attribute what it signs, and that is a step no contributor
// should have to take before they can say something. Who actually made the
// statement is recorded in the provenance graph as `prov:wasAttributedTo`,
// which is what the fetchers read for the name shown on an object page.
//
// Hard-coded rather than configured, next to the vocabulary it publishes
// under, because a misconfigured value here would sign under the wrong
// identity and a nanopublication cannot be edited afterwards.
export const nanopubAgentIri =
  'https://datahub.sawubona-commons.eu/nanopub-agent';
export const nanopubAgentName = 'Sawubona Commons Bot';

// The application every nanopublication of ours says it was made with, as
// `npx:wasCreatedWith` in its pubinfo. The storers write it; the object page
// reads it back to tell our enrichments from ones made with another tool.
// One constant for both, so the two cannot drift apart.
export const softwareToolIri = 'https://datahub.sawubona-commons.eu/';

export const creatorSchema = z.object({
  id: z.string().url(),
  name: z.string(),
  // The group the creator speaks on behalf of
  isPartOf: z
    .object({
      id: z.string().url(),
      name: z.string(),
    })
    .optional(),
});

export type BasicEnrichment = {
  id: string;
};

export const basicEnrichmentBeingCreatedSchema = z.object({
  description: z.string().optional(),
  citation: z.string().optional(),
  inLanguage: z.string().optional(), // E.g. 'en', 'nl-nl'
  about: z.string().url(),
  pubInfo: z.object({
    creator: creatorSchema,
    license: z.string().url(),
  }),
});

export type Thing = {
  id: string;
  name?: string; // Name may not exist (e.g. in a specific locale)
};

export type Term = Thing;
export type Place = Thing;
export type Actor = Thing & {
  isPartOf?: Actor; // E.g. a group such as a community
};

export type TimeSpan = {
  id: string;
  startDate?: Date;
  endDate?: Date;
};

export type PubInfo = {
  creator: Actor;
  license: string;
  dateCreated: Date;
  // The `npx:wasCreatedWith` of the nanopublication: the application it was
  // made with. Ours is `softwareToolIri`. Absent when the nanopublication
  // does not say.
  createdWith?: string;
};
