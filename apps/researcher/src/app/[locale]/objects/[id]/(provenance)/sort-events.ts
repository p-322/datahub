import {ProvenanceEvent} from '@p-322/api';
import {ProvenanceEventEnrichment} from '@p-322/enricher';

export function sortEvents(
  events: (ProvenanceEvent | ProvenanceEventEnrichment)[]
) {
  return events.sort((a, b) => {
    // If startDate is missing, consider it as the smallest possible value
    const aStart = a.date?.startDate?.getTime() || -Infinity;
    const bStart = b.date?.startDate?.getTime() || -Infinity;

    // If endDate is missing, consider it as the highest possible value
    const aEnd = a.date?.endDate?.getTime() || Infinity;
    const bEnd = b.date?.endDate?.getTime() || Infinity;

    // Compare by startDate, then by endDate
    return aStart - bStart || aEnd - bEnd;
  });
}
