import {
  HeritageObject,
  SearchResultFilter,
  SortBy,
  SortOrder,
} from '../definitions';

export type HeritageObjectSearchResult = {
  totalCount: number;
  offset: number;
  limit: number;
  sortBy: SortBy;
  sortOrder: SortOrder;
  heritageObjects: HeritageObject[];
  filters: {
    types: SearchResultFilter[];
    subjects: SearchResultFilter[];
    locations: SearchResultFilter[];
    materials: SearchResultFilter[];
    creators: SearchResultFilter[];
    publishers: SearchResultFilter[];
    // Dates, read from the museum's EDTF statement at index time
    // (packages/api/src/edtf.ts). `centuries` and `decades` are keyed by
    // first year — 1800 is the nineteenth century, 1830 is the 1830s — and
    // an object whose date spans a boundary appears under each one it
    // touches, so the counts match what filtering on them returns.
    centuries: SearchResultFilter[];
    decades: SearchResultFilter[];
    // How precisely the source dated the object, and whether either end of
    // the range is unknown. Both are ordinary term facets.
    datePrecision: SearchResultFilter[];
    dateOpenness: SearchResultFilter[];
  };
};
