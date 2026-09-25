import {UserProvenanceEvent} from './definitions';

interface GroupByDateRangeProps {
  events: UserProvenanceEvent[];
  formatTimeSpan: (props: {
    edtf?: string;
    startDate?: Date;
    endDate?: Date;
  }) => string;
}

/**
 * Groups already-sorted events by the date range they read as, keeping the
 * order they arrived in.
 *
 * A Map, not an object. An object reorders its own keys: any key that looks
 * like an array index is enumerated first, in ascending numeric order,
 * before every other key. Group labels are dates, so "1908" and "1942" are
 * index-like and "1873–1942", "before 1899" and "No date" are not — which
 * put a timeline in the order 1908, 1942, 1873–1942, and made the sort look
 * broken when it was not. A Map keeps insertion order whatever the key.
 */
export function groupByDateRange({
  events,
  formatTimeSpan,
}: GroupByDateRangeProps) {
  const eventGroups = new Map<string, UserProvenanceEvent[]>();

  for (const event of events) {
    const dateRange = formatTimeSpan(event.date || {}) || '';
    const group = eventGroups.get(dateRange);
    if (group) {
      group.push(event);
    } else {
      eventGroups.set(dateRange, [event]);
    }
  }

  return eventGroups;
}
