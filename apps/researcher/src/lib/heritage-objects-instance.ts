import {HeritageObjects} from '@colonial-collections/api';
import {env} from 'node:process';

// Sawubona: SEARCH_ENDPOINT_URL is the Elasticsearch alias base URL
// (http://<voyager>:9200/sawubona); everything object-related reads from it.
const heritageObjects = new HeritageObjects({
  elasticSearchEndpointUrl: env.SEARCH_ENDPOINT_URL as string,
});

export default heritageObjects;
