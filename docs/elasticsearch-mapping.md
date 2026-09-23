# Sawubona search index: target mapping

The contract between Tabulous (writer) and the datahub (reader) for the
Elasticsearch on Voyager. With these two indices in place the datahub runs
without a SPARQL endpoint: every read path in the application that is not
Nanopublications, Wikidata, GeoNames, Clerk or Postgres is served from here.

`docs/elasticsearch-index.md` describes what the code reads today and is the
baseline this replaces. Field names below are new; the old predicate-IRI
names are not carried over (changing them is two `RawKeys` enums in
`packages/api`).

## 1. Indices and alias

| Index                  | One document per | `_id`          |
| ---------------------- | ---------------- | -------------- |
| `sawubona-objects-v1`  | heritage object  | the object IRI |
| `sawubona-persons-v1`  | constituent      | the person IRI |

Alias `sawubona` covers both. The datahub queries the alias only
(`SEARCH_ENDPOINT_URL = http://<voyager>:9200/sawubona`, the alias base URL;
the client appends `/_search`, `/_doc/<id>`, `/_mget`); each query
filters on `kind` so the two document types never mix in a result. Tabulous
reindexes by building `-v2` beside `-v1` and swapping the alias in one
`_aliases` call; the datahub never sees an empty index.

Settings for both: `number_of_shards: 1`, `number_of_replicas: 0`. Voyager is a
single node, and with the default of one replica the cluster would sit at
yellow forever.

Documents are looked up by id with an `ids` query on the alias, not with
`_doc/<id>` or `_mget`: those are single-index operations and Elasticsearch
refuses them against an alias that spans more than one index ("has more than
one index associated with it, can't execute a single index op"). `_id = IRI`
is therefore still a requirement — the `ids` query matches on `_id`.

## 2. Conventions

**Localized string.** Every label a user sees is an object keyed by locale:

```json
{"en": "Ceremonial mask", "nl": "Ceremonieel masker"}
```

The application picks `[locale]` and falls back to the other language when a
key is missing (the current SPARQL fetchers return `undefined` for a missing
language; the UI already copes with missing names).

**Thing.** `{id, name: <localized>, description?: <localized>}` — a concept,
place, term or agent reference. `id` is its IRI. Agents add
`type: "Person" | "Organization" | "Unknown"`.

**Time span.** `{id, edtf?, startDate?, endDate?}`. `edtf` is the source value
as Tabulous has it; `startDate`/`endDate` are the derived ISO 8601 bounds the
UI formats (`formatDateRange` in the app takes two dates). Uncertain or open
ranges leave a bound out.

**Payload vs. index.** Only the fields under `facets`, `search` and `sort` are
indexed. `object`, `organization` and `events` are stored in
`_source` with `"enabled": false` in the mapping: Elasticsearch keeps them
verbatim and never tokenizes them, so their shape can evolve without a
mapping change or a reindex. The datahub reads them, it never queries them.

## 3. `sawubona-objects-v1`

### 3.1 Indexed fields

```
id                            keyword         object IRI (same as _id)
kind                          keyword         constant "HeritageObject"

search.en                     text  (analyzer: english)
search.nl                     text  (analyzer: dutch)
                                              free-text target: name, description,
                                              inscriptions, term labels, creator
                                              names, identifier — per language

facets.types.en / .nl         keyword         object type labels
facets.subjects.en / .nl      keyword
facets.materials.en / .nl     keyword
facets.creators               keyword         agent names (not localized)
facets.publisher.en / .nl     keyword         owning institution name
facets.countriesCreated.en/.nl keyword
facets.yearCreatedStart       integer         derived from object.dateCreated
facets.yearCreatedEnd         integer                (kept for sorting)
facets.hasImage               boolean

facets.typesPath.en / .nl     keyword         the term and its thesaurus ancestors,
facets.subjectsPath.en / .nl  keyword         self-inclusive: an object catalogued
facets.materialsPath.en / .nl keyword         "hats" carries ["hats", "headgear", …],
facets.locationsCreatedPath.en/.nl keyword    "Java" carries ["Java", "Indonesia", …]

sort.name.en / .nl            keyword  (normalizer: lowercase, asciifolding)
```

### 3.1a Date fields the datahub derives at load time

Tabulous ships the museum's dating statement as EDTF in the payload
(`object.dateCreated.edtf`). The datahub reads it while loading and writes
these indexed fields; Tabulous emits none of them. The derivation is
`packages/api/src/edtf.ts`, the enrichment step is
`datahub/scripts/enrich-dates.ts`, and the same function formats the date on
the page, so a facet and a label cannot disagree.

```
facets.dateCreated            integer_range   inclusive years; a bound is OMITTED
                                              where the notation is open, which is
                                              what lets "../1887" answer a search
                                              from 1800 under `relation: intersects`
facets.datePrecision          keyword         day | month | season | year | decade |
                                              century | millennium | range | open —
                                              read from the notation, not from the
                                              width of the range: "11XX" is century
                                              precision, "1830/1860" is a range
facets.dateQualifier          keyword         exact | approximate | uncertain |
                                              approximateAndUncertain (EDTF ~ ? %)
facets.dateOpenness           keyword         closed | openStart | openEnd | unbounded
facets.centuries              short[]         first years of every century the date
                                              touches; 1800 is the 19th century
facets.decades                short[]         first years of every decade, but only
                                              for dates precise to a decade or finer
```

A century-precision date carries its century and no decades: "the twelfth
century" says nothing about the 1130s, and listing all ten would fill the
decade facet with objects nobody dated that finely.

The searcher facets on the `*Path` fields for types, subjects, materials and
locations (filter and aggregation both), so a filter on a broad term matches
the narrower ones and counts stay consistent. The facet UI is a flat list, so
ancestors and leaves appear side by side; a tree facet is the follow-up.

Everything that is a facet today is here under a plain name, localized where
its label is localized (today only four are; the SPARQL fetchers localize all
term labels, so all of them are localized here). `facets.creators` stays
unlocalized because a name is a name. `facets.hasImage` is new and cheap.

Room for what Tabulous can add without touching the application: further
`facets.<name>.<locale>` keyword fields become facets the moment the searcher
lists them; thesaurus hierarchy goes in as `facets.<name>Path.<locale>`,
a keyword array of ancestor labels (or IRIs) so a filter on a broad term
matches narrower ones. EDTF stays in the payload; the integer year bounds are
what range filters use.

### 3.2 Payload

`object` — the `HeritageObject` type in `packages/api/src/definitions.ts`,
with localized strings:

```
object.id                     IRI
object.identifier             string           institution's inventory number
object.name                   localized        the museum's title
object.nameFallback           localized        the object's kind, where there is no
                                               title; the UI renders it in the
                                               "no title" style, never as a title
object.description            localized
object.inscriptions           string[]
object.types                  Thing[]
object.subjects               Thing[]
object.materials              Thing[]
object.techniques             Thing[]
object.creators               Agent[]          Thing + type
object.locationsCreated       Place[]          Thing + isPartOf?: Place (chain)
object.dateCreated            TimeSpan
object.images                 [{id, contentUrl, license?: Thing}]
object.mainEntityOfPage       URL              the institution's own page
object.isPartOf               {id, name: localized, publisher: {id, name: localized, type}}
```

`organization` — the owning institution (`object.isPartOf.publisher`),
expanded so the detail page needs no second lookup:

```
organization.id               IRI
organization.type             "Organization"
organization.name             localized
organization.url              URL
organization.address          {streetAddress, postalCode,
                               addressLocality: localized, addressCountry: localized}
```

`events[]` — one entry per event the object is subject of. `type` is a
six-value discriminator mirroring the CRM class: `acquisition`,
`transferOfCustody`, `production`, `historicalEvent`, `destruction`,
`activity`. The datahub's provenance timeline shows the first two (the
`ProvenanceEvent` type); production events duplicate `object.creators`, the
rest wait for UI. Fields:

```
id                            IRI
type                          "acquisition" | "transferOfCustody"
additionalTypes               Thing[]
date                          TimeSpan
transferredFrom               Agent
transferredTo                 Agent
carriedOutBy                  Agent            makers, buyers, collectors
label                         localized
description                   localized
location                      Place
startsAfter                   IRI of another event in this array
endsBefore                    IRI of another event in this array
```

`startsAfter`/`endsBefore` are how the timeline orders undated events; they
must reference ids present in the same array.

### 3.3 Example

```json
{
  "id": "https://data.sawubona-commons.eu/objects/1234",
  "kind": "HeritageObject",
  "search": {
    "en": "Ceremonial mask Wooden mask with pigment … Museum X 1234",
    "nl": "Ceremonieel masker Houten masker met pigment … Museum X 1234"
  },
  "facets": {
    "types": {"en": ["mask"], "nl": ["masker"]},
    "subjects": {"en": ["ritual"], "nl": ["ritueel"]},
    "materials": {"en": ["wood", "pigment"], "nl": ["hout", "pigment"]},
    "techniques": {"en": ["carving"], "nl": ["houtsnijwerk"]},
    "creators": ["Unknown maker"],
    "publisher": {"en": ["Museum X"], "nl": ["Museum X"]},
    "countriesCreated": {"en": ["South Africa"], "nl": ["Zuid-Afrika"]},
    "yearCreatedStart": 1880,
    "yearCreatedEnd": 1899,
    "hasImage": true
  },
  "sort": {"name": {"en": "ceremonial mask", "nl": "ceremonieel masker"}},
  "object": {
    "id": "https://data.sawubona-commons.eu/objects/1234",
    "identifier": "1234",
    "name": {"en": "Ceremonial mask", "nl": "Ceremonieel masker"},
    "description": {"en": "Wooden mask with pigment …", "nl": "Houten masker met pigment …"},
    "inscriptions": [],
    "types": [{"id": "http://vocab.getty.edu/aat/300138758", "name": {"en": "mask", "nl": "masker"}}],
    "subjects": [{"id": "…", "name": {"en": "ritual", "nl": "ritueel"}}],
    "materials": [{"id": "…", "name": {"en": "wood", "nl": "hout"}}, {"id": "…", "name": {"en": "pigment", "nl": "pigment"}}],
    "techniques": [{"id": "…", "name": {"en": "carving", "nl": "houtsnijwerk"}}],
    "creators": [{"id": "…", "type": "Unknown", "name": {"en": "Unknown maker", "nl": "Onbekende maker"}}],
    "locationsCreated": [{"id": "…", "name": {"en": "KwaZulu-Natal", "nl": "KwaZoeloe-Natal"},
                          "isPartOf": {"id": "…", "name": {"en": "South Africa", "nl": "Zuid-Afrika"}}}],
    "dateCreated": {"id": "…", "edtf": "188X", "startDate": "1880-01-01", "endDate": "1889-12-31"},
    "images": [{"id": "…", "contentUrl": "https://images.example.org/1234.jpg",
                "license": {"id": "https://creativecommons.org/licenses/by/4.0/", "name": {"en": "CC BY 4.0", "nl": "CC BY 4.0"}}}],
    "mainEntityOfPage": "https://museum-x.example.org/collection/1234",
    "isPartOf": {"id": "…", "name": {"en": "Museum X collection", "nl": "Collectie Museum X"},
                 "publisher": {"id": "https://data.sawubona-commons.eu/organizations/museum-x", "type": "Organization",
                               "name": {"en": "Museum X", "nl": "Museum X"}}}
  },
  "organization": {
    "id": "https://data.sawubona-commons.eu/organizations/museum-x",
    "type": "Organization",
    "name": {"en": "Museum X", "nl": "Museum X"},
    "url": "https://museum-x.example.org/",
    "address": {"streetAddress": "Museumstraat 1", "postalCode": "1000 AA",
                "addressLocality": {"en": "Amsterdam", "nl": "Amsterdam"},
                "addressCountry": {"en": "Netherlands", "nl": "Nederland"}}
  },
  "provenanceEvents": [
    {"id": "…/events/1", "type": "acquisition", "additionalTypes": [{"id": "…", "name": {"en": "purchase", "nl": "aankoop"}}],
     "date": {"id": "…", "edtf": "1902", "startDate": "1902-01-01", "endDate": "1902-12-31"},
     "transferredFrom": {"id": "…", "type": "Person", "name": {"en": "J. Smith", "nl": "J. Smith"}},
     "transferredTo": {"id": "https://data.sawubona-commons.eu/organizations/museum-x", "type": "Organization",
                       "name": {"en": "Museum X", "nl": "Museum X"}},
     "description": {"en": "Bought at auction.", "nl": "Gekocht op een veiling."},
     "location": {"id": "…", "name": {"en": "London", "nl": "Londen"}}}
  ]
}
```

(The example shows year bounds 1880–1899 in `facets` and 1880–1889 in the
payload on purpose: `facets` are what filtering uses and may be widened by
Tabulous's EDTF interpretation; the payload keeps the source reading.
Tabulous decides one rule and applies it to both; the application does not
reconcile them.)

### 3.4 First delivery (Wereldmuseum, 2026-09): deviations accepted for now

The first index Tabulous produces (1,039,214 objects, 3.2 M events) differs
from the contract above in ways the datahub tolerates. Each is on the request
list for the next delivery; until then the effect on the datahub is as noted.

| Deviation | Effect on the datahub |
| --- | --- |
| `search.<locale>` is an array of arrays, one per source | none if Elasticsearch flattens on indexing (verify with one document before the full load) |
| `facets.yearCreatedStart/End` are strings (`"1911"`) | none; `integer` coerces. Do not set `coerce: false` |
| event `date` has no `id` | none; the datahub synthesises `<event id>#date` |
| event `additionalTypes` are bare AAT IRIs, no labels | the timeline cannot name the kind of event (purchase, gift, …) |
| one party per `transferredFrom`/`transferredTo`/`carriedOutBy` where the source has several | the timeline shows one party as if it were the only one (3.8% of maker-bearing objects; `object.creators` is complete) |
| no `startsAfter`/`endsBefore` | undated events (17%) sort to the end in arbitrary order |
| `facets.techniques` absent (no technique axis in the thesaurus) | none; the facet was never in the UI. Dropped from the mapping |
| `facets.subjects` mixes depicted subjects, places and cultures | one muddled facet; splitting into `subjects` / `placesDepicted` / `cultures` is agreed for a later delivery |
| `facets.countriesCreated.nl` holds English (M49) names | Dutch UI shows English country names |
| `nl` and `en` carry the same Dutch text except term labels | English UI shows Dutch titles and descriptions |
| no persons index yet (privacy decision pending on ~706 likely-living people) | constituent autocomplete returns nothing; the Wikidata autocomplete beside it works |

## 4. `sawubona-persons-v1`

```
id                            keyword         person IRI (same as _id)
kind                          keyword         constant "Person"
name                          text  (analyzer: standard)   — match_phrase_prefix target
name.keyword                  keyword         sort
person                        enabled: false  — payload: {id, type: "Person",
                                                name: localized, birthDate?: TimeSpan,
                                                birthPlace?: Place, deathDate?: TimeSpan,
                                                deathPlace?: Place}
```

Serves the constituent autocomplete only (`/api/datahub`). Object pages take
creators and provenance agents from the object document, not from here, so a
person missing from this index still shows on objects.

## 5. Queries the datahub will send

Object search, on the alias:

- `filter`: `kind = HeritageObject`; one `terms` on `facets.<f>.<locale>` per
  selected facet value; `range` on `facets.yearCreatedStart`/`End`.
- `must`: `simple_query_string` on `search.<locale>` (today it is unscoped and
  hits every field, including IRIs).
- `aggs`: `terms` on each `facets.<f>.<locale>`; sizes well below today's
  10,000.
- `sort`: `sort.name.<locale>` or `facets.yearCreatedStart`, both orders
  (today the sort is not sent at all).
- `_source`: `object.id`, `object.name`, `object.images`, `object.isPartOf`
  for cards — no second request.

Object detail: `_search` with `{"query": {"ids": {"values": ["<id>"]}}}` →
`object`, `organization`, `events`. Object lists: the same with several ids,
re-ordered client-side. Autocomplete: `match_phrase_prefix` on `name`,
`filter kind = Person`, sort `name.keyword`.

## 6. Application changes (done)

| Code                                              | Change                                                     |
| ------------------------------------------------- | ---------------------------------------------------------- |
| `packages/api/src/objects/searcher.ts`            | new field names; cards from `_source`; sort sent; scoped query |
| `packages/api/src/objects/fetcher.ts`             | SPARQL → `GET`/`_mget`, pick locale from localized strings |
| `packages/api/src/organizations/fetcher.ts`       | read `organization` from the object document; looked up by heritage object id (`getByHeritageObjectId`) |
| `packages/api/src/provenance-events/fetcher.ts`   | read `provenanceEvents` from the object document           |
| `packages/api/src/enrichments/searcher-constituents-datahub.ts` | new field names                             |
| `packages/api/src/*/rdf-helpers.ts`               | delete (`src/rdf-helpers.ts` stays for the Wikidata searcher) |
| `apps/researcher/src/lib/*-instance.ts`           | drop `sparqlEndpointUrl`                                   |
| Dockerfile, devops `main.tf`                      | drop `SPARQL_ENDPOINT_URL`                                 |

The `HeritageObject`, `Organization` and `ProvenanceEvent` types in
`definitions.ts` stay as they are; `index-documents.ts` holds the document
schemas and maps localized strings to the plain `name?: string` the UI
expects. `packages/api/src/__fixtures__/*-document.json` are example
documents of both kinds, used by the unit tests and by
`devops/scripts/es-indices.sh put-example`. The Elasticsearch settings and
mappings live in `devops/terraform/servers/voyager/elasticsearch/`.
