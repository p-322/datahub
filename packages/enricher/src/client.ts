import {creatorSchema, nanopubAgentIri, nanopubAgentName} from './definitions';
import type * as RDF from '@rdfjs/types';
// Namespaced on purpose: this library exports a `NanopubClient` of its own,
// and the two would be indistinguishable at the call site below.
import * as nanopubJs from '@nanopub/nanopub-js';
import {DataFactory} from 'rdf-data-factory';
import rdfSerializer from 'rdf-serialize';
import {RdfStore} from 'rdf-stores';
import streamToString from 'stream-to-string';
import {z} from 'zod';

const DF = new DataFactory();

export const nanopubTempIri = 'http://purl.org/nanopub/temp/temp-nanopub-id/';
export const nanopubId = DF.namedNode(nanopubTempIri);

const headGraph = DF.namedNode(`${nanopubTempIri}Head`);
const publicationGraph = DF.namedNode(`${nanopubTempIri}pubinfo`);
const assertionGraph = DF.namedNode(`${nanopubTempIri}assertion`);
const provenanceGraph = DF.namedNode(`${nanopubTempIri}provenance`);

const constructorOptionsSchema = z.object({
  // The Nanopub Registry to publish to. Empty disables publishing: an
  // enrichment submitted while it is unset fails with a clear error rather
  // than silently going nowhere.
  endpointUrl: z.string(),
  // The signing key, base64 of the PKCS#8 DER, on one line. Empty disables
  // publishing for the same reason.
  privateKey: z.string(),
});

export type NanopubClientConstructorOptions = z.infer<
  typeof constructorOptionsSchema
>;

const addOptionsSchema = z.object({
  assertionStore: z.instanceof(RdfStore<number>),
  publicationStore: z.instanceof(RdfStore<number>),
  creator: creatorSchema,
});

export type AddOptions = z.infer<typeof addOptionsSchema>;

const saveOptionsSchema = z.object({
  store: z.instanceof(RdfStore<number>),
});

type SaveOptions = z.infer<typeof saveOptionsSchema>;

export type Nanopub = {
  id: string;
};

// Low-level client for storing enrichments
// You should use the high-level EnrichmentCreator in most cases
export class NanopubClient {
  private readonly endpointUrl: string;
  private readonly privateKey: string;

  constructor(options: NanopubClientConstructorOptions) {
    const opts = constructorOptionsSchema.parse(options);

    this.endpointUrl = opts.endpointUrl;
    this.privateKey = opts.privateKey;
  }

  /**
   * Sign the assembled nanopublication and publish it to the Registry.
   *
   * Signing happens here, in this process, with the key from
   * `NANOPUB_PRIVATE_KEY`. It used to happen in a signing proxy we ran on
   * fly.io, which held the key and was handed the TriG over HTTP; nanopub-js
   * does the same work without a service in between.
   *
   * The key check is left on its default, which warns when nothing on the
   * network introduces this key rather than refusing to sign. The test
   * registry enforces no trust at all, so refusing would block the only
   * environment we can exercise before the key is endorsed in production.
   */
  private async save(options: SaveOptions) {
    const opts = saveOptionsSchema.parse(options);

    if (this.endpointUrl === '' || this.privateKey === '') {
      throw new Error(
        'Cannot publish a nanopublication: NANOPUB_WRITE_ENDPOINT_URL or NANOPUB_PRIVATE_KEY is not set'
      );
    }

    const quadStream = opts.store.match(); // All quads
    const dataStream = rdfSerializer.serialize(quadStream, {
      contentType: 'application/trig',
    });
    const trig = await streamToString(dataStream);

    const nanopub = nanopubJs.NanopubClass.fromRdf(trig, 'trig', {
      privateKey: this.privateKey,
      name: nanopubAgentName,
      orcid: nanopubAgentIri,
    });

    await nanopub.sign();
    const {uri} = await nanopub.publish(this.endpointUrl);

    return uri;
  }

  async add(options: AddOptions) {
    const opts = addOptionsSchema.parse(options);

    const assertionStore = opts.assertionStore;
    const publicationStore = opts.publicationStore;
    const primaryStore = RdfStore.createDefault();

    // Head graph
    primaryStore.addQuad(
      DF.quad(
        nanopubId,
        DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        DF.namedNode('http://www.nanopub.org/nschema#Nanopublication'),
        headGraph
      )
    );
    primaryStore.addQuad(
      DF.quad(
        nanopubId,
        DF.namedNode('http://www.nanopub.org/nschema#hasAssertion'),
        assertionGraph,
        headGraph
      )
    );
    primaryStore.addQuad(
      DF.quad(
        nanopubId,
        DF.namedNode('http://www.nanopub.org/nschema#hasProvenance'),
        provenanceGraph,
        headGraph
      )
    );
    primaryStore.addQuad(
      DF.quad(
        nanopubId,
        DF.namedNode('http://www.nanopub.org/nschema#hasPublicationInfo'),
        publicationGraph,
        headGraph
      )
    );

    // Provenance graph
    const assertingActivityNode = DF.namedNode(
      `${nanopubTempIri}asserting-activity`
    );
    const userNode = DF.namedNode(opts.creator.id);

    primaryStore.addQuad(
      DF.quad(
        assertingActivityNode,
        DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        DF.namedNode('http://www.w3.org/ns/prov#Activity'),
        provenanceGraph
      )
    );
    primaryStore.addQuad(
      DF.quad(
        assertionGraph,
        DF.namedNode('http://www.w3.org/ns/prov#wasGeneratedBy'),
        assertingActivityNode,
        provenanceGraph
      )
    );
    primaryStore.addQuad(
      DF.quad(
        assertionGraph,
        DF.namedNode('http://www.w3.org/ns/prov#wasAttributedTo'),
        userNode,
        provenanceGraph
      )
    );
    primaryStore.addQuad(
      DF.quad(
        userNode,
        DF.namedNode('http://www.w3.org/2000/01/rdf-schema#label'),
        DF.literal(opts.creator.name),
        provenanceGraph
      )
    );

    // The group that a creator speaks on behalf of
    if (opts.creator.isPartOf !== undefined) {
      const qualifiedDelegationNode = DF.namedNode(
        `${nanopubTempIri}delegation`
      );
      const communityNode = DF.namedNode(opts.creator.isPartOf.id);

      primaryStore.addQuad(
        DF.quad(
          userNode,
          DF.namedNode('http://www.w3.org/ns/prov#actedOnBehalfOf'),
          communityNode,
          provenanceGraph
        )
      );
      primaryStore.addQuad(
        DF.quad(
          userNode,
          DF.namedNode('http://www.w3.org/ns/prov#qualifiedDelegation'),
          qualifiedDelegationNode,
          provenanceGraph
        )
      );
      primaryStore.addQuad(
        DF.quad(
          qualifiedDelegationNode,
          DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          DF.namedNode('http://www.w3.org/ns/prov#Delegation'),
          provenanceGraph
        )
      );
      primaryStore.addQuad(
        DF.quad(
          qualifiedDelegationNode,
          DF.namedNode('http://www.w3.org/ns/prov#agent'),
          communityNode,
          provenanceGraph
        )
      );
      primaryStore.addQuad(
        DF.quad(
          qualifiedDelegationNode,
          DF.namedNode('http://www.w3.org/ns/prov#hadActivity'),
          assertingActivityNode,
          provenanceGraph
        )
      );
      primaryStore.addQuad(
        DF.quad(
          communityNode,
          DF.namedNode('http://www.w3.org/2000/01/rdf-schema#label'),
          DF.literal(opts.creator.isPartOf.name),
          provenanceGraph
        )
      );
    }

    // Assertion graph
    const assertionQuads = assertionStore.getQuads();
    assertionQuads.forEach(assertionQuad => {
      const quad = DF.fromQuad(assertionQuad as RDF.Quad);
      quad.graph = assertionGraph; // Assign triples to the graph
      primaryStore.addQuad(quad);
    });

    // Publication info graph
    const publicationQuads = publicationStore.getQuads();
    publicationQuads.forEach(publicationQuad => {
      const quad = DF.fromQuad(publicationQuad as RDF.Quad);
      quad.graph = publicationGraph; // Assign triples to the graph
      primaryStore.addQuad(quad);
    });

    const nanopubIri = await this.save({store: primaryStore});

    const nanopub: Nanopub = {
      id: nanopubIri,
    };

    return nanopub;
  }
}
