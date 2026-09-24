// Sawubona: faceted search over the sawubona-objects index. One request
// returns facets and complete result cards; there is no second lookup.
// Field names follow docs/elasticsearch-mapping.md.
import {
  localeSchema,
  SearchResultFilter,
  SortBy,
  SortByEnum,
  SortOrder,
  SortOrderEnum,
} from '../definitions';
import type {HeritageObjectSearchResult} from './definitions';
import {ElasticClient} from '../elastic-client';
import {
  Locale,
  objectDocumentSchema,
  toHeritageObject,
} from '../index-documents';
import {z} from 'zod';

const constructorOptionsSchema = z.object({
  endpointUrl: z.string(),
});

export type ConstructorOptions = z.infer<typeof constructorOptionsSchema>;

// Facet name in the app (SearchOptions.filters / result filters) → index
// field. Localized facets get ".<locale>" appended.
//
// The *Path fields carry a term AND its thesaurus ancestors (self-inclusive),
// so filtering on a broad term matches the narrower ones: "headgear" catches
// "hats", "Asia" catches "Java". The first delivery had them English in both
// locales, which was worth more in Dutch labels than in hierarchy, so the
// thesaurus facets used the plain fields instead.
//
// The second delivery localizes them, measured over 20,000 documents by how
// often the nl array is identical to the en one:
//
//   typesPath, subjectsPath, materialsPath, culturesPath   0.0% identical
//   placesDepictedPath, locationsCreatedPath             100.0% identical
//
// So the AAT-backed fields are now Dutch, and the facets that have a tree to
// draw take their Path field: Dutch labels AND the roll-up, with the chain
// rendered as depth rather than as sixty characters of text. `locations`
// keeps its Path as it always had — English on both sides, so the hierarchy
// there costs nothing.
//
// `placesDepicted` is the one that does not: its Path is English while its
// plain field is localized for 74% of values ("Indonesië" against
// "Indonesia"), and Dutch labels are worth more than a roll-up over a
// vocabulary this shallow.
const facetFields = {
  types: {field: 'facets.typesPath', localized: true},
  subjects: {field: 'facets.subjectsPath', localized: true},
  locations: {field: 'facets.locationsCreatedPath', localized: true},
  materials: {field: 'facets.materialsPath', localized: true},
  cultures: {field: 'facets.culturesPath', localized: true},
  placesDepicted: {field: 'facets.placesDepicted', localized: true},
  creators: {field: 'facets.creators', localized: false},
  publishers: {field: 'facets.publisher', localized: true},
  // Derived from the EDTF statement at index time; see packages/api/src/edtf.ts.
  centuries: {field: 'facets.centuries', localized: false},
  decades: {field: 'facets.decades', localized: false},
  datePrecision: {field: 'facets.datePrecision', localized: false},
  dateOpenness: {field: 'facets.dateOpenness', localized: false},
} as const;

type FacetName = keyof typeof facetFields;

// An Elasticsearch integer_range of years, open where the date is open.
const dateCreatedField = 'facets.dateCreated';
// Kept for sorting: a range field cannot be sorted on.
const yearCreatedStartField = 'facets.yearCreatedStart';

// Facet menus render every bucket and the UI searches within them, so a
// truncated list does not degrade — it makes a term unreachable, and the
// facet looks exactly as it would if the term did not exist.
//
// Cardinality of every facet field in sawubona-objects-v4, 1,039,214
// documents, measured 2026-09-24:
//
//   creators 11,032   locationsCreatedPath 6,616   placesDepicted 2,948
//   subjectsPath 2,917   typesPath 2,648   materialsPath 569
//   culturesPath 502
//
// Upstream's 10,000 was inherited and never checked against the data; it cut
// about a thousand makers out of the facet. 20,000 clears the largest field
// by 81%. One shard, so these are exact counts and there is no shard_size
// skew to allow for.
//
// This is a ceiling, not a solution. `creators` is the one facet whose
// vocabulary grows with the collection rather than with a thesaurus — a
// second museum could double it — and raising a number each time is not a
// plan. That facet wants its search moved to Elasticsearch (a terms
// aggregation with `include` driven by what the user types) instead of
// shipping every value to the browser. Until then, es-verify-load.sh checks
// the cardinality of every facet field against this number on each load.
const facetBucketSize = 20000;

const searchOptionsSchema = z.object({
  locale: localeSchema,
  query: z.string().optional().default('*'), // If no query provided, match all
  offset: z.number().int().nonnegative().optional().default(0),
  limit: z.number().int().positive().optional().default(10),
  sortBy: SortByEnum.optional().default(SortBy.DateCreated),
  sortOrder: SortOrderEnum.optional().default(SortOrder.Ascending),
  filters: z
    .object({
      types: z.array(z.string()).optional().default([]),
      subjects: z.array(z.string()).optional().default([]),
      locations: z.array(z.string()).optional().default([]),
      materials: z.array(z.string()).optional().default([]),
      cultures: z.array(z.string()).optional().default([]),
      placesDepicted: z.array(z.string()).optional().default([]),
      creators: z.array(z.string()).optional().default([]),
      publishers: z.array(z.string()).optional().default([]),
      centuries: z.array(z.string()).optional().default([]),
      decades: z.array(z.string()).optional().default([]),
      datePrecision: z.array(z.string()).optional().default([]),
      dateOpenness: z.array(z.string()).optional().default([]),
      // Inclusive year bounds typed by the user. Matched by overlap, not
      // containment: an object dated 1830/1860 answers "1840 to 1850", and
      // one dated "before 1887" answers "from 1800" — it has no start year,
      // and excluding it would silently drop a sixth of the dated objects.
      dateCreatedStart: z.number().optional(),
      dateCreatedEnd: z.number().optional(),
    })
    .optional(),
});

export type SearchOptions = z.input<typeof searchOptionsSchema>;

const rawBucketSchema = z.object({
  key: z.string().or(z.number()),
  doc_count: z.number(),
});

export type RawBucket = z.infer<typeof rawBucketSchema>;

const rawAggregationSchema = z.object({
  buckets: z.array(rawBucketSchema),
});

const rawSearchResponseSchema = z.object({
  hits: z.object({
    total: z.object({
      value: z.number(),
    }),
    hits: z.array(
      z.object({
        _source: objectDocumentSchema,
      })
    ),
  }),
  aggregations: z.object({
    types: rawAggregationSchema,
    subjects: rawAggregationSchema,
    locations: rawAggregationSchema,
    materials: rawAggregationSchema,
    cultures: rawAggregationSchema,
    placesDepicted: rawAggregationSchema,
    creators: rawAggregationSchema,
    publishers: rawAggregationSchema,
    centuries: rawAggregationSchema,
    decades: rawAggregationSchema,
    datePrecision: rawAggregationSchema,
    dateOpenness: rawAggregationSchema,
  }),
});

type RawSearchResponse = z.infer<typeof rawSearchResponseSchema>;

export class HeritageObjectSearcher {
  private readonly client: ElasticClient;

  constructor(options: ConstructorOptions) {
    const opts = constructorOptionsSchema.parse(options);
    this.client = new ElasticClient({endpointUrl: opts.endpointUrl});
  }

  private facetField(name: FacetName, locale: Locale) {
    const {field, localized} = facetFields[name];
    return localized ? `${field}.${locale}` : field;
  }

  private sortClause(sortBy: SortBy, sortOrder: SortOrder, locale: Locale) {
    const field =
      sortBy === SortBy.Name ? `sort.name.${locale}` : yearCreatedStartField;

    // Undated / unnamed objects go last whichever way we sort.
    return [{[field]: {order: sortOrder, missing: '_last'}}];
  }

  private buildRequest(options: z.output<typeof searchOptionsSchema>) {
    const {locale} = options;

    const filter: Record<string, unknown>[] = [
      {term: {kind: 'HeritageObject'}},
    ];

    for (const name of Object.keys(facetFields) as FacetName[]) {
      const values = options.filters?.[name] ?? [];
      // Each selected value is its own clause: selections within a facet are
      // ANDed, as upstream did.
      for (const value of values) {
        filter.push({term: {[this.facetField(name, locale)]: value}});
      }
    }

    const from = options.filters?.dateCreatedStart;
    const to = options.filters?.dateCreatedEnd;
    if (from !== undefined || to !== undefined) {
      // One query against the integer_range field. `intersects` returns every
      // object whose date range overlaps the years asked for, and a bound the
      // document leaves open counts as unbounded — which is what makes
      // "before 1887" answer a search for "from 1800".
      filter.push({
        range: {
          [dateCreatedField]: {
            ...(from !== undefined ? {gte: from} : {}),
            ...(to !== undefined ? {lte: to} : {}),
            relation: 'intersects',
          },
        },
      });
    }

    const aggregations = Object.fromEntries(
      (Object.keys(facetFields) as FacetName[]).map(name => [
        name,
        {terms: {field: this.facetField(name, locale), size: facetBucketSize}},
      ])
    );

    return {
      track_total_hits: true,
      size: options.limit,
      from: options.offset,
      sort: this.sortClause(options.sortBy, options.sortOrder, locale),
      // Cards need id, name, first image and the publisher; the whole payload
      // is small enough that selecting inside it isn't worth the coupling.
      _source: ['id', 'object'],
      query: {
        bool: {
          must: [
            {
              simple_query_string: {
                query: options.query,
                fields: [`search.${locale}`],
                default_operator: 'and',
              },
            },
          ],
          filter,
        },
      },
      aggregations,
    };
  }

  private buildFilters(buckets: RawBucket[]): SearchResultFilter[] {
    return buckets.map(bucket => ({
      totalCount: bucket.doc_count,
      id: bucket.key,
      name: bucket.key,
    }));
  }

  private buildResult(
    options: z.output<typeof searchOptionsSchema>,
    response: RawSearchResponse
  ): HeritageObjectSearchResult {
    const {hits, aggregations} = response;

    return {
      totalCount: hits.total.value,
      offset: options.offset,
      limit: options.limit,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
      heritageObjects: hits.hits.map(hit =>
        toHeritageObject(hit._source, options.locale)
      ),
      filters: {
        types: this.buildFilters(aggregations.types.buckets),
        subjects: this.buildFilters(aggregations.subjects.buckets),
        locations: this.buildFilters(aggregations.locations.buckets),
        materials: this.buildFilters(aggregations.materials.buckets),
        cultures: this.buildFilters(aggregations.cultures.buckets),
        placesDepicted: this.buildFilters(aggregations.placesDepicted.buckets),
        creators: this.buildFilters(aggregations.creators.buckets),
        publishers: this.buildFilters(aggregations.publishers.buckets),
        centuries: this.buildFilters(aggregations.centuries.buckets),
        decades: this.buildFilters(aggregations.decades.buckets),
        datePrecision: this.buildFilters(aggregations.datePrecision.buckets),
        dateOpenness: this.buildFilters(aggregations.dateOpenness.buckets),
      },
    };
  }

  async search(options?: SearchOptions) {
    const opts = searchOptionsSchema.parse(options ?? {});

    const searchRequest = this.buildRequest(opts);
    const rawResponse = await this.client.search<unknown>(searchRequest);
    const response = rawSearchResponseSchema.parse(rawResponse);

    return this.buildResult(opts, response);
  }
}
