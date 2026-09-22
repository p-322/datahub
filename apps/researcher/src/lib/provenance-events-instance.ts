import {ProvenanceEvents} from '@colonial-collections/api';
import {env} from 'node:process';

const provenanceEvents = new ProvenanceEvents({
  elasticSearchEndpointUrl: env.SEARCH_ENDPOINT_URL as string,
});

export default provenanceEvents;
