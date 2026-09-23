'use client';

import {SearchField} from '@p-322/ui/list';
import {useRouter} from '@/navigation';
import {useTranslations} from 'next-intl';

export function SearchFieldHome() {
  const t = useTranslations('Home');
  const router = useRouter();

  const navigateOnSearch = (query: string) => {
    if (query.length > 0) {
      const urlSearchParams = new URLSearchParams({query});
      router.replace(`/objects?${urlSearchParams}`);
    }
  };

  return (
    <SearchField
      placeholder={t('searchPlaceholder')}
      variant="home"
      onSearch={navigateOnSearch}
    />
  );
}
