import {env} from 'node:process';

/**
 * The licence every community enrichment is published under.
 *
 * Deliberately not prefixed `NEXT_PUBLIC_`. That prefix marks a value Next
 * inlines into the client bundle while building, and only for
 * `process.env.NEXT_PUBLIC_X` written as a dot access in code that reaches
 * the browser. This is a lookup on `node:process`, imported by three server
 * actions and by nothing the browser runs, so it has to be present in the
 * environment of the running container — which is a different place from the
 * image's build stage, and easy to mistake for the same one when the name
 * says otherwise.
 */
const licence = env['COMMUNITY_ENRICHMENT_LICENSE'];

if (!licence) {
  throw new Error(
    'COMMUNITY_ENRICHMENT_LICENSE is not set. Community enrichments carry it ' +
      'as their licence, so a nanopublication cannot be published without ' +
      'one. Set it in the environment: the CC BY 4.0 URL is what the image ' +
      'builds with.'
  );
}

export const enrichmentLicence = licence;
