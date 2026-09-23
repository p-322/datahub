// Sawubona: the documents in the Elasticsearch indices `sawubona-objects` and
// `sawubona-persons`, and the mapping from those documents to the application
// types in ./definitions.ts. The contract is docs/elasticsearch-mapping.md;
// this file is its executable form. Tabulous writes documents in this shape.
//
// Schemas are deliberately lenient (everything optional, unknown keys kept):
// a field Tabulous adds must not break the datahub, and a field it omits must
// degrade to "not shown", as the SPARQL fetchers did.
import {
  Agent,
  HeritageObject,
  Image,
  Organization,
  Place,
  PostalAddress,
  ProvenanceEvent,
  ProvenanceEventType,
  Thing,
  TimeSpan,
} from './definitions';
import {z} from 'zod';

export type Locale = 'en' | 'nl';

// ── Document schemas ────────────────────────────────────────────────────────

// {"en": "...", "nl": "..."}; either key may be missing. A plain string is
// accepted too: names are not in a language and Tabulous may emit them flat.
export const localizedSchema = z.union([
  z.record(z.string(), z.string()),
  z.string(),
]);
export type Localized = z.infer<typeof localizedSchema>;

const thingDocSchema = z.object({
  id: z.string(),
  name: localizedSchema.optional(),
  description: localizedSchema.optional(),
});
export type ThingDoc = z.infer<typeof thingDocSchema>;

const agentDocSchema = thingDocSchema.extend({
  type: z.enum(['Person', 'Organization', 'Unknown']).optional(),
});

// Places nest through isPartOf; z.lazy for the recursion.
type PlaceDoc = ThingDoc & {isPartOf?: PlaceDoc};
const placeDocSchema: z.ZodType<PlaceDoc> = thingDocSchema.extend({
  isPartOf: z.lazy(() => placeDocSchema).optional(),
});

const timeSpanDocSchema = z.object({
  id: z.string().optional(), // Events' dates come without one
  edtf: z.string().optional(),
  startDate: z.string().optional(), // ISO 8601
  endDate: z.string().optional(),
});

const imageDocSchema = z.object({
  id: z.string(),
  contentUrl: z.string(),
  license: thingDocSchema.optional(),
});

const datasetDocSchema = thingDocSchema.extend({
  publisher: agentDocSchema.optional(),
});

export const heritageObjectDocSchema = z
  .object({
    id: z.string(),
    identifier: z.string().optional(),
    name: localizedSchema.optional(),
    // The object's kind, for the ~30% of objects the museum gave no title.
    nameFallback: localizedSchema.optional(),
    description: localizedSchema.optional(),
    inscriptions: z.array(z.string()).optional(),
    types: z.array(thingDocSchema).optional(),
    subjects: z.array(thingDocSchema).optional(),
    materials: z.array(thingDocSchema).optional(),
    techniques: z.array(thingDocSchema).optional(),
    creators: z.array(agentDocSchema).optional(),
    locationsCreated: z.array(placeDocSchema).optional(),
    dateCreated: timeSpanDocSchema.optional(),
    images: z.array(imageDocSchema).optional(),
    mainEntityOfPage: z.string().optional(),
    isPartOf: datasetDocSchema.optional(),
  })
  .passthrough();

export const organizationDocSchema = thingDocSchema
  .extend({
    type: z.literal('Organization').optional(),
    url: z.string().optional(),
    address: z
      .object({
        streetAddress: z.string().optional(),
        postalCode: z.string().optional(),
        addressLocality: localizedSchema.optional(),
        addressCountry: localizedSchema.optional(),
      })
      .optional(),
  })
  .passthrough();

// Tabulous emits six event kinds mirroring the CRM classes; the datahub's
// provenance timeline models two of them (ProvenanceEventType). The others
// are kept in the document for later use and skipped by toProvenanceEvents.
export const eventTypeSchema = z.enum([
  'acquisition',
  'transferOfCustody',
  'production',
  'historicalEvent',
  'destruction',
  'activity',
]);
export type EventType = z.infer<typeof eventTypeSchema>;

export const eventDocSchema = z
  .object({
    id: z.string(),
    type: eventTypeSchema,
    // Thing[] per the contract; bare IRIs are accepted and become {id}.
    additionalTypes: z.array(z.union([thingDocSchema, z.string()])).optional(),
    date: timeSpanDocSchema.optional(),
    transferredFrom: agentDocSchema.optional(),
    transferredTo: agentDocSchema.optional(),
    carriedOutBy: agentDocSchema.optional(),
    label: localizedSchema.optional(),
    description: localizedSchema.optional(),
    location: placeDocSchema.optional(),
    startsAfter: z.string().optional(),
    endsBefore: z.string().optional(),
  })
  .passthrough();

// JSON null anywhere means "absent" to us. Stripped before validation so a
// producer that emits null for a missing value cannot fail a document.
function stripNulls(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.filter(v => v !== null).map(stripNulls);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => [k, stripNulls(v)])
    );
  }
  return value;
}

// A document in sawubona-objects. Only the payload parts are modelled; the
// indexed parts (facets, search, sort) are the searcher's business.
export const objectDocumentSchema = z.preprocess(
  stripNulls,
  z
    .object({
      id: z.string(),
      kind: z.literal('HeritageObject').optional(),
      object: heritageObjectDocSchema,
      organization: organizationDocSchema.optional(),
      events: z.array(eventDocSchema).optional(),
    })
    .passthrough()
);
export type ObjectDocument = z.infer<typeof objectDocumentSchema>;

// A document in sawubona-persons.
export const personDocumentSchema = z.preprocess(
  stripNulls,
  z
    .object({
      id: z.string(),
      kind: z.literal('Person').optional(),
      person: thingDocSchema.passthrough(),
    })
    .passthrough()
);
export type PersonDocument = z.infer<typeof personDocumentSchema>;

// ── Localization ────────────────────────────────────────────────────────────

// The requested locale, else the other one, else undefined. The UI already
// handles a missing name (it shows "no name").
export function localize(
  value: Localized | undefined,
  locale: Locale
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value;
  }
  const other: Locale = locale === 'en' ? 'nl' : 'en';
  return value[locale] ?? value[other] ?? Object.values(value)[0];
}

// ── Mappers: document → application type ────────────────────────────────────

// The first delivery writes event types as CURIEs ("aat:300157782").
const curiePrefixes: Record<string, string> = {
  aat: 'http://vocab.getty.edu/aat/',
};

export function expandCurie(value: string): string {
  const [prefix, rest] = value.split(':', 2);
  const base = rest !== undefined ? curiePrefixes[prefix] : undefined;
  return base ? `${base}${rest}` : value;
}

function compact<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T;
}

function toThing(doc: ThingDoc, locale: Locale): Thing {
  return compact({
    id: doc.id,
    name: localize(doc.name, locale),
    description: localize(doc.description, locale),
  });
}

function toThings(docs: ThingDoc[] | undefined, locale: Locale) {
  return docs === undefined || docs.length === 0
    ? undefined
    : docs.map(doc => toThing(doc, locale));
}

function toAgent(
  doc: z.infer<typeof agentDocSchema> | undefined,
  locale: Locale
): Agent | undefined {
  if (doc === undefined) {
    return undefined;
  }
  return {...toThing(doc, locale), type: doc.type ?? 'Unknown'} as Agent;
}

function toAgents(
  docs: z.infer<typeof agentDocSchema>[] | undefined,
  locale: Locale
) {
  return docs === undefined || docs.length === 0
    ? undefined
    : docs.map(doc => toAgent(doc, locale)!);
}

function toPlace(doc: PlaceDoc | undefined, locale: Locale): Place | undefined {
  if (doc === undefined) {
    return undefined;
  }
  return compact({
    ...toThing(doc, locale),
    isPartOf: toPlace(doc.isPartOf, locale),
  });
}

function toPlaces(docs: PlaceDoc[] | undefined, locale: Locale) {
  return docs === undefined || docs.length === 0
    ? undefined
    : docs.map(doc => toPlace(doc, locale)!);
}

function toDate(value: string | undefined) {
  if (value === undefined) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function toTimeSpan(
  doc: z.infer<typeof timeSpanDocSchema> | undefined,
  fallbackId: string
): TimeSpan | undefined {
  if (doc === undefined) {
    return undefined;
  }
  return compact({
    id: doc.id ?? fallbackId,
    edtf: doc.edtf,
    startDate: toDate(doc.startDate),
    endDate: toDate(doc.endDate),
  });
}

function toImages(
  docs: z.infer<typeof imageDocSchema>[] | undefined,
  locale: Locale
): Image[] | undefined {
  return docs === undefined || docs.length === 0
    ? undefined
    : docs.map(doc =>
        compact({
          id: doc.id,
          contentUrl: doc.contentUrl,
          license: doc.license ? toThing(doc.license, locale) : undefined,
        })
      );
}

export function toHeritageObject(
  document: ObjectDocument,
  locale: Locale
): HeritageObject {
  const doc = document.object;

  return compact({
    id: doc.id,
    identifier: doc.identifier,
    name: localize(doc.name, locale),
    nameFallback: localize(doc.nameFallback, locale),
    description: localize(doc.description, locale),
    inscriptions:
      doc.inscriptions && doc.inscriptions.length > 0
        ? doc.inscriptions
        : undefined,
    types: toThings(doc.types, locale),
    subjects: toThings(doc.subjects, locale),
    materials: toThings(doc.materials, locale),
    techniques: toThings(doc.techniques, locale),
    creators: toAgents(doc.creators, locale),
    locationsCreated: toPlaces(doc.locationsCreated, locale),
    dateCreated: toTimeSpan(doc.dateCreated, `${doc.id}#dateCreated`),
    images: toImages(doc.images, locale),
    mainEntityOfPage: doc.mainEntityOfPage,
    isPartOf: doc.isPartOf
      ? compact({
          ...toThing(doc.isPartOf, locale),
          publisher: toAgent(doc.isPartOf.publisher, locale),
        })
      : undefined,
  });
}

export function toOrganization(
  document: ObjectDocument,
  locale: Locale
): Organization | undefined {
  const doc = document.organization;
  if (doc === undefined) {
    return undefined;
  }

  const address: PostalAddress | undefined = doc.address
    ? {
        id: `${doc.id}#address`,
        streetAddress: doc.address.streetAddress ?? '',
        postalCode: doc.address.postalCode ?? '',
        addressLocality: localize(doc.address.addressLocality, locale) ?? '',
        addressCountry: localize(doc.address.addressCountry, locale) ?? '',
      }
    : undefined;

  return compact({
    ...toThing(doc, locale),
    type: 'Organization' as const,
    url: doc.url,
    address,
  });
}

const provenanceEventTypes: ReadonlyArray<EventType> = [
  ProvenanceEventType.Acquisition,
  ProvenanceEventType.TransferOfCustody,
];

// Only the event kinds the provenance timeline understands. Production
// events duplicate object.creators; historical/destruction/activity events
// await UI that can show them.
export function toProvenanceEvents(
  document: ObjectDocument,
  locale: Locale
): ProvenanceEvent[] {
  return (document.events ?? [])
    .filter(doc => provenanceEventTypes.includes(doc.type))
    .map(doc =>
      compact({
        id: doc.id,
        type: doc.type as ProvenanceEventType,
        additionalTypes: toThings(
          doc.additionalTypes?.map(t =>
            typeof t === 'string' ? {id: expandCurie(t)} : t
          ),
          locale
        ),
        date: toTimeSpan(doc.date, `${doc.id}#date`),
        transferredFrom: toAgent(doc.transferredFrom, locale),
        transferredTo: toAgent(doc.transferredTo, locale),
        description: localize(doc.description, locale),
        location: toPlace(doc.location, locale),
        startsAfter: doc.startsAfter,
        endsBefore: doc.endsBefore,
      })
    );
}

export function toPersonThing(document: PersonDocument, locale: Locale): Thing {
  return toThing(document.person, locale);
}
