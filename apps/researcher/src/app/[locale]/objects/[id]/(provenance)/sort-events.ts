import {ProvenanceEvent} from '@p-322/api';
import {ProvenanceEventEnrichment} from '@p-322/enricher';

/**
 * Oldest first, undated last.
 *
 * Undated events used to sort to the front: a missing start date counted as
 * -Infinity, which put "we do not know when" before an object's creation.
 * That was tolerable while the timeline showed only acquisitions, 85% of
 * which are dated. It is not now that it shows every kind: all 337
 * activities are undated, and so is 43% of historical events.
 *
 * Nothing is dropped — an undated event is still shown, at the end, which is
 * what docs/tabulous-requests.md has described as the behaviour all along.
 */
export function sortEvents(
  events: (ProvenanceEvent | ProvenanceEventEnrichment)[]
) {
  return events.sort((a, b) => {
    const aStart = a.date?.startDate?.getTime();
    const bStart = b.date?.startDate?.getTime();

    // An event with no start date sorts after every event that has one, and
    // keeps its position relative to the other undated ones.
    if (aStart === undefined || bStart === undefined) {
      return (aStart === undefined ? 1 : 0) - (bStart === undefined ? 1 : 0);
    }

    // A missing end date reads as "still open", which sorts after a closed
    // range that starts in the same year.
    const aEnd = a.date?.endDate?.getTime() ?? Infinity;
    const bEnd = b.date?.endDate?.getTime() ?? Infinity;

    return aStart - bStart || aEnd - bEnd;
  });
}
