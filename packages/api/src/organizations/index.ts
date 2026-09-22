import {GetByHeritageObjectIdOptions, OrganizationFetcher} from './fetcher';
import {z} from 'zod';

const constructorOptionsSchema = z.object({
  elasticSearchEndpointUrl: z.string(),
});

export type OrganizationsConstructorOptions = z.infer<
  typeof constructorOptionsSchema
>;

// A small wrapper around 'OrganizationFetcher', to be in sync with
// 'objects/index.ts' and to allow for future expansion
export class Organizations {
  private readonly organizationFetcher: OrganizationFetcher;

  constructor(options: OrganizationsConstructorOptions) {
    const opts = constructorOptionsSchema.parse(options);

    this.organizationFetcher = new OrganizationFetcher({
      endpointUrl: opts.elasticSearchEndpointUrl,
    });
  }

  // The organization that holds the given heritage object.
  async getByHeritageObjectId(options: GetByHeritageObjectIdOptions) {
    return this.organizationFetcher.getByHeritageObjectId(options);
  }
}
