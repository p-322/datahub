import {ProvenanceEvents} from '@p-322/api';
import {env} from 'node:process';

const provenanceEvents = new ProvenanceEvents({
  elasticSearchEndpointUrl: env.SEARCH_ENDPOINT_URL as string,
});

export default provenanceEvents;
