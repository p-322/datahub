import {buildTree, filterTree, idsToExpand, countNodes, TreeNode} from './tree';

// Shaped like the real buckets: every prefix of every chain is its own
// bucket, and an ancestor's count includes its descendants because the
// paths are self-inclusive.
const buckets = [
  {id: 'Asia', totalCount: 346040},
  {id: 'Asia|South-eastern Asia', totalCount: 220111},
  {id: 'Asia|South-eastern Asia|Indonesia', totalCount: 204300},
  {id: 'Asia|South-eastern Asia|Indonesia|North Maluku', totalCount: 900},
  {id: 'Asia|Western Asia', totalCount: 4000},
  {id: 'Africa', totalCount: 29039},
  {id: 'Africa|Ghana', totalCount: 1200},
];

const ids = (nodes: TreeNode[]) => nodes.map(node => node.id);

describe('buildTree', () => {
  it('nests each chain under the chain it extends', () => {
    const roots = buildTree(buckets);

    expect(ids(roots)).toEqual(['Asia', 'Africa']);
    expect(ids(roots[0].children)).toEqual([
      'Asia|South-eastern Asia',
      'Asia|Western Asia',
    ]);
    expect(ids(roots[0].children[0].children)).toEqual([
      'Asia|South-eastern Asia|Indonesia',
    ]);
  });

  it('names a node by its last segment and keeps the chain as the id', () => {
    const indonesia = buildTree(buckets)[0].children[0].children[0];

    expect(indonesia.name).toBe('Indonesia');
    expect(indonesia.id).toBe('Asia|South-eastern Asia|Indonesia');
  });

  // The searcher builds each filter with name === id, because a bucket key is
  // all Elasticsearch returns. Trusting that name is how every row of the
  // tree came out reading "Asia|South-eastern Asia|Indonesia".
  it('ignores a name that is just the chain again', () => {
    const roots = buildTree([
      {id: 'Asia|Eastern Asia', name: 'Asia|Eastern Asia', totalCount: 1},
    ] as never);

    expect(roots[0].name).toBe('Eastern Asia');
  });

  it('keeps the count the index gave, never the sum of its children', () => {
    // Asia's 346,040 is not 220,111 + 4,000. An object under Indonesia is
    // counted under Indonesia and under every ancestor, so adding children
    // up would count it repeatedly and stop matching what selecting Asia
    // actually returns.
    const asia = buildTree(buckets)[0];

    expect(asia.totalCount).toBe(346040);
  });

  it('orders every level by count', () => {
    const roots = buildTree([
      {id: 'b', totalCount: 1},
      {id: 'a', totalCount: 5},
      {id: 'a|small', totalCount: 1},
      {id: 'a|big', totalCount: 4},
    ]);

    expect(ids(roots)).toEqual(['a', 'b']);
    expect(ids(roots[0].children)).toEqual(['a|big', 'a|small']);
  });

  it('records the depth, so a flat render can indent', () => {
    const roots = buildTree(buckets);

    expect(roots[0].depth).toBe(0);
    expect(roots[0].children[0].depth).toBe(1);
    expect(roots[0].children[0].children[0].depth).toBe(2);
  });

  // The fields are prefix-closed, so this should never arise. If it does,
  // a term the user can see but not select is worse than one shown a level
  // too high.
  it('keeps a chain whose parent is missing rather than dropping it', () => {
    const roots = buildTree([
      {id: 'Asia', totalCount: 10},
      {id: 'Asia|Missing|Java', totalCount: 3},
    ]);

    expect(ids(roots)).toEqual(['Asia', 'Asia|Missing|Java']);
  });

  it('copes with an empty facet', () => {
    expect(buildTree([])).toEqual([]);
  });
});

describe('filterTree', () => {
  it('returns the forest untouched for an empty search', () => {
    const roots = buildTree(buckets);

    expect(filterTree(roots, '  ')).toBe(roots);
  });

  it('keeps a match and every ancestor above it', () => {
    const found = filterTree(buildTree(buckets), 'maluku');

    expect(ids(found)).toEqual(['Asia']);
    expect(ids(found[0].children)).toEqual(['Asia|South-eastern Asia']);
    expect(ids(found[0].children[0].children[0].children)).toEqual([
      'Asia|South-eastern Asia|Indonesia|North Maluku',
    ]);
  });

  it('matches without regard to case, on the name rather than the chain', () => {
    expect(ids(filterTree(buildTree(buckets), 'GHANA'))).toEqual(['Africa']);
    // "Asia" appears in every Indonesian chain, but only as an ancestor's
    // name — searching it must not drag the whole branch in as matches.
    const asia = filterTree(buildTree(buckets), 'Western');
    expect(ids(asia[0].children)).toEqual(['Asia|Western Asia']);
  });

  it('returns nothing when nothing matches', () => {
    expect(filterTree(buildTree(buckets), 'Patagonia')).toEqual([]);
  });

  it('leaves the forest it was given alone', () => {
    const roots = buildTree(buckets);
    const before = JSON.stringify(roots);
    filterTree(roots, 'maluku');

    expect(JSON.stringify(roots)).toBe(before);
  });
});

describe('idsToExpand', () => {
  it('names every node that has children, so a search reveals its matches', () => {
    const found = filterTree(buildTree(buckets), 'maluku');

    expect(idsToExpand(found)).toEqual([
      'Asia',
      'Asia|South-eastern Asia',
      'Asia|South-eastern Asia|Indonesia',
    ]);
  });

  it('is empty for a forest of leaves', () => {
    expect(idsToExpand(buildTree([{id: 'a', totalCount: 1}]))).toEqual([]);
  });
});

describe('countNodes', () => {
  it('counts every node at every level', () => {
    expect(countNodes(buildTree(buckets))).toBe(buckets.length);
  });
});
