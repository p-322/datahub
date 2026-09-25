import {
  LocalContextsNoticeEnrichment,
  LocalContextsNoticeEnrichmentType,
} from './definitions';
import {
  createActors,
  createDates,
  getPropertyValue,
  onlyOne,
} from '../rdf-helpers';
import {defu} from 'defu';
import type {Resource} from 'rdf-object';

export function toLocalContextsNoticeEnrichment(rawEnrichment: Resource) {
  const type = getPropertyValue(
    rawEnrichment,
    'ex:type'
  ) as LocalContextsNoticeEnrichmentType;
  const about = getPropertyValue(rawEnrichment, 'ex:about')!;
  const creator = onlyOne(createActors(rawEnrichment, 'ex:creator'))!;
  const group = onlyOne(createActors(rawEnrichment, 'ex:createdOnBehalfOf'));
  const license = getPropertyValue(rawEnrichment, 'ex:license')!;
  const createdWith = getPropertyValue(rawEnrichment, 'ex:createdWith');
  const dateCreated = onlyOne(createDates(rawEnrichment, 'ex:dateCreated'))!;
  const citation = getPropertyValue(rawEnrichment, 'ex:citation');
  const description = getPropertyValue(rawEnrichment, 'ex:description');
  const inLanguage = getPropertyValue(rawEnrichment, 'ex:inLanguage');

  const creatorWithGroup =
    group !== undefined ? {...creator, ...{isPartOf: group}} : creator;

  const enrichment: LocalContextsNoticeEnrichment = {
    id: rawEnrichment.value,
    type,
    about,
    citation,
    description,
    inLanguage,
    pubInfo: {
      creator: creatorWithGroup,
      license,
      dateCreated,
      // Only when the nanopub says: defu below strips nullish values from
      // the top level but not from inside pubInfo.
      ...(createdWith !== undefined && {createdWith}),
    },
  };

  const enrichmentWithoutNullishValues = defu(enrichment, {});

  return enrichmentWithoutNullishValues;
}
