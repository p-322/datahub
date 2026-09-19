'use client';

import {useListStore} from '@colonial-collections/list-store';
import {MagnifyingGlassIcon} from '@heroicons/react/24/solid';
import {useTranslations} from 'next-intl';
import {useEffect, useState} from 'react';
import classNames from 'classnames';

interface SearchFieldProps {
  placeholder?: string;
  variant?: 'default' | 'home';
  onSearch?: (query: string) => void;
}

export function SearchField({
  placeholder = '',
  variant = 'default',
  onSearch,
}: SearchFieldProps) {
  const query = useListStore(s => s.query);
  const queryChange = useListStore(s => s.queryChange);
  const [inputText, setInputText] = useState(query);
  const t = useTranslations('Filters');
  const [isMounted, setIsMounted] = useState(false);

  // Wait for hydration to complete before enabling the input
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const wrapperClassName = classNames('flex justify-between w-full', {
    // Home: the one thing on the page that must draw the eye.
    'rounded-full bg-white shadow-card ring-2 ring-accent-500 focus-within:ring-4 focus-within:ring-accent-400 transition':
      variant === 'home',
  });

  const inputClassName = classNames('w-full text-ink-800', {
    'rounded-l py-1 px-3 border border-ink-800': variant === 'default',
    'rounded-l-full py-5 pl-7 pr-3 text-xl border-0 bg-transparent placeholder:text-ink-500 placeholder:italic not-italic focus:ring-0':
      variant === 'home',
  });

  const buttonClassName = classNames({
    'rounded-r bg-ink-800 py-1 px-3 border-t border-b border-r border-ink-800':
      variant === 'default',
    'flex items-center gap-2 m-2 px-7 rounded-full bg-ink-800 hover:bg-accent-600 text-white shadow-md transition':
      variant === 'home',
  });

  const magnifyingGlassClassName = classNames({
    'w-4 h-4 fill-white': variant === 'default',
    'w-7 h-7 fill-white': variant === 'home',
  });

  useEffect(() => {
    setInputText(query);
  }, [query]);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
  };

  const search = () => {
    queryChange(inputText);
    if (onSearch) {
      onSearch(inputText);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      search();
    }
  };

  return (
    <>
      <div className={wrapperClassName} role="searchbox">
        <input
          data-testid="searchQuery"
          value={inputText}
          onChange={handleQueryChange}
          type="text"
          name="search"
          id="search"
          className={inputClassName}
          aria-label={t('accessibilityTypeToFilter')}
          placeholder={placeholder}
          onKeyUp={handleKeyPress}
          disabled={!isMounted}
        />
        <button
          disabled={!isMounted}
          className={buttonClassName}
          aria-label={t('accessibilityClickToSearch')}
          onClick={search}
        >
          <MagnifyingGlassIcon className={magnifyingGlassClassName} />
        </button>
      </div>
    </>
  );
}

function Label() {
  const t = useTranslations('Filters');

  return (
    <label htmlFor="search" className="font-semibold">
      {t('search')}
    </label>
  );
}

interface SearchFieldWithLabelProps {
  onSearch?: (query: string) => void;
}

export function SearchFieldWithLabel({
  onSearch,
}: SearchFieldWithLabelProps = {}) {
  return (
    <div className="w-full max-w-[450px] relative" id="facets">
      <Label />
      <SearchField onSearch={onSearch} />
    </div>
  );
}
