'use client';

import {Modal, ModalButton, ModalHeader} from '../modal';
import {FacetCheckBox, FacetTitle, FacetWrapper} from './base-facet';
import {SearchResultFilter} from './definitions';
import {useMemo, useState} from 'react';
import {
  InformationCircleIcon,
  ChevronRightIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/solid';
import {SelectedFiltersForKey} from './selected-filters';
import {useTranslations} from 'next-intl';
import {buildTree, filterTree, idsToExpand, TreeNode} from '@p-322/list-store';

// A facet whose values are thesaurus chains — "kostuum (wijze van mode)|
// kledingaccessoires|hoeden" — shown as the tree they describe.
//
// Why this exists: the chains are what make the filter roll up, so that
// choosing "headgear" also finds hats. But a flat checkbox list has nowhere
// to put a chain, and rendering it verbatim is what the locations facet used
// to do. Here the depth is the indentation, and each node is labelled by its
// own term.
//
// Counts come from the index and are not summed from children: the paths are
// self-inclusive, so an ancestor already includes everything below it.

interface RowProps {
  node: TreeNode;
  filterKey: string;
  expanded: Set<string>;
  toggle: (id: string) => void;
}

function Row({node, filterKey, expanded, toggle}: RowProps) {
  const t = useTranslations('Filters');
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.id);

  return (
    <li>
      <div
        className="flex items-start gap-1"
        style={{paddingLeft: `${node.depth * 1.25}rem`}}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => toggle(node.id)}
            aria-expanded={isOpen}
            aria-label={t(isOpen ? 'treeCollapse' : 'treeExpand', {
              name: node.name,
            })}
            className="mt-1 shrink-0 text-neutral-500 hover:text-neutral-900"
          >
            {isOpen ? (
              <ChevronDownIcon className="w-4 h-4" />
            ) : (
              <ChevronRightIcon className="w-4 h-4" />
            )}
          </button>
        ) : (
          // Keeps leaves aligned with their siblings that do open.
          <span className="w-4 shrink-0" aria-hidden="true" />
        )}
        <div className="grow min-w-0">
          <FacetCheckBox
            filterKey={filterKey}
            name={node.name}
            id={node.id}
            count={node.totalCount}
            clipName={false}
          />
        </div>
      </div>
      {hasChildren && isOpen && (
        <ul>
          {node.children.map(child => (
            <Row
              key={child.id}
              node={child}
              filterKey={filterKey}
              expanded={expanded}
              toggle={toggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

interface ExpandedTreeProps {
  filterKey: string;
  filters: SearchResultFilter[];
  roots: TreeNode[];
}

function ExpandedTree({filterKey, filters, roots}: ExpandedTreeProps) {
  const t = useTranslations('Filters');
  const [search, setSearch] = useState('');
  const [opened, setOpened] = useState<Set<string>>(new Set());

  const shown = useMemo(() => filterTree(roots, search), [roots, search]);

  // A search that leaves its matches collapsed behind their ancestors hides
  // the thing that was searched for, so a narrowed tree opens itself. What
  // the user opened by hand is kept alongside, so clearing the search does
  // not collapse their place.
  const expanded = useMemo(() => {
    return search.trim() ? new Set(idsToExpand(shown)) : opened;
  }, [search, shown, opened]);

  const toggle = (id: string) => {
    setOpened(previous => {
      const next = new Set(previous);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-10 max-h-[95%]">
      <div className="w-full md:w-1/2 lg:w-3/4 flex flex-col min-h-0">
        <div className="my-4">
          <input
            placeholder={t('filterPlaceholder', {
              filterName: t(`${filterKey}Filter`),
            })}
            type="text"
            className="block border rounded-md w-full border-gray-300 px-2 py-1 shadow-sm focus:border-sky-700 focus:ring-sky-700 sm:text-sm max-w-lg"
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </div>
        {shown.length === 0 ? (
          <p className="text-neutral-600 py-4">{t('treeNoMatches')}</p>
        ) : (
          <ul className="overflow-y-auto pr-2">
            {shown.map(node => (
              <Row
                key={node.id}
                node={node}
                filterKey={filterKey}
                expanded={expanded}
                toggle={toggle}
              />
            ))}
          </ul>
        )}
      </div>
      <div className="w-full md:w-1/2 lg:w-1/4 flex flex-col gap-2">
        <h3 className="flex items-center gap-2">
          <InformationCircleIcon className="w-5 h-5 fill-bg-sky-500" />
          {t('aboutFacetsHeader')}
        </h3>
        <div className="pb-4 whitespace-pre-wrap">{t('treeAboutText')}</div>
        <h3>{t('selectedFilters')}</h3>
        <div className="flex gap-2 flex-wrap overflow-y-auto">
          <SelectedFiltersForKey
            searchParamType="array"
            filters={filters}
            filterKey={filterKey}
          />
        </div>
      </div>
    </div>
  );
}

interface Props {
  title: string;
  filters: SearchResultFilter[];
  filterKey: string;
  testId?: string;
}

export function TreeFacet({title, filters, filterKey, testId}: Props) {
  const t = useTranslations('Filters');
  const roots = useMemo(() => buildTree(filters), [filters]);

  if (!filters.length) {
    return null;
  }

  // The five biggest ROOTS, not the five biggest values. Taking the biggest
  // values put Asia, South-eastern Asia and Indonesia in the sidebar as
  // three siblings — nested terms shown as peers, with counts containing one
  // another, reading as 770,000 objects in a collection of 1,039,214. The
  // roots are the summary: mostly Asia, then the Americas and Africa.
  const preview = roots.slice(0, 5);

  return (
    <FacetWrapper testId={testId} title={title}>
      <div className="flex items-center w-full my-1">
        <FacetTitle />
      </div>
      {preview.map(node => (
        <FacetCheckBox
          key={`TreeFacet-${node.id}`}
          filterKey={filterKey}
          name={node.name}
          id={node.id}
          count={node.totalCount}
        />
      ))}
      <Modal id={filterKey}>
        <ModalHeader title={title} />
        <ExpandedTree filterKey={filterKey} filters={filters} roots={roots} />
      </Modal>
      <ModalButton
        id={filterKey}
        className="inline-flex items-center text-accent-600 text-sm"
        aria-label={t('expandFilterAria')}
      >
        <span>{t('expandFilter')}</span>
        <ChevronRightIcon className="w-4 h-4 fill-accent-600" />
      </ModalButton>
    </FacetWrapper>
  );
}
