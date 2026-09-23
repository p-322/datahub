'use client';

import {
  useCallback,
  useMemo,
  ReactNode,
  useState,
  useEffect,
  createContext,
  useContext,
} from 'react';
import {useListStore} from '@p-322/list-store';
import {useTranslations} from 'next-intl';

interface FacetContextProps {
  title: string;
}

const FacetContext = createContext<FacetContextProps>({
  title: '',
});

interface FacetWrapperProps {
  children: ReactNode;
  testId?: string;
  title: string;
}

export function FacetWrapper({children, testId, title}: FacetWrapperProps) {
  const context = {
    title,
  };
  const t = useTranslations('Filters');

  return (
    <FacetContext.Provider value={context}>
      <fieldset>
        <div className="w-full max-w-[450px]" data-testid={testId}>
          {children}
        </div>
      </fieldset>
      <div className="sr-only">
        <a href="#search-results">{t('facetJumpToResults')}</a>
      </div>
    </FacetContext.Provider>
  );
}

export function FacetTitle() {
  const {title} = useContext(FacetContext);

  return <legend className="font-semibold grow">{title}</legend>;
}

interface FacetCheckBoxProps {
  name: string | number | undefined;
  id: string | number;
  count: number;
  filterKey: string;
  // The sidebar is a narrow column, so a long term is clipped there. A modal
  // has the width to show it whole, and clipping a term the user opened the
  // modal to read is the wrong trade in that direction.
  clipName?: boolean;
}

export function FacetCheckBox({
  name,
  id,
  count,
  filterKey,
  clipName = true,
}: FacetCheckBoxProps) {
  const selectedFilters = useListStore(s => s.selectedFilters);
  const filterChange = useListStore(s => s.filterChange);
  const newDataNeeded = useListStore(s => s.newDataNeeded);
  const [isMounted, setIsMounted] = useState(false);
  const {title} = useContext(FacetContext);
  const t = useTranslations('Filters');

  // Wait for hydration to complete before enabling the input
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const selectedFiltersForKey = useMemo(
    () => selectedFilters[filterKey] || [],
    [filterKey, selectedFilters]
  ) as (string | number)[];

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) {
        filterChange(filterKey, [...selectedFiltersForKey, e.target.value]);
      } else {
        filterChange(
          filterKey,
          selectedFiltersForKey.filter(filterId => e.target.value !== filterId)
        );
      }
    },
    [filterChange, filterKey, selectedFiltersForKey]
  );

  return (
    <label
      className="flex flex-row justify-between gap-2 w-full mb-2 items-center"
      htmlFor={`facet-${id}`}
    >
      <div className="flex flex-row">
        <input
          className=" w-5 h-5 mr-2 rounded border-accent-300 focus:ring-accent-500"
          type="checkbox"
          id={`facet-${id}`}
          name={`facet-${id}`}
          value={id}
          checked={selectedFiltersForKey.some(filterId => id === filterId)}
          onChange={handleChange}
          disabled={!isMounted || newDataNeeded}
        />
        <div
          className={clipName ? 'truncate max-w-[230px]' : ''}
          aria-label={t('accessibilityFacetLabel', {title, name})}
        >
          {name}
        </div>
      </div>
      <div
        className="text-sm text-neutral-600"
        aria-label={t('accessibilityFacetCount', {count})}
      >
        {count}
      </div>
    </label>
  );
}
