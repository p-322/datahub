# Elasticsearch index: what the datahub consumes today

This document describes the Elasticsearch index the datahub currently reads,
as the code actually queries it. It is the baseline for the Sawubona index
that Tabulous will build: everything listed here is what the application
expects to find, so a replacement index must either provide it or the
application code named here must change. The design of the new index is a
separate document; this one records the present.

Every claim below points to the file that implements it. Line references are
to the fork at the time of writing.

## 1. Origin of the index

Upstream (colonial-collections) does not run Elasticsearch itself. The index
is TriplyDB's "search-graph" service, an Elasticsearch index that Triply
derives from an RDF graph:

    SEARCH_ENDPOINT_URL=https://api.colonialcollections.nl/datasets/data-hub-testing/search-graph/services/search/elasticsearch

(`apps/researcher/.env.development`.) That origin explains the document
shape in section 3: fields are RDF predicate IRIs, and each RDF resource is
one document. The datahub has no knowledge of the RDF; it only sees these
documents.

## 2. Protocol

One client, `packages/api/src/elastic-client.ts`: an HTTP `POST` of a JSON
search body to `SEARCH_ENDPOINT_URL`, `Content-Type: application/json`,
response parsed as JSON. Nothing else: no client library, no authentication,
no index name or `_search` path added by the code.

Consequence: `SEARCH_ENDPOINT_URL` was the full search URL, e.g.
`http://<host>:9200/<index>/_search` on a plain node. (The rewired client in
`elastic-client.ts` takes the alias base URL and appends the path itself; see
`elasticsearch-mapping.md`.)

The variable is read server-side only, in `apps/researcher/src/lib/
heritage-objects-instance.ts` and `apps/researcher/src/app/[locale]/api/
datahub/route.ts`. The browser never contacts Elasticsearch.

## 3. Document model

One index holds documents of more than one RDF type. The code filters on
type in every query.

Field names are predicate IRIs with every `.` replaced by a space (Triply's
convention; Elasticsearch field names cannot contain dots). The code
hard-codes them in two `RawKeys` enums (`packages/api/src/objects/
searcher.ts`, `packages/api/src/enrichments/searcher-constituents-datahub.ts`):

| Key in code        | Field name in the index                                     |
| ------------------ | ----------------------------------------------------------- |
| `Id`               | `@id` (the resource IRI)                                    |
| `Type`             | `http://www w3 org/1999/02/22-rdf-syntax-ns#type`           |
| `AdditionalType`   | `https://colonialcollections nl/schema#additionalType`      |
| `Name`             | `https://colonialcollections nl/schema#name`                |
| `About`            | `https://colonialcollections nl/schema#about`               |
| `Creator`          | `https://colonialcollections nl/schema#creator`             |
| `Material`         | `https://colonialcollections nl/schema#material`            |
| `Technique`        | `https://colonialcollections nl/schema#technique`           |
| `Publisher`        | `https://colonialcollections nl/schema#publisher`           |
| `YearCreatedStart` | `https://colonialcollections nl/schema#yearCreatedStart`    |
| `YearCreatedEnd`   | `https://colonialcollections nl/schema#yearCreatedEnd`      |
| `CountryCreated`   | `https://colonialcollections nl/schema#countryCreated`      |

Field values are the resource's *labels* (strings), not IRIs: facet buckets
are shown to the user as-is, and `name` is read as `_source[Name][0]`
(`searcher-constituents-datahub.ts`, `buildResult`), so multi-valued fields
are arrays of strings.

Three conventions the code depends on:

- **`.keyword` sub-field** on every field used for aggregation, term filter
  or sort (standard Elasticsearch `text` + `keyword` multi-field mapping).
- **Locale suffix** `_en` / `_nl` on exactly four fields: `AdditionalType`,
  `Material`, `Publisher`, `CountryCreated`. The code builds e.g.
  `…#material_nl.keyword` from the request locale (`searcher.ts`,
  `buildRequest`). `Name`, `About` and `Creator` carry no suffix.
- **Type values** are full IRIs: `https://colonialcollections.nl/schema#HeritageObject`
  and `https://colonialcollections.nl/schema#Person`.

## 4. Query 1: object search (`HeritageObjectSearcher`)

`packages/api/src/objects/searcher.ts`, `buildRequest`. Used by the search
page `apps/researcher/src/app/[locale]/objects/`.

Request shape:

- `track_total_hits: true`, `size` = limit (default 10), `from` = offset.
- `_source: ['@id']` — only the IRI is retrieved; see section 6.
- `query.bool.must`: one `simple_query_string` with the user's query
  (`*` when empty) and `default_operator: 'and'`, over all fields (no
  `fields` list, so Elasticsearch's default `*` applies).
- `query.bool.filter`: `terms` on `Type.keyword` = HeritageObject, plus one
  `terms` clause per selected facet value (values are ANDed), plus optional
  `range` clauses `YearCreatedStart >= dateCreatedStart` and
  `YearCreatedEnd <= dateCreatedEnd`.
- `aggregations`: six `terms` aggregations, each `size: 10000`:

| Aggregation  | Field                                    |
| ------------ | ---------------------------------------- |
| `types`      | `AdditionalType_<locale>.keyword`        |
| `subjects`   | `About.keyword`                          |
| `locations`  | `CountryCreated_<locale>.keyword`        |
| `materials`  | `Material_<locale>.keyword`              |
| `creators`   | `Creator.keyword`                        |
| `publishers` | `Publisher_<locale>.keyword`             |

Facet filters use the same fields. A bucket's `key` is used as both the
filter value and the display label (`toMatchedFilter`), so faceting is by
label string, not by concept IRI.

Sorting: the UI offers date-created and name, ascending and descending
(`search-results.tsx`), and the code maps them to `YearCreatedStart` and
`Name.keyword` (`sortByToRawKeys`), but the `sort` array sent to
Elasticsearch is empty — the clause is commented out in `buildRequest`.
Results are therefore in relevance order whatever the user selects. The
`dateCreatedStart`/`dateCreatedEnd` aggregations are commented out as well;
the response schema defaults them to empty.

The response is validated with Zod (`rawSearchResponseWithAggregationsSchema`):
`hits.total.value`, `hits.hits[]._source['@id']`, and the six aggregations
with `buckets[].key` (string or number) and `doc_count`. A response missing
any of these fails the page.

## 5. Query 2: person autocomplete (`DatahubConstituentSearcher`)

`packages/api/src/enrichments/searcher-constituents-datahub.ts`, behind the
route `apps/researcher/src/app/[locale]/api/datahub/route.ts`. Used by the
enrichment forms to pick a constituent.

- Filter: `Type.keyword` = Person.
- `must`: `match_phrase_prefix` on `Name` with `slop: 2`.
- `sort`: `Name.keyword` ascending; `_source: ['@id', Name]`.
- Result: `{id: _source['@id'], name: _source[Name][0]}`.

So the index must also contain Person documents with at least `@id`, `Type`
and `Name` (array of strings) for this feature to work.

## 6. What the application fetches elsewhere after searching

The search returns IRIs only. Everything shown is then fetched from the
Triply SPARQL endpoint (`SPARQL_ENDPOINT_URL`) by three fetchers in
`packages/api/src`. A replacement index that is to remove SPARQL must carry
this data.

### 6.1 Heritage objects (`objects/fetcher.ts`)

`getByIds` (search result cards, object lists in communities) and `getById`
(detail page) both return `HeritageObject` (`packages/api/src/definitions.ts`):

| Field               | Type               | Read by                                   |
| ------------------- | ------------------ | ----------------------------------------- |
| `id`                | IRI                | everywhere                                |
| `name`              | string             | card, detail                              |
| `description`       | string             | detail                                    |
| `identifier`        | string             | detail                                    |
| `inscriptions`      | string[]           | detail                                    |
| `types`             | Term[] (id, name)  | detail                                    |
| `subjects`          | Term[]             | (fetched; not on detail page)             |
| `materials`         | Term[]             | detail                                    |
| `techniques`        | Term[]             | detail                                    |
| `creators`          | Agent[]            | detail                                    |
| `locationsCreated`  | Place[]            | detail                                    |
| `dateCreated`       | TimeSpan           | detail (formatted as a range)             |
| `images`            | Image[]            | card (first `contentUrl`), detail gallery |
| `mainEntityOfPage`  | URL                | detail ("view at provider")               |
| `isPartOf`          | Dataset            | card (`publisher.name`), detail (`publisher.id`, see 6.2) |

The search-result card (`apps/researcher/src/app/[locale]/objects/
heritage-object-card.tsx`) reads four things: `id`, `name`,
`images[0].contentUrl`, `isPartOf.publisher.name`. Labels are fetched per
locale (`FILTER(LANG(…))` in the SPARQL), so every `name` above is
locale-specific.

### 6.2 Organizations (`organizations/fetcher.ts`)

`getById(object.isPartOf.publisher.id)` on the detail page
(`objects/[id]/page.tsx`). Returns `Organization`: `id`, `name`, `url`,
`address` {`streetAddress`, `postalCode`, `addressLocality`,
`addressCountry`}. The page shows the name, the address, the URL, and
renders a map from the address (`map.tsx`).

### 6.3 Provenance events (`provenance-events/fetcher.ts`)

`getByHeritageObjectId(object.id)` on the detail page (`objects/[id]/
(provenance)/overview.tsx`). Returns `ProvenanceEvent[]`: `id`, `type`
(`acquisition` | `transferOfCustody`), `additionalTypes` Term[], `date`
TimeSpan, `transferredFrom` Agent, `transferredTo` Agent, `description`,
`location` Place, `startsAfter` and `endsBefore` (ids of other events, used
to order the timeline). Fetched as the object's `ex:subjectOf` resources.

## 7. Sawubona deployment values

Terraform (`devops`, `terraform/servers/enterprise/main.tf`) points
`SEARCH_ENDPOINT_URL` at the alias `sawubona` on Voyager
(`http://<voyager tailscale ip>:9200/sawubona`). Until Tabulous writes
documents, the search page and the person autocomplete return nothing and the
rest of the application runs.

## 8. Summary of what a replacement must provide, as the code stands

1. A `POST`-able `_search` URL with no authentication (network boundary is
   the tailnet).
2. HeritageObject documents with the twelve fields of section 3 under those
   exact names, `.keyword` sub-fields, and the four locale-suffixed fields.
3. Person documents with `@id`, `Type`, `Name[]`.
4. Either the SPARQL endpoint for section 6, or the same data inside the
   documents together with new fetcher code.

Items 2 and 3 are fixed by the current code, not by any requirement; changing
the field names is a small change in two `RawKeys` enums. The new-index
design should treat the names as free and the *behaviour* in sections 4–6 as
the requirement.
