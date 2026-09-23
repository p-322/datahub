import {ElasticClient} from './elastic-client';
import {afterEach, describe, expect, it, jest} from '@jest/globals';

afterEach(() => {
  jest.restoreAllMocks();
});

function mockResponse(body: unknown, init: ResponseInit = {status: 200}) {
  return jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify(body), init));
}

function hits(sources: {_id: string; [k: string]: unknown}[]) {
  return {
    hits: {
      hits: sources.map(({_id, ...source}) => ({
        _id,
        _source: {id: _id, ...source},
      })),
    },
  };
}

describe('ElasticClient', () => {
  const client = new ElasticClient({
    endpointUrl: 'http://voyager:9200/sawubona',
  });

  it('searches the alias', async () => {
    const fetchMock = mockResponse({hits: {hits: []}});

    await client.search({query: {match_all: {}}});

    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://voyager:9200/sawubona/_search'
    );
  });

  it('gets one document with an ids query, not _doc (the alias spans two indices)', async () => {
    const fetchMock = mockResponse(hits([{_id: 'https://example.org/o/1'}]));

    const source = await client.get('https://example.org/o/1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://voyager:9200/sawubona/_search');
    expect(JSON.parse(init!.body as string)).toStrictEqual({
      query: {ids: {values: ['https://example.org/o/1']}},
      size: 1,
    });
    expect(source).toStrictEqual({id: 'https://example.org/o/1'});
  });

  it('returns undefined for a missing document', async () => {
    mockResponse(hits([]));

    expect(await client.get('https://example.org/o/404')).toBeUndefined();
  });

  it('keeps the requested order and skips missing documents', async () => {
    // Elasticsearch returns c before a; b does not exist.
    mockResponse(hits([{_id: 'c'}, {_id: 'a'}]));

    expect(await client.mget(['a', 'b', 'c'])).toStrictEqual([
      {id: 'a'},
      {id: 'c'},
    ]);
  });

  it('does not call out for an empty mget', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch');

    expect(await client.mget([])).toStrictEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws on an error status', async () => {
    mockResponse('boom', {status: 500, statusText: 'Internal Server Error'});

    await expect(client.search({})).rejects.toThrow('(500)');
  });

  it('trims a trailing slash from the endpoint', async () => {
    const fetchMock = mockResponse({hits: {hits: []}});
    const trailing = new ElasticClient({
      endpointUrl: 'http://voyager:9200/sawubona/',
    });

    await trailing.search({});

    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://voyager:9200/sawubona/_search'
    );
  });
});
