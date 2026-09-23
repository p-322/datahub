// Sawubona: thin Elasticsearch HTTP client. Plain fetch, no client library.
//
// `endpointUrl` is the alias base URL, e.g. http://100.117.15.56:9200/sawubona
// (the datahub's SEARCH_ENDPOINT_URL). Everything goes through `<base>/_search`.
//
// Reads by id use an `ids` query rather than `_doc/<id>` or `_mget`: those are
// single-index operations, and the alias deliberately spans two indices
// (objects and persons), which Elasticsearch refuses with "has more than one
// index associated with it, can't execute a single index op". An `ids` query
// matches on `_id` across every index behind the alias.
// See docs/elasticsearch-mapping.md.
import {z} from 'zod';

const constructorOptionsSchema = z.object({
  endpointUrl: z.string().url(),
});

export type ElasticClientConstructorOptions = z.infer<
  typeof constructorOptionsSchema
>;

const hitsResponseSchema = z.object({
  hits: z.object({
    hits: z.array(
      z.object({
        _id: z.string(),
        _source: z.record(z.unknown()),
      })
    ),
  }),
});

export class ElasticClient {
  private readonly endpointUrl: string;

  constructor(options: ElasticClientConstructorOptions) {
    const opts = constructorOptionsSchema.parse(options);
    this.endpointUrl = opts.endpointUrl.replace(/\/+$/, '');
  }

  async search<T>(searchRequest: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.endpointUrl}/_search`, {
      method: 'POST',
      body: JSON.stringify(searchRequest),
      headers: {'Content-Type': 'application/json'},
    });

    if (!response.ok) {
      throw new Error(
        `Failed to retrieve information: ${response.statusText} (${response.status})`
      );
    }

    return response.json();
  }

  // Returns the document's _source, or undefined if there is no such document.
  async get(id: string): Promise<Record<string, unknown> | undefined> {
    const documents = await this.mget([id]);
    return documents[0];
  }

  // Returns the _source of every document that exists, in the order asked for.
  // Missing ids are skipped silently.
  async mget(ids: string[]): Promise<Record<string, unknown>[]> {
    if (ids.length === 0) {
      return [];
    }

    const rawResponse = await this.search<unknown>({
      query: {ids: {values: ids}},
      size: ids.length,
    });
    const response = hitsResponseSchema.parse(rawResponse);

    // Elasticsearch returns hits in score order; restore the caller's order.
    const sourcesById = new Map(
      response.hits.hits.map(hit => [hit._id, hit._source])
    );

    return ids
      .map(id => sourcesById.get(id))
      .filter(
        (source): source is Record<string, unknown> => source !== undefined
      );
  }
}
