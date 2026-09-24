import {TimeSpan} from '@p-322/api';

export type UserProvenanceEvent = {
  id: string;
  // The timeline marker — "P1", "P2" — not the event's own name, which is
  // `eventName`. Renaming this would be the clearer fix; it is threaded
  // through categorize-timeline-events and the timeline component.
  label: string;
  // What the source calls this event. Historical events carry one 99% of
  // the time and little else, so without it they render as a bare date.
  eventName?: string;
  // Who performed it, where nothing changed hands: the maker of a
  // production, the actor of an activity.
  carriedOutByName?: string;
  motivations: Record<string, string>;
  typeName?: string;
  qualifierName?: string;
  transferredToName?: string;
  transferredFromName?: string;
  locationName?: string;
  date?: TimeSpan;
  dateCreated?: Date;
  citation?: string;
  creatorName?: string;
  communityName?: string;
  isCurrentPublisher: boolean;
  inLanguage?: string;
};

export type TimelineEvent = {
  id: string;
  startDate: Date;
  endDate: Date;
  selectIds: string[];
  labels: string[];
};
