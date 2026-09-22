import {Organizations} from '@colonial-collections/api';
import {env} from 'node:process';

const organizations = new Organizations({
  elasticSearchEndpointUrl: env.SEARCH_ENDPOINT_URL as string,
});

export default organizations;
