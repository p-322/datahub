import {z} from 'zod';

export const localeSchema = z.enum(['en', 'nl']).optional().default('en');

export type Thing = {
  id: string;
  name?: string; // Name may not exist (e.g. in a specific locale)
  description?: string;
  sameAs?: string; // An identifier
};

export type Term = Thing;
export type Place = Thing & {isPartOf?: Place};
export type Unknown = Thing & {type: 'Unknown'};
export type Agent = Person | Organization | Unknown;
export type License = Thing;

export type Metric = Thing & {
  order: number; // To aid clients in presenting information in UIs
};

export type Measurement = {
  id: string;
  value: boolean; // TBD: may need to support other types at some point
  metric: Metric;
};

export type Dataset = Thing & {
  publisher?: Agent;
  license?: License;
  keywords?: string[];
  mainEntityOfPages?: string[];
  dateCreated?: Date;
  dateModified?: Date;
  datePublished?: Date;
  measurements?: Measurement[];
};

export type PostalAddress = {
  id: string;
  streetAddress: string;
  postalCode: string;
  addressLocality: string;
  addressCountry: string;
};

export type Organization = Thing & {
  type: 'Organization';
  url?: string;
  address?: PostalAddress;
};

export type Image = {
  id: string;
  contentUrl: string;
  license?: License;
};

export type TimeSpan = {
  id: string;
  // The museum's own dating statement, e.g. "../1887", "11XX", "1973~".
  // Formatted in preference to the derived pair, which cannot express
  // "before", "circa" or "the twelfth century". See packages/api/src/edtf.ts.
  edtf?: string;
  startDate?: Date;
  endDate?: Date;
};

export type HeritageObject = Thing & {
  // Sawubona: the object's kind, supplied by the index for objects the museum
  // gave no title. Not a title — render it as such.
  nameFallback?: string;
  identifier?: string;
  inscriptions?: string[];
  types?: Term[];
  subjects?: Term[];
  materials?: Term[];
  techniques?: Term[];
  creators?: Agent[];
  locationsCreated?: Place[];
  dateCreated?: TimeSpan;
  images?: Image[];
  isPartOf?: Dataset;
  mainEntityOfPage?: string; // URL of web page
};

export type Event = {
  id: string;
  date?: TimeSpan;
};

// Every kind of event the delivery carries. Upstream modelled only the two
// that transfer an object between parties; the timeline dropped the rest,
// which is 940,795 of 3,206,849 events in the Wereldmuseum delivery — most
// of it production, the event that begins an object's life.
export enum ProvenanceEventType {
  Acquisition = 'acquisition',
  Production = 'production',
  TransferOfCustody = 'transferOfCustody',
  HistoricalEvent = 'historicalEvent',
  Destruction = 'destruction',
  Activity = 'activity',
}

export type ProvenanceEvent = {
  id: string;
  type: ProvenanceEventType;
  additionalTypes?: Term[];
  date?: TimeSpan;
  transferredFrom?: Agent;
  transferredTo?: Agent;
  // Who performed the event, where no object changed hands: the maker of a
  // production, the actor of an activity. Distinct from the two parties of a
  // transfer, and the only place a maker appears on an event.
  carriedOutBy?: Agent;
  // The event's own name, as the source wrote it. Historical events are
  // almost always labelled and little else; without this they arrive as a
  // bare date.
  label?: string;
  description?: string;
  location?: Place;
  startsAfter?: string; // ID of another provenance event
  endsBefore?: string; // ID of another provenance event
};

export type Person = Thing & {
  type: 'Person';
  birthDate?: TimeSpan;
  birthPlace?: Place;
  deathDate?: TimeSpan;
  deathPlace?: Place;
  isPartOf?: Dataset;
};

export enum SortBy {
  BirthYear = 'birthYear',
  DateCreated = 'dateCreated',
  Name = 'name',
}

export const SortByEnum = z.nativeEnum(SortBy);

export enum SortOrder {
  Ascending = 'asc',
  Descending = 'desc',
}

export const SortOrderEnum = z.nativeEnum(SortOrder);

export type SearchResultFilter = {
  id: string | number;
  name?: string | number; // Name may not exist (e.g. in a specific locale)
  totalCount: number;
};
