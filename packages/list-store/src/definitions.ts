export enum SortBy {
  RelevanceDesc = 'relevanceDesc',
  NameAsc = 'nameAsc',
  NameDesc = 'nameDesc',
}

export const defaultSortBy = SortBy.NameAsc;

export enum ListView {
  Grid = 'grid',
  List = 'list',
}

export enum ImageFetchMode {
  None = 'none',
  Small = 'small',
  Large = 'large',
}

export const defaultImageFetchMode = ImageFetchMode.Large;

export const defaultLimit = 25;

// How an expanded facet orders its values. Kept here rather than beside the
// facet hook because server components choose it: see use-searchable-facet.
export enum FacetSortBy {
  alphabetical = 'alphabetical',
  count = 'count',
  // For facets whose ids are points on a numeric scale rather than labels —
  // the period facet, whose ids are the first year of each century. Neither
  // of the others can order those: by count the list jumps about, and
  // alphabetically "10th century" lands before "1st century". Sorting by id
  // never depends on how a locale words the label.
  chronological = 'chronological',
}
