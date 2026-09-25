'use client';

import {SlideOut, SlideOutButton} from '@p-322/ui';
import classNames from 'classnames';
import {useLocale, useTranslations} from 'next-intl';
import {madeElsewhere} from '@/lib/made-elsewhere';
import {useDateFormatter} from '@/lib/date-formatter/hooks';

interface ProvidedByProps {
  dateCreated?: Date;
  citation?: string;
  name?: string;
  communityName?: string;
  id: string;
  isCurrentPublisher: boolean;
  subText?: string;
  // The application the enrichment says it was made with; see
  // lib/made-elsewhere.ts for when that marks it as made elsewhere.
  createdWith?: string;
}

export function ProvidedBy({
  isCurrentPublisher,
  dateCreated,
  citation,
  name,
  communityName,
  id,
  subText,
  createdWith,
}: ProvidedByProps) {
  const t = useTranslations('ProvidedBy');
  const locale = useLocale();
  const {formatDate} = useDateFormatter();
  const elsewhere = madeElsewhere(createdWith, locale);

  return (
    <div
      className={classNames('lg:py-3 text-xs my-1 self-start w-full', {
        'text-neutral-900 lg:border-l lg:px-2 ': isCurrentPublisher,
        'bg-accent-100 text-ink-800 rounded px-2 ': !isCurrentPublisher,
      })}
    >
      <div>
        <div tabIndex={0}>
          {t.rich('name', {
            name: () => <strong tabIndex={0}>{name}</strong>,
          })}
        </div>
        {communityName && (
          <div>
            {t.rich('community', {
              name: () => <strong tabIndex={0}>{communityName}</strong>,
            })}
          </div>
        )}
        {elsewhere && (
          <div>
            {t.rich('madeWith', {
              link: () => (
                <a href={elsewhere.url} className="underline">
                  {elsewhere.name}
                </a>
              ),
            })}
          </div>
        )}
      </div>

      {subText && <div className="italic mt-1">{subText}</div>}

      {(dateCreated || citation) && (
        <div className="flex flex-col justify-between">
          {dateCreated && (
            <div>
              {t.rich('date', {
                date: () => formatDate(dateCreated),
              })}
            </div>
          )}
          {citation && (
            <div>
              <SlideOutButton
                id={`${id}-${dateCreated}-citation`}
                className="p-1 rounded hover:bg-black/10 -ml-1 mt-1"
              >
                {t('showCitationButton')}
              </SlideOutButton>
            </div>
          )}
        </div>
      )}
      {citation && (
        <SlideOut id={`${id}-${dateCreated}-citation`}>
          <div className="flex-col w-full mt-1 flex">
            <em>{t('citationTitle')}:</em>
            {citation}
          </div>
        </SlideOut>
      )}
    </div>
  );
}
