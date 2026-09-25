import {
  EnrichmentCreator,
  HeritageObjectEnrichmentFetcher,
  NanopubClient,
  ProvenanceEventEnrichmentFetcher,
  LocalContextsNoticesEnrichmentFetcher,
} from '@p-322/enricher';
import {env} from 'node:process';

// Community enrichments come from Nanopublications — a third-party service
// the datahub does not control. Reading them must never be able to take a page
// down: the object detail page, the provenance timeline and the local contexts
// notices all await an enrichment fetch outside any try/catch, so an unset
// endpoint (`TypeError: Failed to parse URL from `), a refused connection, an
// error response or a hang would each turn the whole page into a 500.
//
// The fetchers below therefore degrade to "no enrichments to show", which is
// what they already return when a resource has none, and which every call site
// handles. Failures are logged so they are visible in the journal.
const nanopubSparqlEndpointUrl = env.NANOPUB_SPARQL_ENDPOINT_URL ?? '';

export const enrichmentsAreConfigured = nanopubSparqlEndpointUrl !== '';

// A slow nanopub server would otherwise hold the page render open.
const timeoutInMilliseconds = 5000;

type EnrichmentFetcher = {getById: (id: string) => Promise<unknown>};

function resilient<T extends EnrichmentFetcher>(name: string, create: () => T) {
  const fetcher = enrichmentsAreConfigured ? create() : undefined;

  const getById = async (id: string) => {
    if (fetcher === undefined) {
      return undefined;
    }

    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        fetcher.getById(id),
        new Promise<undefined>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(new Error(`timed out after ${timeoutInMilliseconds}ms`)),
            timeoutInMilliseconds
          );
        }),
      ]);
    } catch (err) {
      console.error(
        `${name}: could not fetch enrichments for "${id}"; showing none.`,
        err
      );
      return undefined;
    } finally {
      clearTimeout(timer);
    }
  };

  return {getById} as unknown as T;
}

export const heritageObjectEnrichmentFetcher =
  resilient<HeritageObjectEnrichmentFetcher>(
    'HeritageObjectEnrichmentFetcher',
    () =>
      new HeritageObjectEnrichmentFetcher({
        endpointUrl: nanopubSparqlEndpointUrl,
      })
  );

export const provenanceEventEnrichmentFetcher =
  resilient<ProvenanceEventEnrichmentFetcher>(
    'ProvenanceEventEnrichmentFetcher',
    () =>
      new ProvenanceEventEnrichmentFetcher({
        endpointUrl: nanopubSparqlEndpointUrl,
      })
  );

export const localContextsNoticesEnrichmentFetcher =
  resilient<LocalContextsNoticesEnrichmentFetcher>(
    'LocalContextsNoticesEnrichmentFetcher',
    () =>
      new LocalContextsNoticesEnrichmentFetcher({
        endpointUrl: nanopubSparqlEndpointUrl,
      })
  );

// Writing is user-initiated and must not be swallowed: if someone submits an
// enrichment while the endpoint or the key is unset, or the registry is down,
// that has to surface as an error rather than as a save that silently did
// nothing.
//
// `?? ''` because the client validates its options with Zod at construction,
// which happens when this module is imported: an *unset* variable would throw
// there and take down every page that imports this file, before anyone has
// tried to write anything. An empty string defers the failure to the attempt.
export const creator = new EnrichmentCreator({
  nanopubClient: new NanopubClient({
    endpointUrl: env.NANOPUB_WRITE_ENDPOINT_URL ?? '',
    privateKey: env.NANOPUB_PRIVATE_KEY ?? '',
  }),
});
