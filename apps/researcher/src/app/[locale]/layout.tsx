import '../globals.css';
import {ReactNode} from 'react';
import {notFound} from 'next/navigation';
import {NextIntlClientProvider} from 'next-intl';
import {ClerkProvider} from '@clerk/nextjs';
import {getTranslations} from 'next-intl/server';
import Navigation from '@/components/navigation';
import AuthHealthCheck from '@/lib/auth-health-check';
import Footer from '@/components/footer';
import localFont from 'next/font/local';

// Self-hosted Montserrat (variable weight, SIL OFL – see src/fonts/LICENSE-Montserrat).
// Avenir Next is the first choice on the Sawubona site; Montserrat is its
// cross-platform stand-in, exposed as --font-sans for the Tailwind preset.
const montserrat = localFont({
  src: [
    {path: '../../fonts/montserrat-latin-wght-normal.woff2', style: 'normal'},
    {
      path: '../../fonts/montserrat-latin-ext-wght-normal.woff2',
      style: 'normal',
    },
  ],
  weight: '100 900',
  display: 'swap',
  variable: '--font-sans',
});

interface Props {
  children: ReactNode;
  params: {locale: string};
}

interface MetadataProps {
  params: {
    locale: string;
  };
}
export async function generateMetadata({params: {locale}}: MetadataProps) {
  const t = await getTranslations({locale, namespace: 'Meta'});
  return {
    title: t('title'),
  };
}

export default async function RootLayout({children, params: {locale}}: Props) {
  const t = await getTranslations('ScreenReaderMenu');

  let messages;
  try {
    messages = (await import(`../../messages/${locale}/messages.json`)).default;
  } catch (err) {
    notFound();
  }

  const clerkLocale = (await import(`@/messages/${locale}/clerk`)).default;

  return (
    <ClerkProvider localization={clerkLocale}>
      <link rel="icon" href="/favicon.ico" sizes="any" />
      <html lang={locale} className={`scroll-smooth ${montserrat.variable}`}>
        <body style={{overscrollBehaviorX: 'auto'}}>
          <div className="min-h-screen flex flex-col">
            <AuthHealthCheck />
            <NextIntlClientProvider locale={locale} messages={messages}>
              <div className="sr-only">
                <ul>
                  <li>
                    <a href="#facets">{t('jumpFilters')}</a>
                  </li>
                  <li>
                    <a href="#search-results">{t('jumpResults')}</a>
                  </li>
                  <li>
                    <a href="#page-navigation">{t('jumpNavigation')}</a>
                  </li>
                </ul>
              </div>
              <header className="w-full bg-ink-800 text-white py-2" id="top">
                <Navigation />
              </header>
              {children}
              <Footer />
            </NextIntlClientProvider>
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}
