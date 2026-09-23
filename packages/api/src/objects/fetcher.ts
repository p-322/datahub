// Sawubona: heritage objects come from the sawubona-objects index (one
// document per object, _id = IRI), not from SPARQL. The same document also
// carries the owning organization and the provenance events, so the
// organizations and provenance-events fetchers reuse this class.
import {ElasticClient} from '../elastic-client';
import {localeSchema} from '../definitions';
import {
  ObjectDocument,
  objectDocumentSchema,
  toHeritageObject,
} from '../index-documents';
import {isIri} from '@p-322/iris';
import {z} from 'zod';

const constructorOptionsSchema = z.object({
  endpointUrl: z.string(),
});

export type ConstructorOptions = z.infer<typeof constructorOptionsSchema>;

const getByIdsOptionsSchema = z.object({
  locale: localeSchema,
  ids: z.array(z.string()),
});

export type GetByIdsOptions = z.input<typeof getByIdsOptionsSchema>;

const getByIdOptionsSchema = z.object({
  locale: localeSchema,
  id: z.string(),
});

export type GetByIdOptions = z.input<typeof getByIdOptionsSchema>;

export class HeritageObjectFetcher {
  private readonly client: ElasticClient;

  constructor(options: ConstructorOptions) {
    const opts = constructorOptionsSchema.parse(options);
    this.client = new ElasticClient({endpointUrl: opts.endpointUrl});
  }

  // The raw document, for callers that need more than the HeritageObject
  // (organization, provenance events). Undefined if not indexed.
  async getDocumentById(id: string): Promise<ObjectDocument | undefined> {
    if (!isIri(id)) {
      return undefined;
    }

    const source = await this.client.get(id);
    return source === undefined
      ? undefined
      : objectDocumentSchema.parse(source);
  }

  async getDocumentsByIds(ids: string[]): Promise<ObjectDocument[]> {
    const iris = ids.filter(isIri);
    const sources = await this.client.mget(iris);

    return sources.map(source => objectDocumentSchema.parse(source));
  }

  async getByIds(options: GetByIdsOptions) {
    const opts = getByIdsOptionsSchema.parse(options);

    if (opts.ids.length === 0) {
      return [];
    }

    const documents = await this.getDocumentsByIds(opts.ids);
    return documents.map(document => toHeritageObject(document, opts.locale));
  }

  async getById(options: GetByIdOptions) {
    const opts = getByIdOptionsSchema.parse(options);

    const document = await this.getDocumentById(opts.id);
    return document === undefined
      ? undefined
      : toHeritageObject(document, opts.locale);
  }
}
