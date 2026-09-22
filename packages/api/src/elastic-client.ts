// Sawubona: thin Elasticsearch HTTP client. Plain fetch, no client library.
//
// `endpointUrl` is the alias base URL, e.g. http://100.117.15.56:9200/sawubona
// (the datahub's SEARCH_ENDPOINT_URL). Paths are appended here:
//   /_search           search
//   /_doc/<id>         one document by _id (the resource IRI, URL-encoded)
//   /_mget             several documents by _id
// See docs/elasticsearch-mapping.md.
import {z} from 'zod';

const constructorOptionsSchema = z.object({
  endpointUrl: z.string().url(),
});

export type ElasticClientConstructorOptions = z.infer<
  typeof constructorOptionsSchema
>;

const getResponseSchema = z.object({
  found: z.boolean(),
  _source: z.record(z.unknown()).optional(),
});

const mgetResponseSchema = z.object({
  docs: z.array(getResponseSchema),
});

export class ElasticClient {
  private readonly endpointUrl: string;

  constructor(options: ElasticClientConstructorOptions) {
    const opts = constructorOptionsSchema.parse(options);
    this.endpointUrl = opts.endpointUrl.replace(/\/+$/, '');
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    // HTTP statuses that are a valid answer, not an error (e.g. 404 on GET)
    acceptStatuses: number[] = []
  ): Promise<T> {
    const response = await fetch(`${this.endpointUrl}${path}`, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: {'Content-Type': 'application/json'},
    });

    if (!response.ok && !acceptStatuses.includes(response.status)) {
      throw new Error(
        `Failed to retrieve information: ${response.statusText} (${response.status})`
      );
    }

    return response.json();
  }

  async search<T>(searchRequest: Record<string, unknown>): Promise<T> {
    return this.request<T>('POST', '/_search', searchRequest);
  }

  // Returns the document's _source, or undefined if there is no such document.
  async get(id: string): Promise<Record<string, unknown> | undefined> {
    const rawResponse = await this.request<unknown>(
      'GET',
      `/_doc/${encodeURIComponent(id)}`,
      undefined,
      [404]
    );
    const response = getResponseSchema.parse(rawResponse);

    return response.found ? response._source : undefined;
  }

  // Returns the _source of every document that exists, in request order.
  // Missing ids are skipped silently.
  async mget(ids: string[]): Promise<Record<string, unknown>[]> {
    if (ids.length === 0) {
      return [];
    }

    const rawResponse = await this.request<unknown>('POST', '/_mget', {ids});
    const response = mgetResponseSchema.parse(rawResponse);

    return response.docs
      .filter(doc => doc.found && doc._source !== undefined)
      .map(doc => doc._source!);
  }
}
