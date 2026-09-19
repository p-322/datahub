import {heroImage, PartnerStrip} from '@colonial-collections/ui/branding';
import CommunityCard from '../communities/community-card';
import {getCommunities} from '@/lib/community/actions';
import ErrorMessage from '@/components/error-message';
import {SortBy} from '@/lib/community/definitions';
import {getTranslations} from 'next-intl/server';
import {SearchFieldHome} from './search-field';
import {Link} from '@/navigation';
import Image from 'next/image';

export default async function Home() {
  const t = await getTranslations('Home');

  let communities;
  try {
    communities = await getCommunities({
      sortBy: SortBy.CreatedAtDesc,
      limit: 4,
      includeMembersCount: true,
    });
  } catch (err) {
    return <ErrorMessage error={t('error')} />;
  }

  return (
    <main className="w-full flex flex-col grow text-ink-700">
      {/* Hero: the Sawubona photograph under a dark shade, wordmark centred. */}
      <div className="relative w-full min-h-[58vh] max-h-[42rem] flex items-center justify-center overflow-hidden bg-ink-800">
        <Image
          src={heroImage}
          alt=""
          priority
          fill
          sizes="100vw"
          className="object-cover object-[center_22%]"
        />
        <div className="absolute inset-0 bg-hero-shade" aria-hidden="true" />
        <div className="relative w-full max-w-3xl px-4 text-center flex flex-col items-center gap-4 pb-24 pt-10">
          <h1
            className="text-white font-medium text-5xl sm:text-6xl lg:text-7xl leading-[0.95] drop-shadow-[0_10px_24px_rgba(35,39,44,0.28)]"
            tabIndex={0}
          >
            {t('title')}
          </h1>
          <p className="kicker text-accent-200 max-w-md leading-normal drop-shadow-[0_8px_18px_rgba(35,39,44,0.2)]">
            {t('subtitle')}
          </p>
        </div>
      </div>

      {/* Frosted card overlapping the hero, as on sawubona-commons.eu. */}
      <div className="w-full px-3 sm:px-5 -mt-20 relative z-10">
        <div className="frost-card page-column py-10 sm:py-12 flex flex-col items-center gap-8 text-center">
          {/* Search panel: tinted band so the field is the first thing read. */}
          <div className="w-full flex flex-col items-center gap-4 -mt-4 px-4 sm:px-8 py-6 sm:py-8 rounded-2xl bg-accent-100 border border-accent-200">
            <label
              htmlFor="search"
              className="text-lg sm:text-xl font-light uppercase tracking-heading text-heading"
            >
              {t('searchLabel')}
            </label>
            <SearchFieldHome />
          </div>
          <p className="max-w-[46rem] leading-relaxed text-ink-600">
            {t.rich('description', {
              em: text => <em>{text}</em>,
              link: text => (
                <Link href="#how-this-works" className="text-link">
                  {text}
                </Link>
              ),
            })}
          </p>
          <div className="w-full flex flex-col items-center gap-3 max-w-[46rem] pt-8 border-t border-line">
            <h2 className="text-base tracking-label" tabIndex={0}>
              {t('narrativeExplainTitle')}
            </h2>
            <p className="whitespace-pre-wrap text-ink-600">
              {t.rich('narrativeExplainText')}
            </p>
            <Link
              href="/sign-up"
              className="inline-block mt-2 rounded-full px-6 py-2.5 text-sm font-semibold bg-ink-800 hover:bg-accent-600 text-white no-underline transition"
              tabIndex={0}
            >
              {t('signupLink')}
            </Link>
          </div>
          <PartnerStrip className="w-full max-w-[46rem] justify-center gap-x-10 pt-8 border-t border-line" />
        </div>
      </div>

      <div className="page-column flex flex-col py-20 gap-6">
        <div className="flex flex-col gap-6">
          <h2 className="heading-rule text-2xl" tabIndex={0}>
            {t('communitiesTitle')}
          </h2>
          <p className="max-w-[46rem] text-ink-600">
            {t('communitiesDescription')}
          </p>
          <p className="max-w-[46rem]">
            {t.rich('communitiesLink', {
              link: text => <Link href="/communities">{text}</Link>,
            })}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 content-stretch gap-6 pt-6">
          {communities.map(community => (
            <CommunityCard key={community.id} community={community} />
          ))}
        </div>
      </div>

      <div className="bg-white" id="how-this-works">
        <div className="page-column flex flex-col gap-6 py-20">
          <h2 className="heading-rule text-2xl" tabIndex={0}>
            {t('howThisWorksTitle')}
          </h2>
          <p className="max-w-[46rem] text-ink-600">{t('howThisWorksText')}</p>
          <div className="rounded-2xl overflow-hidden shadow-card-sm">
            <Image
              src="/images/onboarding.gif"
              alt={t('howThisWorksAlt')}
              width="900"
              height="300"
              className="w-full h-auto"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
