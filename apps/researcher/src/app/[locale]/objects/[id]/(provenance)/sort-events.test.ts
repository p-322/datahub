import {sortEvents} from './sort-events';
import {ProvenanceEvent} from '@p-322/api';
import {describe, expect, it} from '@jest/globals';

const event = (id: string, start?: string, end?: string) =>
  ({
    id,
    type: 'acquisition',
    date:
      start === undefined && end === undefined
        ? undefined
        : {
            id: `${id}#date`,
            startDate: start ? new Date(start) : undefined,
            endDate: end ? new Date(end) : undefined,
          },
  }) as unknown as ProvenanceEvent;

const order = (events: ProvenanceEvent[]) => sortEvents(events).map(e => e.id);

describe('sortEvents', () => {
  it('puts the oldest first', () => {
    expect(
      order([
        event('1930', '1930-01-01', '1930-12-31'),
        event('1890', '1890-01-01', '1890-12-31'),
        event('1910', '1910-01-01', '1910-12-31'),
      ])
    ).toEqual(['1890', '1910', '1930']);
  });

  // The whole point of the change: an event with no date used to sort ahead
  // of an object's creation, which reads as though it happened first.
  it('puts an undated event after every dated one', () => {
    expect(
      order([
        event('undated'),
        event('1890', '1890-01-01', '1890-12-31'),
        event('alsoUndated'),
        event('1930', '1930-01-01', '1930-12-31'),
      ])
    ).toEqual(['1890', '1930', 'undated', 'alsoUndated']);
  });

  // The test this replaced used `startDate: null` rather than a missing
  // date, so that shape occurs and optional chaining has to cope with it.
  it('treats a null date the same as a missing one', () => {
    const events = [
      {id: 'null', date: {startDate: null, endDate: new Date('1902-12-31')}},
      {id: '1890', date: {startDate: new Date('1890-01-01')}},
    ];

    // @ts-expect-error:TS2322
    expect(sortEvents(events).map(e => e.id)).toEqual(['1890', 'null']);
  });

  it('keeps undated events in the order they arrived', () => {
    expect(order([event('a'), event('b'), event('c')])).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('breaks a tie on the start date with the end date', () => {
    expect(
      order([
        event('longer', '1890-01-01', '1899-12-31'),
        event('shorter', '1890-01-01', '1890-12-31'),
      ])
    ).toEqual(['shorter', 'longer']);
  });

  it('sorts an open-ended range after a closed one that starts with it', () => {
    expect(
      order([
        event('open', '1890-01-01'),
        event('closed', '1890-01-01', '1890-12-31'),
      ])
    ).toEqual(['closed', 'open']);
  });
});
