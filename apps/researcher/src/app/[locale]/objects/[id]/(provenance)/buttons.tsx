'use client';

import classNames from 'classnames';
import {useProvenance} from './provenance-store';
import {ButtonHTMLAttributes, MouseEvent, ReactNode} from 'react';

interface SelectEventsButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  ids: string[];
  children: ReactNode;
}

export function SelectEventsButton({ids, children}: SelectEventsButtonProps) {
  const {setSelectedEvents, selectedEvents} = useProvenance();
  const selected = ids.some((id: string) => selectedEvents.includes(id));

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (selected) {
      setSelectedEvents(selectedEvents.filter(id => !ids.includes(id)));
    } else {
      setSelectedEvents(ids);
    }
    event.stopPropagation();
  };

  return (
    <button
      className={classNames(
        'rounded-full h-8 min-w-[33px] px-1 flex justify-center items-center border-2 transition text-xs whitespace-nowrap',
        {
          'border-accent-300 bg-white text-ink-800 hover:bg-accent-600 hover:border-accent-600 hover:text-white':
            !selected,
          'border-accent-600 bg-accent-600 text-white': selected,
        }
      )}
      onClick={handleClick}
    >
      {children}
    </button>
  );
}
