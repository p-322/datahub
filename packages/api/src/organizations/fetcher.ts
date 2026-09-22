// Sawubona: the owning organization is embedded in the object's document in
// the sawubona-objects index (docs/elasticsearch-mapping.md), so it is looked
// up by heritage object id, not by organization id.
import {HeritageObjectFetcher} from '../objects/fetcher';
import {localeSchema} from '../definitions';
import {toOrganization} from '../index-documents';
import {z} from 'zod';

const constructorOptionsSchema = z.object({
  endpointUrl: z.string(),
});

export type ConstructorOptions = z.infer<typeof constructorOptionsSchema>;

const getByHeritageObjectIdOptionsSchema = z.object({
  locale: localeSchema,
  heritageObjectId: z.string(),
});

export type GetByHeritageObjectIdOptions = z.input<
  typeof getByHeritageObjectIdOptionsSchema
>;

export class OrganizationFetcher {
  private readonly heritageObjectFetcher: HeritageObjectFetcher;

  constructor(options: ConstructorOptions) {
    const opts = constructorOptionsSchema.parse(options);
    this.heritageObjectFetcher = new HeritageObjectFetcher({
      endpointUrl: opts.endpointUrl,
    });
  }

  async getByHeritageObjectId(options: GetByHeritageObjectIdOptions) {
    const opts = getByHeritageObjectIdOptionsSchema.parse(options);

    const document = await this.heritageObjectFetcher.getDocumentById(
      opts.heritageObjectId
    );
    return document === undefined
      ? undefined
      : toOrganization(document, opts.locale);
  }
}
