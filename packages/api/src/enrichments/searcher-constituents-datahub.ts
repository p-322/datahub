// Sawubona: constituent autocomplete over the sawubona-persons index
// (docs/elasticsearch-mapping.md §4). Queried through the alias; the `kind`
// filter keeps object documents out.
import {searchOptionsSchema, SearchOptions, SearchResult} from './definitions';
import {ElasticClient} from '../elastic-client';
import {personDocumentSchema, toPersonThing} from '../index-documents';
import {z} from 'zod';

const constructorOptionsSchema = z.object({
  endpointUrl: z.string(),
});

export type DatahubConstituentSearcherConstructorOptions = z.infer<
  typeof constructorOptionsSchema
>;

const rawSearchResponseSchema = z.object({
  hits: z.object({
    hits: z.array(
      z.object({
        _source: personDocumentSchema,
      })
    ),
  }),
});

export class DatahubConstituentSearcher {
  private readonly client: ElasticClient;

  constructor(options: DatahubConstituentSearcherConstructorOptions) {
    const opts = constructorOptionsSchema.parse(options);
    this.client = new ElasticClient({endpointUrl: opts.endpointUrl});
  }

  private buildRequest(options: z.output<typeof searchOptionsSchema>) {
    return {
      size: options.limit,
      sort: [{'name.keyword': 'asc'}],
      _source: ['id', 'person'],
      query: {
        bool: {
          must: [
            {
              match_phrase_prefix: {
                name: {
                  query: options.query,
                  slop: 2, // E.g. "van Westen 't" matches "Karel van 't Westen"
                },
              },
            },
          ],
          filter: [{term: {kind: 'Person'}}],
        },
      },
    };
  }

  async search(options: SearchOptions) {
    const opts = searchOptionsSchema.parse(options);

    const rawResponse = await this.client.search<unknown>(
      this.buildRequest(opts)
    );
    const response = rawSearchResponseSchema.parse(rawResponse);

    const searchResult: SearchResult = {
      things: response.hits.hits.map(hit =>
        toPersonThing(hit._source, opts.locale)
      ),
    };

    return searchResult;
  }
}
