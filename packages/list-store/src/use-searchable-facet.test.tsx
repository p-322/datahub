import {
  getLetterCategories,
  extendFiltersWithLetterCategory,
  getFilteredFilters,
  SearchableFilter,
  Filter,
  FacetSortBy,
  mostPopulated,
} from './use-searchable-facet';

describe('getLetterCategories', () => {
  it('returns an array of unique letter categories sorted alphabetically', () => {
    const filters = [
      {letterCategory: 'B', name: 'B Filter', id: '1', totalCount: 1},
      {letterCategory: 'A', name: ' "A Filter" ', id: '2', totalCount: 1},
      {letterCategory: '[0-9]', name: '1 Filter', id: '3', totalCount: 1},
      {letterCategory: 'B', name: 'B2 Filter', id: '4', totalCount: 1},
    ];
    const result = getLetterCategories({filters});
    expect(result).toEqual(['A', 'B', '[0-9]']);
  });

  it('returns an array of unique letter categories sorted alphabetically including the selected `letterCategory`', () => {
    const filters = [
      {letterCategory: 'B', name: 'B Filter', id: '1', totalCount: 1},
      {letterCategory: 'A', name: ' "A Filter" ', id: '2', totalCount: 1},
      {letterCategory: '[0-9]', name: '1 Filter', id: '3', totalCount: 1},
      {letterCategory: 'B', name: 'B2 Filter', id: '4', totalCount: 1},
    ];
    const result = getLetterCategories({filters, letterCategory: 'D'});
    expect(result).toEqual(['A', 'B', 'D', '[0-9]']);
  });

  it('returns an array of unique letter categories sorted alphabetically filtered by `searchValue`', () => {
    const filters = [
      {letterCategory: 'B', name: 'B Filter', id: '1', totalCount: 1},
      {letterCategory: 'A', name: ' "A Filter" ', id: '2', totalCount: 1},
      {letterCategory: '[0-9]', name: '1 Filter', id: '3', totalCount: 1},
      {letterCategory: 'B', name: 'B2 Filter', id: '4', totalCount: 1},
    ];
    const result = getLetterCategories({filters, searchValue: 'B Fil'});
    expect(result).toEqual(['B']);
  });

  it('ignores undefined letterCategories', () => {
    const filters = [
      {letterCategory: 'A', name: 'B Filter', id: '1', totalCount: 1},
      {letterCategory: undefined, name: '', id: '2', totalCount: 1},
      {letterCategory: undefined, name: '#', id: '3', totalCount: 1},
    ];
    const result = getLetterCategories({filters});
    expect(result).toEqual(['A']);
  });
});

describe('extendFiltersWithLetterCategory', () => {
  it('adds a `letterCategory` to each filter based on the first letter of its name', () => {
    const filters = [
      {name: 'Apple', id: '1', totalCount: 1},
      {name: 'Banana', id: '2', totalCount: 1},
      {name: 'Cherry', id: '3', totalCount: 1},
      {name: '1 Filter', id: '4', totalCount: 1},
      {name: '#', id: '5', totalCount: 1},
      {name: '', id: '6', totalCount: 1},
    ];
    const expectedFilters = [
      {name: 'Apple', id: '1', totalCount: 1, letterCategory: 'A'},
      {name: 'Banana', id: '2', totalCount: 1, letterCategory: 'B'},
      {name: 'Cherry', id: '3', totalCount: 1, letterCategory: 'C'},
      {name: '1 Filter', id: '4', totalCount: 1, letterCategory: '[0-9]'},
      {name: '#', id: '5', totalCount: 1, letterCategory: undefined},
      {name: '', id: '6', totalCount: 1, letterCategory: undefined},
    ];
    const result = extendFiltersWithLetterCategory(filters);
    expect(result).toEqual(expectedFilters);
  });

  it('handles filters with non-string names', () => {
    const filters = [
      {name: 123, id: '1', totalCount: 1},
      {name: undefined, id: '2', totalCount: 1},
    ];
    const expectedFilters = [
      {name: '123', id: '1', totalCount: 1, letterCategory: '[0-9]'},
      {name: '', id: '2', totalCount: 1, letterCategory: undefined},
    ];
    const result = extendFiltersWithLetterCategory(filters);
    expect(result).toEqual(expectedFilters);
  });

  it('handles empty filters array', () => {
    const filters: Filter[] = [];
    const expectedFilters: SearchableFilter[] = [];
    const result = extendFiltersWithLetterCategory(filters);
    expect(result).toEqual(expectedFilters);
  });
});

describe('getFilteredFilters', () => {
  const filters = [
    {name: 'Apple', id: '1', totalCount: 1, letterCategory: 'A'},
    {name: 'Banana', id: '2', totalCount: 2, letterCategory: 'B'},
    {name: '1 Filter', id: '3', totalCount: 4, letterCategory: '[0-9]'},
    {name: 'Cherry', id: '4', totalCount: 3, letterCategory: 'C'},
  ];

  it('filters by `searchValue`', () => {
    const result = getFilteredFilters({
      filtersWithLetterCategory: filters,
      searchValue: 'app',
      letterCategory: '',
      sortBy: FacetSortBy.count,
    });
    expect(result).toEqual([
      {name: 'Apple', id: '1', totalCount: 1, letterCategory: 'A'},
    ]);
  });

  it('filters by `letterCategory`', () => {
    const result = getFilteredFilters({
      filtersWithLetterCategory: filters,
      searchValue: '',
      letterCategory: 'B',
      sortBy: FacetSortBy.count,
    });
    expect(result).toEqual([
      {name: 'Banana', id: '2', totalCount: 2, letterCategory: 'B'},
    ]);
  });

  it('sorts alphabetically', () => {
    const result = getFilteredFilters({
      filtersWithLetterCategory: filters,
      searchValue: '',
      letterCategory: '',
      sortBy: FacetSortBy.alphabetical,
    });
    expect(result).toEqual([
      {name: '1 Filter', id: '3', totalCount: 4, letterCategory: '[0-9]'},
      {name: 'Apple', id: '1', totalCount: 1, letterCategory: 'A'},
      {name: 'Banana', id: '2', totalCount: 2, letterCategory: 'B'},
      {name: 'Cherry', id: '4', totalCount: 3, letterCategory: 'C'},
    ]);
  });

  it('sorts by `totalCount`', () => {
    const result = getFilteredFilters({
      filtersWithLetterCategory: filters,
      searchValue: '',
      letterCategory: '',
      sortBy: FacetSortBy.count,
    });
    expect(result).toEqual([
      {name: '1 Filter', id: '3', totalCount: 4, letterCategory: '[0-9]'},
      {name: 'Cherry', id: '4', totalCount: 3, letterCategory: 'C'},
      {name: 'Banana', id: '2', totalCount: 2, letterCategory: 'B'},
      {name: 'Apple', id: '1', totalCount: 1, letterCategory: 'A'},
    ]);
  });

  // The period facet: ids are the first year of each century, so ordering by
  // id is the only one that reads as a scale. Alphabetically these labels
  // come out "10th, 11th, 1st"; by count they jump about.
  const periods = [
    {
      name: '20th century',
      id: '1900',
      totalCount: 413616,
      letterCategory: '[0-9]',
    },
    {
      name: '1st century BCE',
      id: '-100',
      totalCount: 226,
      letterCategory: '[0-9]',
    },
    {
      name: '19th century',
      id: '1800',
      totalCount: 82095,
      letterCategory: '[0-9]',
    },
    {name: '1st century', id: '0', totalCount: 248, letterCategory: '[0-9]'},
  ];

  it('sorts chronologically, oldest first, with BCE before the common era', () => {
    const result = getFilteredFilters({
      filtersWithLetterCategory: periods,
      searchValue: '',
      letterCategory: '',
      sortBy: FacetSortBy.chronological,
    });
    expect(result.map(filter => filter.id)).toEqual([
      '-100',
      '0',
      '1800',
      '1900',
    ]);
  });

  it('puts an id that is not a number last rather than scrambling the scale', () => {
    const result = getFilteredFilters({
      filtersWithLetterCategory: [
        {name: 'Unknown', id: 'unknown', totalCount: 1},
        ...periods,
      ],
      searchValue: '',
      letterCategory: '',
      sortBy: FacetSortBy.chronological,
    });
    expect(result[result.length - 1].id).toBe('unknown');
  });

  it('leaves the array it was given alone', () => {
    const given = [...periods];
    getFilteredFilters({
      filtersWithLetterCategory: given,
      searchValue: '',
      letterCategory: '',
      sortBy: FacetSortBy.chronological,
    });
    expect(given).toEqual(periods);
  });

  it('filters by `searchValue` and `letterCategory`, and sorts by `totalCount`', () => {
    const result = getFilteredFilters({
      filtersWithLetterCategory: filters,
      searchValue: 'a',
      letterCategory: 'B',
      sortBy: FacetSortBy.count,
    });
    expect(result).toEqual([
      {name: 'Banana', id: '2', totalCount: 2, letterCategory: 'B'},
    ]);
  });
});

describe('mostPopulated', () => {
  const periods = [
    {name: '1st century', id: '0', totalCount: 248},
    {name: '20th century', id: '1900', totalCount: 413616},
    {name: '12th century', id: '1100', totalCount: 6204},
    {name: '19th century', id: '1800', totalCount: 82095},
    {name: '18th century', id: '1700', totalCount: 13182},
    {name: '11th century', id: '1000', totalCount: 5569},
  ];

  it('is the biggest buckets, largest first', () => {
    expect(mostPopulated(periods, 5).map(filter => filter.id)).toEqual([
      '1900',
      '1800',
      '1700',
      '1100',
      '1000',
    ]);
  });

  it('leaves the array it was given alone', () => {
    const given = [...periods];
    mostPopulated(given, 3);
    expect(given).toEqual(periods);
  });

  it('copes with fewer filters than the limit', () => {
    expect(mostPopulated(periods.slice(0, 2), 5)).toHaveLength(2);
  });
});
