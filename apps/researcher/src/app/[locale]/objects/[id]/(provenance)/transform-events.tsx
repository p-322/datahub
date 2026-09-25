import {ProvenanceEvent} from '@p-322/api';
import {ProvenanceEventEnrichment} from '@p-322/enricher';
import {getTranslations} from 'next-intl/server';
import YAML from 'yaml';
import {UserProvenanceEvent} from './definitions';
import {qualifierOptions, typeMapping} from '@/lib/provenance-options';
import useObject from '../use-object';
import ISO6391 from 'iso-639-1';

export async function getQualifierName(
  event: ProvenanceEvent | ProvenanceEventEnrichment
) {
  const t = await getTranslations('QualifierSelector');

  if (!('qualifier' in event) || !event.qualifier?.id) {
    return undefined;
  }

  const translationKey = qualifierOptions.find(
    qualifier => qualifier.id === event.qualifier!.id
  )?.translationKey;

  return translationKey ? t(translationKey) : event.qualifier.name;
}

export function getMotivations(
  event: ProvenanceEvent | ProvenanceEventEnrichment
) {
  const parsedDescription = event.description && YAML.parse(event.description);

  if (
    typeof parsedDescription === 'object' &&
    !Array.isArray(parsedDescription) &&
    parsedDescription !== null
  ) {
    return parsedDescription;
  }
  return undefined;
}

// The kinds Tabulous puts on `event.type`, which every event carries. A
// closed set on purpose: a value that is not listed falls through to no
// label rather than being handed to `t()`, which throws on a missing
// message and would take the whole object page down with it.
const eventKinds = new Set([
  'acquisition',
  'production',
  'transferOfCustody',
  'historicalEvent',
  'destruction',
  'activity',
]);

/**
 * What to call a provenance event on the timeline.
 *
 * Best is one of the eleven curated types, matched on the event's kind and
 * the Getty IRI. Failing that, the label the thesaurus gave. Failing that,
 * the event's own kind — "Acquisition", "Production" — which is coarse but
 * true, and which every event has.
 *
 * Measured over 66,932 events of the second delivery: two thirds match a
 * named Getty type, and without the last fallback the remaining third
 * appeared on the timeline with no type at all. A further 1.7% had a named
 * type alongside an id-only one, which the old join rendered as
 * "acquisitie, " — hence filtering the blanks before joining rather than
 * after.
 */
export async function getTypeName(
  event: ProvenanceEvent | ProvenanceEventEnrichment
) {
  const t = await getTranslations('ProvenanceEventType');

  const names = (event.additionalTypes ?? [])
    .map(type => {
      const translationKey = Object.values(typeMapping).find(
        mapping =>
          mapping.type === event.type && mapping.additionalType === type.id
      )?.translationKey;

      return translationKey ? t(translationKey) : type.name;
    })
    .filter((name): name is string => Boolean(name));

  if (names.length > 0) {
    return names.join(', ');
  }

  return event.type && eventKinds.has(event.type)
    ? t(`kind.${event.type}`)
    : undefined;
}

export async function transformEvents(
  events: (ProvenanceEvent | ProvenanceEventEnrichment)[]
): Promise<UserProvenanceEvent[]> {
  const t = await getTranslations('Provenance');
  const {organization} = useObject.getState();

  return Promise.all(
    events.map(async (event, index) => {
      const isEnrichment = 'pubInfo' in event;
      return {
        id: event.id,
        qualifierName: await getQualifierName(event),
        typeName: await getTypeName(event),
        motivations: getMotivations(event),
        transferredToName: event.transferredTo?.name,
        transferredFromName: event.transferredFrom?.name,
        // Only the museum's own events carry these; a community
        // enrichment is a statement about a transfer and has neither.
        carriedOutByName: isEnrichment ? undefined : event.carriedOutBy?.name,
        eventName: isEnrichment ? undefined : event.label,
        locationName: event.location?.name,
        date: event.date,
        label: `${t('initial')}${index + 1}`,
        dateCreated: isEnrichment ? event.pubInfo.dateCreated : undefined,
        citation: isEnrichment ? event.citation : undefined,
        creatorName: isEnrichment
          ? event.pubInfo.creator.name
          : organization?.name,
        communityName: isEnrichment
          ? event.pubInfo.creator.isPartOf?.name
          : undefined,
        isCurrentPublisher: !isEnrichment,
        createdWith: isEnrichment ? event.pubInfo.createdWith : undefined,
        inLanguage:
          isEnrichment && event.inLanguage
            ? ISO6391.getName(event.inLanguage)
            : undefined,
      };
    })
  );
}
