import {ElasticClient} from './elastic-client';
import {afterEach, describe, expect, it, jest} from '@jest/globals';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ElasticClient', () => {
  const client = new ElasticClient({
    endpointUrl: 'http://voyager:9200/sawubona',
  });

  it('gets one document by URL-encoded id', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({found: true, _source: {id: 'x'}}), {
        status: 200,
      })
    );

    const source = await client.get('https://example.org/o/1');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://voyager:9200/sawubona/_doc/https%3A%2F%2Fexample.org%2Fo%2F1'
    );
    expect(source).toStrictEqual({id: 'x'});
  });

  it('returns undefined for a missing document', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({found: false}), {status: 404})
      );

    expect(await client.get('https://example.org/o/404')).toBeUndefined();
  });

  it('skips missing documents in mget and keeps order', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          docs: [
            {found: true, _source: {id: 'a'}},
            {found: false},
            {found: true, _source: {id: 'c'}},
          ],
        }),
        {status: 200}
      )
    );

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
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response('boom', {status: 500, statusText: 'Internal Server Error'})
      );

    await expect(client.search({})).rejects.toThrow('(500)');
  });
});
