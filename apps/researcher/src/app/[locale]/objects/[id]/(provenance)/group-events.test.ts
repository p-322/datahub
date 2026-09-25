import {describe, expect} from '@jest/globals';
import {groupByDateRange} from './group-events';
import {UserProvenanceEvent} from './definitions';

// A simple `formatTimeSpan` mock that returns a string representation of a date range.
function formatTimeSpan({
  startDate,
  endDate,
}: {
  startDate?: Date;
  endDate?: Date;
}) {
  if (!startDate || !endDate) {
    return '';
  }

  return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
}

describe('groupByDateRange', () => {
  it('groups events by date range', () => {
    const events = [
      {
        date: {
          startDate: new Date('2022-01-01'),
          endDate: new Date('2022-01-05'),
        },
      },
      {
        date: {
          startDate: new Date('2022-01-03'),
          endDate: new Date('2022-01-07'),
        },
      },
      {
        date: {
          startDate: new Date('2022-01-03'),
          endDate: new Date('2022-01-07'),
        },
      },
      {
        date: {
          startDate: new Date('2022-01-06'),
          endDate: new Date('2022-01-10'),
        },
      },
    ];

    // @ts-expect-error:TS2322
    const result = groupByDateRange({events, formatTimeSpan});

    expect(result.get('1/1/2022 - 1/5/2022')).toHaveLength(1);
    expect(result.get('1/3/2022 - 1/7/2022')).toHaveLength(2);
    expect(result.get('1/6/2022 - 1/10/2022')).toHaveLength(1);
  });

  it('handles empty events array', () => {
    const events: UserProvenanceEvent[] = [];

    const result = groupByDateRange({events, formatTimeSpan});

    expect(result.size).toBe(0);
  });

  // The regression this shape exists for. An object would enumerate "1908"
  // and "1942" first, in ascending numeric order, because they read as array
  // indices; the range and the two textual labels would follow. That put the
  // 1873–1942 event third on an object page, behind two events that sorted
  // after it, and made the sort look broken.
  it('keeps year-labelled groups in the order the events arrived', () => {
    const labels = ['1873–1942', '1908', '1942', 'before 1899', ''];
    const events = labels.map((edtf, index) => ({
      id: `event${index}`,
      date: {id: `date${index}`, edtf},
    }));

    const result = groupByDateRange({
      // @ts-expect-error:TS2322
      events,
      formatTimeSpan: ({edtf}) => edtf ?? '',
    });

    expect([...result.keys()]).toEqual(labels);
  });
});
