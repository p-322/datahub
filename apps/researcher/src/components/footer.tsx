import {Link} from '@/navigation';
import {FundingDisclosure, Wordmark} from '@p-322/ui/branding';
import {getTranslations} from 'next-intl/server';
import ToFilteredListButton from './to-filtered-list-button';

export const secondaryNavigation = [
  {translationKey: 'about', href: '/about'},
  {translationKey: 'faq', href: '/faq'},
  {translationKey: 'contact', href: '/contact'},
  {
    translationKey: 'consortium',
    href: 'https://sawubona-commons.eu/',
  },
];

export default async function Footer() {
  const t = await getTranslations('Navigation');

  return (
    <footer className="w-full mt-20 text-ink-200">
      <div className="bg-ink-800 px-4 sm:px-10 pt-16 pb-12">
        <div className="max-w-7xl w-full mx-auto flex flex-col gap-8 lg:gap-10 lg:flex-row">
          <div className="w-full lg:w-1/3 border-ink-600 lg:border-r pr-4">
            <Link href="/" className="no-underline text-white">
              <Wordmark tagline={t('datahub')} />
            </Link>
          </div>
          <div className="w-full lg:w-1/3 border-ink-600 border-t lg:border-t-0 lg:border-r pt-6 lg:pt-0">
            <div className="flex flex-col gap-2 text-sm max-w-80 pr-4 leading-relaxed">
              <p className="whitespace-pre-wrap">{t('footerText')}</p>
            </div>
          </div>
          <div className="w-full lg:w-1/3 flex gap-10 border-t pt-6 lg:pt-0 lg:border-t-0 border-ink-600">
            <nav className="flex flex-col gap-1 text-lg font-semibold">
              <ToFilteredListButton baseUrl="/objects">
                {t('searchObjects')}
              </ToFilteredListButton>
              <ToFilteredListButton baseUrl="/communities">
                {t('communities')}
              </ToFilteredListButton>
            </nav>
            <nav className="flex flex-col gap-1 text-sm">
              {secondaryNavigation.map(item => (
                <Link key={item.href} href={item.href}>
                  {t(item.translationKey)}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>
      <div className="bg-ink-900 px-4 sm:px-10 py-6 border-t border-white/10">
        <FundingDisclosure className="max-w-7xl w-full mx-auto text-ink-200/90" />
      </div>
    </footer>
  );
}
