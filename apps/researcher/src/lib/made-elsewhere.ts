// Imported from the file, not from "@p-322/enricher": the package entry pulls
// in node:crypto, which the browser does not have, and this runs in
// ProvidedBy, a client component.
import {softwareToolIri} from '@p-322/enricher/src/definitions';

export interface MadeElsewhere {
  // What the page calls the other application: its host, e.g.
  // "app.colonialcollections.nl".
  name: string;
  // Where it links to, in the reader's language.
  url: string;
}

/**
 * Whether an enrichment was made with an application other than ours, and if
 * so what to call it and where to send the reader.
 *
 * Decided from the nanopublication's own `npx:wasCreatedWith`, not from a list
 * of known sources: anything not made with `softwareToolIri` is marked. One
 * that does not say what made it is not marked, since that would be a guess.
 *
 * The name is the host of that IRI as it stands, so
 * https://app.colonialcollections.nl/ reads "app.colonialcollections.nl".
 * Nothing is derived from it, so an application we have never heard of is
 * named by its own address.
 *
 * The link is the application's address with the reader's locale appended.
 * That is the one assumption here that is not general: the Colonial
 * Collections datahub's bare address redirects to its Dutch pages, so without
 * it an English reader lands in Dutch, but an application that does not use
 * locale paths would 404. Nothing deeper is linked to: that would mean
 * reproducing another application's URL scheme.
 */
export function madeElsewhere(
  createdWith: string | undefined,
  locale: string
): MadeElsewhere | undefined {
  if (!createdWith || createdWith === softwareToolIri) {
    return undefined;
  }

  let tool: URL;
  try {
    tool = new URL(createdWith);
  } catch {
    return undefined;
  }

  // An IRI that names an application without being an address for it (a
  // urn:, say) gives the reader nothing to follow.
  if (tool.protocol !== 'https:' && tool.protocol !== 'http:') {
    return undefined;
  }

  return {
    name: tool.hostname,
    url: new URL(locale, tool).toString(),
  };
}
