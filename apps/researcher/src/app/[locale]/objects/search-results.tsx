import heritageObjects from '@/lib/heritage-objects-instance';
import {getTranslations, getLocale} from 'next-intl/server';
import HeritageObjectList from './heritage-object-list';
import {
  SortByUserOption,
  defaultSortByUserOption,
  sortMapping,
} from './sort-mapping';
import {
  defaultLimit,
  FacetSortBy,
  fromSearchParamsToSearchOptions,
  getClientSortBy,
  ImageFetchMode,
  ListView,
  Type as SearchParamType,
} from '@colonial-collections/list-store';
import {
  HeritageObjectSearchResult,
  SearchResultFilter,
  SortBy,
  SortByEnum,
  SortOrder,
  SortOrderEnum,
} from '@colonial-collections/api';
import {
  MultiSelectFacet,
  SearchableMultiSelectFacet,
  Paginator,
  SelectedFilters,
  SearchFieldWithLabel,
  OrderSelector,
} from '@colonial-collections/ui/list';
import {
  SmallScreenSubMenu,
  SubMenuButton,
  SubMenuDialog,
} from '@colonial-collections/ui';
import {AdjustmentsHorizontalIcon} from '@heroicons/react/20/solid';
import {ElementType} from 'react';
import {ListStoreUpdater} from '@/components/list-store-updater';
import {LocaleEnum} from '@/definitions';
import SettingsMenu from './settings-menu';

// Revalidate the page every n seconds
export const revalidate = 60;

interface FilterSetting {
  name: keyof HeritageObjectSearchResult['filters'];
  searchParamType: SearchParamType;
}

const filterSettings: ReadonlyArray<FilterSetting> = [
  {name: 'locations', searchParamType: 'array'},
  {name: 'types', searchParamType: 'array'},
  {name: 'subjects', searchParamType: 'array'},
  {name: 'publishers', searchParamType: 'array'},
  {name: 'materials', searchParamType: 'array'},
  {name: 'creators', searchParamType: 'array'},
  {name: 'centuries', searchParamType: 'array'},
  {name: 'decades', searchParamType: 'array'},
  {name: 'datePrecision', searchParamType: 'array'},
  {name: 'dateOpenness', searchParamType: 'array'},
];

interface Facet {
  name: string;
  // `Component` needs to be uppercase to be valid JSX
  Component: ElementType;
  // Render this facet only when another one has a selection.
  onlyWith?: keyof HeritageObjectSearchResult['filters'];
  // Passed through to the component, for facets that need it.
  props?: Record<string, unknown>;
}

// The collection spans the 101st century BCE to the 21st, so the period
// facet has some seventy buckets — too many for the sidebar, and neither of
// the usual orders reads as a scale. The sidebar shows the five biggest,
// which says at a glance where this collection sits; the modal lists every
// period in order.
const periodFacetProps = {
  defaultSortBy: FacetSortBy.chronological,
  sortOptions: [FacetSortBy.chronological, FacetSortBy.count],
  showLetterCategories: false,
};

// The two "from"/"to" year boxes are gone. They asked the user to know the
// numbers, they filtered by containment so an object dated 1830/1860 vanished
// from a search for 1840–1850, and an object dated "before 1887" — a sixth of
// everything dated — was dropped the moment a start year was typed, because
// it has no start year to compare. Periods are now browsable buckets read
// from the museum's own dating statement.
const facets: ReadonlyArray<Facet> = [
  {name: 'locations', Component: SearchableMultiSelectFacet},
  {
    name: 'centuries',
    Component: SearchableMultiSelectFacet,
    props: periodFacetProps,
  },
  // Decades only once a century is chosen: a hundred decades in the sidebar
  // helps nobody, and drilling in is what the century list is for. With a
  // century picked there are at most ten, so the plain list is right.
  {name: 'decades', Component: MultiSelectFacet, onlyWith: 'centuries'},
  {name: 'datePrecision', Component: MultiSelectFacet},
  {name: 'dateOpenness', Component: MultiSelectFacet},
  {name: 'types', Component: SearchableMultiSelectFacet},
  // Subjects: thousands of distinct terms in the Sawubona data, where the
  // Triply index had a handful. MultiSelectFacet renders every bucket, which
  // buried the rest of the menu; this shows the top five with the usual
  // search / A-Z / sort modal behind "more", as types and makers do.
  {name: 'subjects', Component: SearchableMultiSelectFacet},
  {name: 'materials', Component: SearchableMultiSelectFacet},
  {name: 'creators', Component: SearchableMultiSelectFacet},
  {name: 'publishers', Component: MultiSelectFacet},
];

// The date facets come out of Elasticsearch as bare keys — 1800, 1830,
// "openStart" — because that is what is indexed. Turning them into "19de
// eeuw", "jaren 1830" and "begin onbekend" is a presentation concern, so it
// happens here rather than in the index.
type Labeller = (
  filters: SearchResultFilter[],
  t: (key: string, values?: Record<string, string | number>) => string
) => SearchResultFilter[];

// Ordering is the facet's job here — it sorts by id, which is the century's
// first year, so it stays chronological in any language.
const asCentury: Labeller = (filters, t) =>
  filters.map(filter => {
    const firstYear = Number(filter.id);
    const ordinal = Math.floor(Math.abs(firstYear) / 100) + 1;
    return {
      ...filter,
      name: t(firstYear < 0 ? 'centuryBeforeCommonEra' : 'century', {
        century: ordinal,
      }),
    };
  });

const asDecade: Labeller = (filters, t) =>
  [...filters]
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map(filter => ({...filter, name: t('decade', {decade: filter.id})}));

// Fixed vocabularies, so each value gets its own message key.
const asTerm =
  (prefix: string): Labeller =>
  (filters, t) =>
    filters.map(filter => ({...filter, name: t(`${prefix}.${filter.id}`)}));

const labellers: Partial<
  Record<keyof HeritageObjectSearchResult['filters'], Labeller>
> = {
  centuries: asCentury,
  decades: asDecade,
  datePrecision: asTerm('datePrecisionValue'),
  dateOpenness: asTerm('dateOpennessValue'),
};

interface FacetMenuProps {
  filters: HeritageObjectSearchResult['filters'];
  selected: Record<string, unknown>;
}

async function FacetMenu({filters, selected}: FacetMenuProps) {
  const t = await getTranslations('Filters');

  return (
    <div className="w-full flex flex-col gap-6">
      <SearchFieldWithLabel />
      {facets.map(({name, Component, onlyWith, props}) => {
        if (onlyWith !== undefined && !hasSelection(selected[onlyWith])) {
          return null;
        }

        const key = name as keyof HeritageObjectSearchResult['filters'];
        const label = labellers[key];

        return (
          <Component
            key={name}
            title={t(`${name}Filter`)}
            testId={`${name}Filter`}
            filterKey={name}
            filters={label ? label(filters[key], t) : filters[key]}
            {...props}
          />
        );
      })}
    </div>
  );
}

function hasSelection(value: unknown) {
  return Array.isArray(value) && value.length > 0;
}

interface Props {
  searchParams?: {[filter: string]: string};
}

export default async function SearchResults({searchParams = {}}: Props) {
  const locale = (await getLocale()) as LocaleEnum;

  const searchOptions = fromSearchParamsToSearchOptions({
    sortOptions: {
      SortOrderEnum,
      defaultSortOrder: SortOrder.Descending,
      SortByEnum,
      defaultSortBy: SortBy.DateCreated,
      sortMapping: sortMapping,
    },
    filterKeys: filterSettings.map(({name, searchParamType}) => ({
      name,
      type: searchParamType,
    })),
    searchParams,
    defaultLimit,
  });

  const sortBy = getClientSortBy({
    sortMapping,
    sortPair: {
      sortBy: searchOptions.sortBy,
      sortOrder: searchOptions.sortOrder,
    },
  });

  let hasError;
  let searchResult: HeritageObjectSearchResult | undefined;
  try {
    searchResult = await heritageObjects.search({...searchOptions, locale});
  } catch (err) {
    hasError = true;
    console.error(err);
  }

  const t = await getTranslations('ObjectSearchResults');

  return (
    <>
      {hasError && (
        <div
          className="bg-orange-100 border-l-4 border-orange-500 text-orange-700 p-4 lg:col-span-3 xl:col-span-4"
          role="alert"
          data-testid="fetch-error"
        >
          <p>{t('fetchError')}</p>
        </div>
      )}

      {searchResult && (
        <>
          <ListStoreUpdater
            {...{
              totalCount: searchResult.totalCount,
              offset: searchResult.offset,
              limit: searchResult.limit,
              query: searchOptions.query ?? '',
              sortBy,
              selectedFilters: searchOptions.filters,
              baseUrl: '/objects',
              defaultSortBy: defaultSortByUserOption,
              view: searchParams.view as ListView,
              imageFetchMode: searchParams.imageFetchMode as ImageFetchMode,
            }}
          />
          <aside
            id="facets"
            className="hidden md:block w-full md:w-1/3 lg:w-1/5 order-2 md:order-1"
          >
            <div className="sr-only">
              <h1 tabIndex={0}>Search for objects</h1>
              <h2 tabIndex={0}>Search facets</h2>
            </div>
            <FacetMenu
              filters={searchResult.filters}
              selected={searchOptions.filters ?? {}}
            />
          </aside>

          <main
            className="w-full md:w-2/3 lg:w-4/5 order-2 md:order-1"
            id="search-results"
          >
            <SmallScreenSubMenu>
              <SubMenuButton className="md:hidden py-2 px-3 rounded-full bg-accent-300 text-ink-800 transition flex items-center gap-1 text-sm my-2">
                <AdjustmentsHorizontalIcon
                  className="ml-1 h-4 w-4 flex-shrink-0 text-ink-800"
                  aria-hidden="true"
                />
                <span>{t('filters')}</span>
              </SubMenuButton>
              <SubMenuDialog title={t('filters')}>
                <FacetMenu
                  filters={searchResult.filters}
                  selected={searchOptions.filters ?? {}}
                />
              </SubMenuDialog>
            </SmallScreenSubMenu>
            <SelectedFilters
              filters={searchResult.filters}
              filterSettings={filterSettings}
            />
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-end mt-4">
              <h2 className="text-xl" tabIndex={0}>
                {t('title', {totalDatasets: searchResult.totalCount})}
              </h2>
              <div className="flex flex-col sm:flex-row justify-end gap-4 relative flex-wrap">
                {/* <SettingsButton>{t('addObjectsToList')}</SettingsButton> */}
                <SettingsMenu />
                <OrderSelector
                  values={[
                    SortByUserOption.DateCreatedDesc,
                    SortByUserOption.DateCreatedAsc,
                    SortByUserOption.NameDesc,
                    SortByUserOption.NameAsc,
                  ]}
                />
              </div>
            </div>
            <HeritageObjectList
              heritageObjects={searchResult.heritageObjects}
              totalCount={searchResult.totalCount}
            />
            <Paginator />
          </main>
        </>
      )}
    </>
  );
}
