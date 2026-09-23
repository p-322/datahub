import {HeritageObjectSearcher} from './searcher';
import {SortBy, SortOrder} from '../definitions';
import {afterEach, describe, expect, it, jest} from '@jest/globals';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const objectDocument = JSON.parse(
  readFileSync(join(__dirname, '../__fixtures__/object-document.json'), 'utf8')
);

const emptyAggregation = {buckets: []};

function mockSearchResponse(body: unknown) {
  return jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify(body), {status: 200}));
}

const response = {
  hits: {
    total: {value: 1},
    hits: [{_source: objectDocument}],
  },
  aggregations: {
    types: {buckets: [{key: 'masker', doc_count: 1}]},
    subjects: emptyAggregation,
    locations: emptyAggregation,
    materials: {
      buckets: [
        {key: 'hout', doc_count: 1},
        {key: 'pigment', doc_count: 1},
      ],
    },
    creators: emptyAggregation,
    publishers: emptyAggregation,
    centuries: {buckets: [{key: 1800, doc_count: 1}]},
    decades: emptyAggregation,
    datePrecision: {buckets: [{key: 'range', doc_count: 1}]},
    dateOpenness: {buckets: [{key: 'openStart', doc_count: 1}]},
  },
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('search', () => {
  it('posts to the alias and builds cards from _source', async () => {
    const fetchMock = mockSearchResponse(response);
    const searcher = new HeritageObjectSearcher({
      endpointUrl: 'http://voyager:9200/sawubona',
    });

    const result = await searcher.search({
      locale: 'nl',
      query: 'masker',
      filters: {materials: ['hout'], dateCreatedStart: 1800},
      sortBy: SortBy.Name,
      sortOrder: SortOrder.Descending,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://voyager:9200/sawubona/_search');
    const body = JSON.parse(init!.body as string);

    expect(body.query.bool.must).toStrictEqual([
      {
        simple_query_string: {
          query: 'masker',
          fields: ['search.nl'],
          default_operator: 'and',
        },
      },
    ]);
    expect(body.query.bool.filter).toStrictEqual([
      {term: {kind: 'HeritageObject'}},
      {term: {'facets.materials.nl': 'hout'}},
      // Overlap against the range field, so an object whose start year is
      // unknown is not silently dropped by a "from" year.
      {range: {'facets.dateCreated': {gte: 1800, relation: 'intersects'}}},
    ]);
    expect(body.sort).toStrictEqual([
      {'sort.name.nl': {order: 'desc', missing: '_last'}},
    ]);
    expect(body.aggregations.creators).toStrictEqual({
      terms: {field: 'facets.creators', size: 10000},
    });
    expect(body.aggregations.publishers.terms.field).toBe(
      'facets.publisher.nl'
    );

    expect(result.totalCount).toBe(1);
    expect(result.heritageObjects).toHaveLength(1);
    expect(result.heritageObjects[0].name).toBe('Ceremonieel masker');
    expect(result.heritageObjects[0].images![0].contentUrl).toBe(
      'https://images.example.org/1234.jpg'
    );
    expect(result.heritageObjects[0].isPartOf!.publisher!.name).toBe(
      'Museum X'
    );
    expect(result.filters.materials).toStrictEqual([
      {id: 'hout', name: 'hout', totalCount: 1},
      {id: 'pigment', name: 'pigment', totalCount: 1},
    ]);
    // Date facets come back as the raw keys; the search page labels them.
    expect(result.filters.centuries).toStrictEqual([
      {id: 1800, name: 1800, totalCount: 1},
    ]);
    expect(result.filters.dateOpenness).toStrictEqual([
      {id: 'openStart', name: 'openStart', totalCount: 1},
    ]);
  });

  it('sorts by year by default and matches all without a query', async () => {
    const fetchMock = mockSearchResponse(response);
    const searcher = new HeritageObjectSearcher({
      endpointUrl: 'http://voyager:9200/sawubona/',
    });

    await searcher.search({locale: 'en'});

    const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(body.query.bool.must[0].simple_query_string.query).toBe('*');
    expect(body.sort).toStrictEqual([
      {'facets.yearCreatedStart': {order: 'asc', missing: '_last'}},
    ]);
  });
});
