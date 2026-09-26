'use client';

import {
  Dispatch,
  ReactNode,
  SetStateAction,
  createContext,
  useContext,
  useMemo,
  useState,
} from 'react';
import {UserProvenanceEvent} from './definitions';
import {groupByDateRange} from './group-events';
import {useDateFormatter} from '@/lib/date-formatter/hooks';

interface SelectedEventContextType {
  selectedEvents: string[];
  setSelectedEvents: Dispatch<SetStateAction<string[]>>;
  events: UserProvenanceEvent[];
  eventGroups: Map<string, UserProvenanceEvent[]>;
}

const SelectedEventContext = createContext<SelectedEventContextType>({
  selectedEvents: [],
  setSelectedEvents: () => {},
  events: [],
  eventGroups: new Map(),
});

export function ProvenanceProvider({
  children,
  events,
}: {
  children: ReactNode;
  events: UserProvenanceEvent[];
}) {
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const {formatTimeSpan} = useDateFormatter();
  const eventGroups = useMemo(
    () => groupByDateRange({events, formatTimeSpan}),
    [events, formatTimeSpan]
  );

  const context = {
    selectedEvents,
    setSelectedEvents,
    events,
    eventGroups,
  };
  return (
    <SelectedEventContext.Provider value={context}>
      {children}
    </SelectedEventContext.Provider>
  );
}

export function useProvenance() {
  const context = useContext(SelectedEventContext);

  if (!context) {
    throw new Error(
      '`useProvenance` must be used within a `ProvenanceProvider`'
    );
  }
  return context;
}
