// Turning a thesaurus facet back into the tree it came from.
//
// Elasticsearch gives a flat list of buckets, but the values of a *Path field
// are whole chains from the root:
//
//   "kostuum (wijze van mode)"
//   "kostuum (wijze van mode)|kledingaccessoires"
//   "kostuum (wijze van mode)|kledingaccessoires|hoofddeksels"
//
// and every prefix of every chain is a bucket of its own, with its own count.
// That was measured across 20,000 documents of the second delivery: all six
// path fields are prefix-closed, 100%. So the hierarchy needs no second
// source — no thesaurus lookup, no extra request. It is already here, and
// this reassembles it.
//
// A node's count comes from the index, not from summing its children: the
// paths are self-inclusive, so an object catalogued as "hoeden" is counted
// under "hoeden" and under every ancestor. Adding children up would count it
// several times over, and the total would stop matching what selecting the
// node actually returns.

export const pathSeparator = '|';

export interface PathFilter {
  id: string | number;
  name?: string | number;
  totalCount: number;
}

export interface TreeNode {
  /** The full chain, which is what filtering on this node selects. */
  id: string;
  /** The last segment: what the node is called. */
  name: string;
  totalCount: number;
  depth: number;
  children: TreeNode[];
}

function leafOf(path: string) {
  const parts = path.split(pathSeparator);
  return parts[parts.length - 1] || path;
}

/**
 * Builds the forest from a facet's buckets. Roots come back first, each with
 * its children, every level ordered by count.
 *
 * A chain whose parent is missing from the buckets is kept as a root rather
 * than dropped. That should not happen — the fields are prefix-closed — but
 * a term the user can see and cannot select is a worse failure than one that
 * sits a level too high.
 */
export function buildTree(filters: PathFilter[]): TreeNode[] {
  const nodes = new Map<string, TreeNode>();

  for (const filter of filters) {
    const id = String(filter.id);
    nodes.set(id, {
      id,
      name: filter.name !== undefined ? String(filter.name) : leafOf(id),
      totalCount: filter.totalCount,
      depth: id.split(pathSeparator).length - 1,
      children: [],
    });
  }

  const roots: TreeNode[] = [];
  for (const node of nodes.values()) {
    const cut = node.id.lastIndexOf(pathSeparator);
    const parent = cut === -1 ? undefined : nodes.get(node.id.slice(0, cut));
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const byCount = (a: TreeNode, b: TreeNode) => b.totalCount - a.totalCount;
  const sort = (branch: TreeNode[]) => {
    branch.sort(byCount);
    for (const node of branch) {
      sort(node.children);
    }
  };
  sort(roots);

  return roots;
}

/**
 * The subset of the forest matching a search, keeping every ancestor of a
 * match so a result is still shown in its place rather than floating loose.
 * An empty search returns the forest unchanged.
 */
export function filterTree(roots: TreeNode[], search: string): TreeNode[] {
  const needle = search.trim().toLowerCase();
  if (!needle) {
    return roots;
  }

  const keep = (node: TreeNode): TreeNode | undefined => {
    const children = node.children
      .map(keep)
      .filter((child): child is TreeNode => child !== undefined);

    if (children.length > 0) {
      return {...node, children};
    }
    return node.name.toLowerCase().includes(needle)
      ? {...node, children: []}
      : undefined;
  };

  return roots.map(keep).filter((node): node is TreeNode => node !== undefined);
}

/**
 * The ids to expand so every node in a (filtered) forest is visible. Used
 * when a search narrows the tree: leaving matches collapsed behind their
 * ancestors would hide the very thing that was searched for.
 */
export function idsToExpand(roots: TreeNode[]): string[] {
  const ids: string[] = [];
  const walk = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      if (node.children.length > 0) {
        ids.push(node.id);
        walk(node.children);
      }
    }
  };
  walk(roots);
  return ids;
}

/** How many nodes a forest holds, for "showing N of M". */
export function countNodes(roots: TreeNode[]): number {
  return roots.reduce((sum, node) => sum + 1 + countNodes(node.children), 0);
}
