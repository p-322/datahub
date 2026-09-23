# Requests to Tabulous: the Sawubona search index

Changes the datahub needs in the documents Tabulous writes to the Elasticsearch
on Voyager. The document contract is `elasticsearch-mapping.md`; section 3.4
there records what the first delivery (Wereldmuseum, 1,039,214 objects,
September 2026) does differently and what the datahub tolerates. This file is
the queue of things we are asking to have changed, most valuable first.

Each request states what the datahub does with the data today, what it cannot
do, the encoding that would fix it, and — under **Then on our side** — the work
that falls to the datahub once it lands. That last part is written down so that
a delivery does not arrive months later with nobody remembering what it was
for. Figures come from sampling the delivered `objects.json`, and the sample
size is given wherever a number is quoted.

Applying any of these means a reindex: Tabulous emits a new file, we
`create 2`, load, `alias 2`, `delete 1` (about half an hour end to end, of
which ~28 minutes is the load).

| # | Request | Status |
| --- | --- | --- |
| 1 | Hierarchical path encoding for the `*Path` facets | agreed, building |
| 2 | Localize the `*Path` facet labels | agreed for types/materials/subjects; locations stay English |
| 3 | Event `additionalTypes` as objects with labels | agreed, needs a Getty fetch |
| 4 | Event parties as arrays | **withdrawn** — the premise was wrong; see below |
| 5 | Split `facets.subjects` into subjects / places / cultures | agreed, building |
| 6 | Flatten `search.<locale>` | on hold |
| 7 | Dutch names in `facets.countriesCreated.nl` | on hold |

Agreed sequence: 1 and 2 together, then 5, then 3 — three commits on their side,
**one delivery**, so the datahub reindexes once. Their pipeline's Temporal
workflow state was at 2.38 MB against a 2 MiB ceiling (since raised to 32 MiB)
and requests 1, 2 and 5 all add columns, so batching more than this is not free.

---

## 1. Hierarchical path encoding for the `*Path` facets

**What we want to build.** A tree in the facet modal: the user opens
"Materials", sees the handful of top-level Getty terms with counts, expands one
and sees its children with counts, and can filter at any level. Today that
modal offers an A–Z letter row instead, which is not a useful way into a
thesaurus with thousands of terms.

**Why we cannot build it from the current data.** The `*Path` fields are chains
written leaf-to-root and concatenated end to end, with no separator and with
ancestors repeated. An object catalogued with four materials:

```json
"materials":     {"nl": ["hout", "verf", "bamboe", "katoen"]},
"materialsPath": {"nl": [
  "wood (plant material)", "plant material", "biological material", "materials (substances)",
  "paint (coating)", "coating (material)", "materials (substances)",
  "bamboo (material)", "grass (plant material)", "plant material", "biological material", "materials (substances)",
  "cotton (textile)", "textile materials", "materials (substances)"
]}
```

Four chains are present, and nothing marks where one ends and the next begins.
A `terms` aggregation over that field returns a flat bag of labels. The
document counts per label are correct — a `terms` aggregation counts documents,
so the repeated `materials (substances)` does not inflate anything — but no
parent/child relationship survives. The edges are not in the index, so no
amount of work in the application recovers them.

**The encoding we are asking for.** Emit each ancestor level as its own keyword
whose value is the full path from the root, separated by `|`:

```json
"materialsPath": {"nl": [
  "materials (substances)",
  "materials (substances)|biological material",
  "materials (substances)|biological material|plant material",
  "materials (substances)|biological material|plant material|wood (plant material)",
  "materials (substances)|coating (material)",
  "materials (substances)|coating (material)|paint (coating)",
  "materials (substances)|biological material|plant material|grass (plant material)",
  "materials (substances)|biological material|plant material|grass (plant material)|bamboo (material)",
  "materials (substances)|textile materials",
  "materials (substances)|textile materials|cotton (textile)"
]}
```

Same information, same field, same mapping (`keyword`). What changes is that
every value carries its own ancestry.

**What that gives the datahub.**

A `terms` aggregation returns every node keyed by its full path, so the tree is
built by splitting keys on `|` — read off, not inferred. Counts stay correct at
every level.

Filtering keeps the roll-up behaviour the flat encoding already has: a filter
on `materials (substances)|biological material` matches every descendant,
because each descendant carries that exact value among its own. So "filter on a
broad term, get the narrow ones too" continues to work, and the count shown
next to a branch equals the number of results filtering on it produces.

Objects with several leaves behave correctly. Shared ancestors collapse into
one bucket by themselves, which the current encoding also manages, but here
without the ambiguity about which leaf an ancestor belongs to.

Levels can be fetched one at a time. A `terms` aggregation with
`"include": "materials \\(substances\\)\\|[^|]*"` returns only the children of
that node, so the modal loads a level per expansion instead of shipping every
bucket to the browser. The current flat field cannot do this, and the
aggregation is capped at 10,000 buckets to keep the response finite.

**On the separator: `|`, confirmed against the whole population.** We sampled;
Tabulous then checked every label in every source — AAT English 7,980, AAT
Dutch 7,887, WM thesaurus 23,165, GeoNames 9,645, M49 882, 49,559 in total —
and `|` occurs in none of them. (`/` occurs in three, `>` in 67, so neither was
usable.) Settled: `|`, which stays readable in a query string and in logs.

**Scope.** All four path facets: `typesPath`, `materialsPath`, `subjectsPath`,
`locationsCreatedPath`. The plain facets (`types`, `materials`, `subjects`,
`countriesCreated`) stay exactly as they are — they are what the Dutch
interface currently labels its facets with (see request 2).

**Then on our side.** Five pieces, in order.

`packages/api/src/objects/searcher.ts`: point the four thesaurus facets back at
their `*Path` fields, and return each bucket as `{path: string[], totalCount}`
by splitting the key on the separator instead of the bare label it returns
today. Add an optional `parentPath` to `SearchOptions` that renders as the
aggregation's `include` regex, so a request can ask for one level.

`packages/api/src/definitions.ts`: `SearchResultFilter` gains the path, or
grows a tree-shaped sibling — the flat facets (creators, publishers) keep using
the existing type.

`packages/list-store/src`: a `useTreeFacet` provider beside
`useSearchableMultiSelectFacet` (in `use-searchable-facet.tsx`), holding
expanded nodes and the children fetched per node.

`packages/ui/list/tree-facet.tsx`: a new component. Inside the modal it
replaces the A–Z letter row; the search box stays, because searching a
thesaurus by name is still how people find a term they already know.

`apps/researcher/src/app/[locale]/objects/search-results.tsx`: switch types,
subjects, materials and locations to the tree component. This also undoes the
interim fix — subjects is a flat searchable list today only because the plain
`MultiSelectFacet` rendered every bucket and swamped the page.

Until then the facets are flat searchable lists, which works but hides the
structure Tabulous went to the trouble of building.

---

## 2. Localize the `*Path` facet labels

All four `*Path` fields are byte-identical in `nl` and `en` in 100% of the
documents that carry them, across a 41,748-document sample (`typesPath` 25,135
documents, `materialsPath` 35,191, `subjectsPath` 10,926,
`locationsCreatedPath` 24,390). They carry English, because the hierarchy is
walked in AAT and GeoNames. The plain facets are properly localized over the
same sample: `types` differs between the locales in 98.4% of the documents that
have it, `materials` in 99.1%, `subjects` in 96.5%.

The datahub therefore facets on the plain fields for types, subjects and
materials, and loses the hierarchy roll-up to keep Dutch labels for Dutch
users. Locations still use `locationsCreatedPath`, because
`facets.countriesCreated` is English in both locales anyway (see request 7), so
nothing is lost there.

With Dutch labels in the path fields, all four facets can use the hierarchy and
the trade disappears. Worth doing together with request 1, since both touch the
same fields.

**Agreed, for three of the four.** `aat-ancestry.csv` carries `PrefLabelNl` for
7,887 of 8,078 concepts (97.6%), so `typesPath`, `materialsPath` and
`subjectsPath` become properly Dutch. `locationsCreatedPath` cannot: the place
names come from GeoNames and the tiers from M49, and neither source we hold has
a Dutch ladder. Locations therefore stay English in both locales — the same
situation as today, and the same as `facets.countriesCreated` (request 7).

**Keep emitting `.nl` for locations even though it holds English.** The searcher
asks for `facets.locationsCreatedPath.<locale>`; if the `nl` key were omitted
rather than duplicated, the Dutch facet would come back empty instead of merely
untranslated.

**Then on our side.** One line each in the `facetFields` table in
`packages/api/src/objects/searcher.ts`: types, subjects and materials move from
`facets.<name>` back to `facets.<name>Path`, and the comment explaining why we
gave up the hierarchy comes out. If request 1 lands first, this is the change
that lets the tree cover all four facets instead of locations alone.

---

## 3. Event `additionalTypes` as objects with labels

The contract asks for `Thing[]` (`{id, name: {nl, en}}`). The delivery sends
bare CURIE strings: `"additionalTypes": ["aat:300157782", "aat:300460427"]`.

The provenance timeline labels each event by its type term — "purchase",
"gift", "bequest". The datahub expands the CURIEs and matches them against the
AAT terms it knows from its own provenance vocabulary, which covers 42.9% of
the 133,119 `additionalTypes` values on timeline events in a 41,748-document
sample. Those render as translated labels. The other 57.1% render as nothing,
because there is no label to fall back on.

Sending `{id, name}` fixes the whole set — but not from the tables that exist.
Only 1 of the 30 AAT ids used as event types appears in `aat-ancestry.csv`,
which is built from the thesaurus alignment; the event-method vocabulary
(`aat:300417638` gift, `300417642` purchase, `300417641` bequest…) was never
fetched. The 29 English labels that do exist are hand-vendored in
`aat-terms.txt` with no generator and no check, which Tabulous tracks as T16.
No Dutch labels exist anywhere.

Agreed route: extend `make-aat-ancestry.ts` to fetch those 30 ids from Getty,
giving proper `{id, name: {nl, en}}`, rather than shipping the vendored English.

**Where it belongs: the terms/facets dataset, not the index dataset.** It is a
vocabulary rather than object data, and that is where the Getty fetch machinery
already lives. It also keeps a network dependency and its retries out of the
million-row index build, and out of the pipeline whose workflow state is the
one under pressure — thirty rows will never be what exhausts it there. From the
datahub's side the location makes no difference, as long as the labels reach
`events[].additionalTypes[]` in the index documents.

A cheaper partial alternative: the delivery already carries `event.label` on
52.9% of timeline events, with readable Dutch ("Verwerving: schenking",
"Pedigree: vroegere eigenaar"). The datahub could fall back to that, taking
labelled events from 43% to roughly 80% with no change on your side. We will do
that anyway; it does not remove the request.

**Then on our side.** The interim, which does not wait for this request:
`getTypeName` in `apps/researcher/src/app/[locale]/objects/[id]/(provenance)/
transform-events.tsx` falls back to `event.label` when no `additionalType`
resolves to a known term.

When labels do arrive, `packages/api/src/index-documents.ts` loses
`expandCurie` and the string branch of the `additionalTypes` union, which goes
back to plain `thingDocSchema[]`, and the label fallback becomes a fallback
rather than the main path.

---

## 4. Event parties as arrays — withdrawn

The premise was wrong, and the correction is worth recording because it was the
request argued hardest.

Acquisition and custody events are not truncated. Each source row is one party
and the party id is part of the event IRI, so an object bequeathed by two people
produces two acquisition events rather than one with a party dropped. Checked
against 10,379 documents: 93.4% carry more than one acquisition event, and 180
of them carry two that share both a date and an `additionalTypes` set — those
are the multi-party transactions, present in full:

```
object 166532
  1994        ['aat:300157782','aat:300417641']   from: F.E. Rosenbaum c.n.
  1994        ['aat:300157782','aat:300417641']   from: L. Elhorst
  1994-01-24  ['aat:300417641']                   to:   Stichting NMVW
```

Only production events truncate — one maker where an object has several, 11,040
objects (T19). That does not justify changing `ProvenanceEvent`, so this request
is withdrawn; a `partial` flag on production events when T19 lands is the
proportionate fix, and Tabulous has it queued.

It does leave the datahub with a display problem of its own making: the object
above is one bequest that renders as three timeline rows. The existing grouping
by formatted date puts all three under "1994", but within that group the same
event type appears twice with different parties. Merging same-type same-date
events into one row naming both parties is our work, not theirs.

**Then on our side.** `transferredFrom`, `transferredTo` and `carriedOutBy`
become arrays in `eventDocSchema` and in `ProvenanceEvent`
(`packages/api/src/definitions.ts`), which is a breaking change to a type the
provenance UI reads directly, so `transform-events.tsx` and `data-table.tsx`
both change to render several parties per role. If we get the `partial` flag
instead of arrays, the schema is untouched and only the UI changes, to add the
"and others" note.

---

## 5. Split `facets.subjects` into subjects, places depicted and cultures

Logged in your handoff as T18: the facet mixes four thesaurus schemes, about a
third places (`Indonesië`, `Amsterdam`) and a fifth cultures. As one facet it
is hard to use and hard to label honestly.

Field names we would use: `facets.subjects` (what is depicted),
`facets.placesDepicted`, `facets.cultures`, each with its `*Path` counterpart
under the same naming. Agreed: `InSchemeLabel` is already in `terms.csv`, so it
is a column-map addition and three facets where there was one.

**Then on our side.** Two new facets threaded through four places: the
`facetFields` table and the filters schema in
`packages/api/src/objects/searcher.ts`, the `filters` shape in
`packages/api/src/objects/definitions.ts`, and both the `filterSettings` and
`facets` arrays in `search-results.tsx`. Plus `placesDepictedFilter` and
`culturesFilter` labels in `apps/researcher/src/messages/en` and `/nl`. No new
components — they are ordinary facets, or tree facets if request 1 has
landed.

---

## 6. Flatten `search.<locale>`

`search.nl` and `search.en` arrive as arrays of arrays, one inner array per
source:

```json
"search": {"nl": [["BESCHILDERDE EN GEVLOCHTEN HOED … TM-0-1 1"], ["Maluku"], ["hoeden"], ["plantenvezel"], [], []]}
```

This works: Elasticsearch flattens nested arrays when indexing a `text` field,
and we verified free-text search against the loaded index (`count-term 1 nl
hoed` returns 1). So there is nothing broken to fix.

It is on the list because a consumer should not have to know that flattening
happens, and the next consumer may not check. A single flat array of strings
per locale says what is meant.

On hold. Flattening would cost another million-row fan-out in the pipeline for
something already verified to work and never read back, which is not a trade
worth making while the workflow state budget is tight.

**Then on our side.** Nothing. The datahub never reads `search` — it only
queries it — so this one changes no code here. It is a request about the
contract being honest, not about unblocking us.

---

## 7. Dutch names in `facets.countriesCreated.nl`

`facets.countriesCreated` is identical in `nl` and `en` in all 23,936
documents that carry it, in the same 41,748-document sample: M49 English
names, so the Dutch interface offers
"Indonesia", "South Africa", "Netherlands". GeoNames carries Dutch alternate
names for countries.

Small, and cosmetic next to the rest — but it is the facet most visible on the
search page.

On hold. The GeoNames dump's `alternatenames` column has no language tags, and
the language-tagged data is in GeoNames' separate `alternateNames` file, which
the pipeline does not fetch. The cheapest honest fix is a 189-row hand-kept
Dutch country table, in the pattern of `organizations.csv` — worth doing, not
worth blocking a delivery for.

**Then on our side.** Nothing: the searcher already asks for
`facets.countriesCreated.<locale>`, so Dutch values simply start appearing. It
would also remove the reason locations are the one facet allowed to use its
`*Path` field today (request 2).

---

## Not requests

Three things from the handoff that we are not asking you to change.

`facets.techniques` is absent because the thesaurus has no technique axis. The
datahub never had a technique facet; the field is out of our mapping.

Event ordering (`startsAfter`, `endsBefore`) is not emitted because nothing in
the source expresses order, and 17% of events are undated. Accepted: undated
events sort to the end of the timeline in arbitrary order, which is a fact
about the data rather than a defect.

Titles are in capitals in 60.1% of the 41,748-document sample
("BESCHILDERDE EN GEVLOCHTEN HOED VAN PLANTAARDIGE VEZEL"). That is how the
museum catalogued them, so it is not yours to fix; how the datahub presents
them is ours to decide.
