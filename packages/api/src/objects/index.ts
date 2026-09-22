import {
  GetByIdOptions,
  GetByIdsOptions,
  HeritageObjectFetcher,
} from './fetcher';
import {HeritageObjectSearcher, SearchOptions} from './searcher';
import {z} from 'zod';

// Re-export definitions for ease of use in consuming apps
export * from './definitions';

// Sawubona: everything comes from the Elasticsearch alias (search, get, mget);
// there is no SPARQL endpoint any more.
const constructorOptionsSchema = z.object({
  elasticSearchEndpointUrl: z.string(),
});

export type HeritageObjectsConstructorOptions = z.infer<
  typeof constructorOptionsSchema
>;

export class HeritageObjects {
  private readonly heritageObjectFetcher: HeritageObjectFetcher;
  private readonly heritageObjectSearcher: HeritageObjectSearcher;

  constructor(options: HeritageObjectsConstructorOptions) {
    const opts = constructorOptionsSchema.parse(options);

    this.heritageObjectFetcher = new HeritageObjectFetcher({
      endpointUrl: opts.elasticSearchEndpointUrl,
    });
    this.heritageObjectSearcher = new HeritageObjectSearcher({
      endpointUrl: opts.elasticSearchEndpointUrl,
    });
  }

  async getById(options: GetByIdOptions) {
    return this.heritageObjectFetcher.getById(options);
  }

  async getByIds(options: GetByIdsOptions) {
    return this.heritageObjectFetcher.getByIds(options);
  }

  async search(options?: SearchOptions) {
    return this.heritageObjectSearcher.search(options);
  }
}
