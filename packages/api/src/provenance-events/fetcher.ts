// Sawubona: provenance events are embedded in the object's document in the
// sawubona-objects index (docs/elasticsearch-mapping.md).
import {HeritageObjectFetcher} from '../objects/fetcher';
import {localeSchema} from '../definitions';
import {toProvenanceEvents} from '../index-documents';
import {z} from 'zod';

const constructorOptionsSchema = z.object({
  endpointUrl: z.string(),
});

export type ConstructorOptions = z.infer<typeof constructorOptionsSchema>;

const getByIdOptionsSchema = z.object({
  locale: localeSchema,
  id: z.string(),
});

export type GetByIdOptions = z.input<typeof getByIdOptionsSchema>;

export class ProvenanceEventsFetcher {
  private readonly heritageObjectFetcher: HeritageObjectFetcher;

  constructor(options: ConstructorOptions) {
    const opts = constructorOptionsSchema.parse(options);
    this.heritageObjectFetcher = new HeritageObjectFetcher({
      endpointUrl: opts.endpointUrl,
    });
  }

  // Undefined if the object is not indexed; an empty array if it has no events.
  async getByHeritageObjectId(options: GetByIdOptions) {
    const opts = getByIdOptionsSchema.parse(options);

    const document = await this.heritageObjectFetcher.getDocumentById(opts.id);
    return document === undefined
      ? undefined
      : toProvenanceEvents(document, opts.locale);
  }
}
