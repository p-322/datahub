'use client';

import {encodeRouteSegment} from '@/lib/clerk-route-segment-transformer';
import SignedIn from '@/lib/community/signed-in';
import {Link, locales, usePathname} from '@/navigation';
import {SignInButton, SignedOut, UserButton} from '@clerk/nextjs';
import {NavigationMenu} from '@colonial-collections/ui';
import {Wordmark} from '@colonial-collections/ui/branding';
import {useLocale, useTranslations} from 'next-intl';
import {useMemo} from 'react';
import ToFilteredListButton from './to-filtered-list-button';

export default function Navigation() {
  const pathname = usePathname();
  const locale = useLocale();

  const tNavigation = useTranslations('Navigation');
  const tLanguageSelector = useTranslations('LanguageSelector');
  const subMenuItems = useMemo(
    () =>
      [{name: tNavigation('about'), href: '/about'}].map(item => ({
        ...item,
        active: item.href === pathname,
      })),
    [pathname, tNavigation]
  );

  const languageMenuItems = useMemo(
    () =>
      locales.map(localeItem => ({
        name: tLanguageSelector(localeItem),
        href: `/revalidate/?path=${encodeRouteSegment(
          `/[locale]${pathname}`
        )}&redirect=${encodeRouteSegment(`/${localeItem}${pathname}`)}`,
        active: localeItem === locale,
        ariaLabel: tLanguageSelector('accessibilityLanguageSelector', {
          language: tLanguageSelector(locale),
        }),
      })),
    [locale, pathname, tLanguageSelector]
  );

  return (
    <div className="w-full px-4 sm:px-10 max-w-[1800px] mx-auto flex flex-row flex-wrap gap-2 md:gap-4">
      <div className="order-1 grow flex items-center">
        <Link href="/" className="no-underline text-white py-1">
          <Wordmark tagline={tNavigation('datahub')} />
        </Link>
      </div>
      <nav className="order-5 lg:order-2  w-full lg:w-auto flex justify-end items-center gap-7 text-sm sm:text-base sm:font-semibold">
        <ToFilteredListButton baseUrl="/objects">
          {tNavigation('searchObjects')}
        </ToFilteredListButton>
        <ToFilteredListButton baseUrl="/communities">
          {tNavigation('communities')}
        </ToFilteredListButton>
      </nav>
      <nav className="order-2 lg:order-3 text-sm  grow flex items-center justify-end gap-2">
        <Link href="/" className="flex items-center">
          {tNavigation('home')}
        </Link>
        <NavigationMenu
          buttonText={tNavigation('subMenuButton')}
          menuItems={subMenuItems}
          Link={Link}
        />
      </nav>
      <div className="order-4 lg:order-4 text-sm  flex items-center">
        <NavigationMenu
          buttonText={tLanguageSelector(locale)}
          menuItems={languageMenuItems}
          Link="a"
        />
      </div>
      <div className="order-3 lg:order-5 text-sm flex items-center">
        <SignedIn>
          <UserButton afterSignOutUrl="/" />
          <span data-testid="signed-in" />
        </SignedIn>
        <SignedOut>
          <SignInButton>
            <button
              data-testid="sign-in-button"
              className="p-1 sm:py-2 sm:px-3 rounded-full text-xs bg-neutral-200/50 hover:bg-neutral-300/50 transition flex items-center gap-1 text-ink-900 bg-white"
            >
              {tNavigation('signIn')}
            </button>
          </SignInButton>
        </SignedOut>
      </div>
    </div>
  );
}
